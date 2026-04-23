import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { webSkins, webSkinFiles, sites } from '../src/drizzle/schema';
import { eq, count } from 'drizzle-orm';

/**
 * 일회용: #5 "고객 기본 스킨"(customer-default-v1) 삭제 + basic(#1) 구조 복제해
 *        새 고객용 기본 스킨 생성 (slug='customer-default', targetType='customer', isDefault=true)
 *
 * 사전 검증:
 *   - skin=5 를 참조하는 site 없어야 (inspect 결과 없음 확인)
 *   - org_skin_purchases 는 CASCADE 로 자동 삭제
 *   - web_skin_files 는 CASCADE 로 자동 삭제
 */

const OLD_SKIN_ID = 5;      // 고객 기본 스킨 (customer-default-v1) — 삭제 대상
const SOURCE_SKIN_ID = 1;   // 기본스킨 (basic) — 복제 소스
const NEW_SKIN_SLUG = 'customer-default';
const NEW_SKIN_NAME = '고객 기본 스킨';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL 없음.'); process.exit(1);
  }
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    // 0. 사전 검증: #5 참조 사이트 존재 여부
    const siteRefs = await db.select({ cnt: count() }).from(sites).where(eq(sites.skinId, OLD_SKIN_ID));
    if (siteRefs[0].cnt > 0) {
      console.error(`❌ skin=${OLD_SKIN_ID} 를 참조하는 사이트 ${siteRefs[0].cnt}개 있음. 중단.`);
      process.exit(1);
    }
    console.log(`✓ skin=${OLD_SKIN_ID} 참조 사이트 없음, 삭제 안전`);

    // 1. 소스 스킨(basic) + 파일 로드
    const [source] = await db.select().from(webSkins).where(eq(webSkins.id, SOURCE_SKIN_ID)).limit(1);
    if (!source) throw new Error(`소스 스킨 id=${SOURCE_SKIN_ID} 미존재`);
    const sourceFiles = await db.select().from(webSkinFiles).where(eq(webSkinFiles.skinId, SOURCE_SKIN_ID));
    console.log(`✓ 소스 '${source.name}' (${source.slug}), ${sourceFiles.length} files`);

    // 2. 기존 동일 slug 체크 (idempotent)
    const existingByslug = await db.select().from(webSkins).where(eq(webSkins.slug, NEW_SKIN_SLUG)).limit(1);
    if (existingByslug.length > 0) {
      console.log(`⚠️ slug='${NEW_SKIN_SLUG}' 이미 존재 (id=${existingByslug[0].id}) — 기존 레코드 보존, 파일만 갱신`);
    }

    await db.transaction(async (tx) => {
      // 3. #5 삭제 (web_skin_files + org_skin_purchases 자동 CASCADE)
      const delRes = await tx.delete(webSkins).where(eq(webSkins.id, OLD_SKIN_ID)).returning({ id: webSkins.id, name: webSkins.name });
      if (delRes.length > 0) {
        console.log(`🗑️  삭제: #${delRes[0].id} ${delRes[0].name}`);
      } else {
        console.log(`ℹ️ #${OLD_SKIN_ID} 이미 없음`);
      }

      // 4. 신규 customer-default INSERT (또는 UPDATE if exists)
      let newSkinId: number;
      if (existingByslug.length > 0) {
        newSkinId = existingByslug[0].id;
        await tx.update(webSkins)
          .set({
            name: NEW_SKIN_NAME,
            description: '고객 임대사이트용 기본 스킨 — 기본스킨(basic) 구조 기반',
            targetType: 'customer',
            isDefault: true,
            isFree: true,
            status: 'active',
            version: source.version,
            fileCount: sourceFiles.length,
            updatedAt: new Date(),
          })
          .where(eq(webSkins.id, newSkinId));
        await tx.delete(webSkinFiles).where(eq(webSkinFiles.skinId, newSkinId));
        console.log(`✓ 기존 #${newSkinId} 갱신`);
      } else {
        const [ins] = await tx.insert(webSkins).values({
          slug: NEW_SKIN_SLUG,
          name: NEW_SKIN_NAME,
          description: '고객 임대사이트용 기본 스킨 — 기본스킨(basic) 구조 기반',
          version: source.version,
          category: 'general',
          targetType: 'customer',
          isDefault: true,
          isFree: true,
          fileCount: sourceFiles.length,
          status: 'active',
        }).returning();
        newSkinId = ins.id;
        console.log(`✓ 신규 생성: #${newSkinId} '${NEW_SKIN_NAME}' (slug=${NEW_SKIN_SLUG}, targetType=customer)`);
      }

      // 5. basic 파일 5종 복제
      const now = new Date();
      for (const f of sourceFiles) {
        await tx.insert(webSkinFiles).values({
          skinId: newSkinId,
          filename: f.filename,
          fileType: f.fileType,
          content: f.content,
          fileSize: f.fileSize ?? 0,
          isEntry: f.isEntry ?? false,
          sortOrder: f.sortOrder ?? 0,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`     · 복제: ${f.filename}`);
      }
    });

    // 6. 결과 조회
    const after = await db.select({
      id: webSkins.id,
      name: webSkins.name,
      slug: webSkins.slug,
      targetType: webSkins.targetType,
      isDefault: webSkins.isDefault,
      fileCount: webSkins.fileCount,
    }).from(webSkins);

    console.log('\n=== 현재 web_skins ===');
    for (const s of after) {
      console.log(`  #${s.id.toString().padStart(2)} [${s.targetType}] ${s.isDefault ? '★' : ' '} ${s.name}  (${s.slug}, files=${s.fileCount})`);
    }
    console.log('\n✅ 완료.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
