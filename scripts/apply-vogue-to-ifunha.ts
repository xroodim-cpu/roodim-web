import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sites, siteFiles, webSkins, webSkinFiles } from '../src/drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * 일회용: 이프운하 사이트의 스킨을 vogue (id=6) 로 교체
 *
 * 동작:
 *   1. webSkins#6 (vogue) 메타 + 파일 6종 로드
 *   2. site_files 의 html/css/js/json 통째 삭제 (image 등 자료는 보존)
 *   3. vogue 파일들을 site_files 에 복사
 *   4. sites.skinId = 6, skinAppliedAt = now, skinVersion = '1.0.0' 업데이트
 *
 * 롤백:
 *   사용자 사전 메모: 이프운하의 기존 skinId=3 ("테스트커스텀스킨 수정본").
 *   문제 시 동일한 패턴으로 NEW_SKIN_ID=3 으로 변경 후 다시 실행.
 *
 * 안전 가드:
 *   - SITE_ID 하드코딩 (이프운하 외 다른 사이트 무영향)
 *   - 기존 webSkins 레코드 미수정 (id=3 등 그대로 보존)
 *   - 트랜잭션 사용 (실패 시 자동 롤백)
 */

const SITE_ID = '89fbee8b-e919-4991-a1ab-33c961a0a28c'; // ifunha
const NEW_SKIN_ID = 6;                                   // vogue (이프운하 보그)
const ROLLBACK_SKIN_ID = 3;                              // 테스트커스텀스킨 수정본

async function apply() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL 없음.');
    process.exit(1);
  }
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    // 0. 사전 검증
    const [site] = await db.select().from(sites).where(eq(sites.id, SITE_ID)).limit(1);
    if (!site) throw new Error(`사이트 ${SITE_ID} 미존재`);
    console.log(`📍 site: ${site.slug} (${site.name}), 현재 skinId=${site.skinId}`);
    console.log(`   교체 대상: ${site.skinId} → ${NEW_SKIN_ID} (롤백시 ${ROLLBACK_SKIN_ID})`);

    const [skin] = await db.select().from(webSkins).where(eq(webSkins.id, NEW_SKIN_ID)).limit(1);
    if (!skin) throw new Error(`스킨 ${NEW_SKIN_ID} 미존재`);
    console.log(`📦 skin: ${skin.name} (${skin.slug}, v${skin.version})`);

    const skinFiles = await db.select().from(webSkinFiles).where(eq(webSkinFiles.skinId, NEW_SKIN_ID));
    if (skinFiles.length === 0) throw new Error(`스킨 ${NEW_SKIN_ID} 파일 없음`);
    console.log(`📁 ${skinFiles.length} files to copy`);

    // 1. 트랜잭션
    await db.transaction(async (tx) => {
      // 기존 텍스트 파일 삭제 (이미지 등 자료는 보존)
      const deleted = await tx.delete(siteFiles).where(
        and(
          eq(siteFiles.siteId, SITE_ID),
          inArray(siteFiles.fileType, ['html', 'css', 'js', 'json']),
        ),
      ).returning({ id: siteFiles.id, filename: siteFiles.filename });
      console.log(`🗑️  ${deleted.length}개 기존 텍스트 파일 삭제 (image 등 보존)`);

      // 새 파일 복사
      const now = new Date();
      for (const f of skinFiles) {
        await tx.insert(siteFiles).values({
          siteId: SITE_ID,
          filename: f.filename,
          fileType: f.fileType,
          content: f.content,
          fileSize: f.fileSize ?? 0,
          isEntry: f.isEntry ?? false,
          sortOrder: f.sortOrder ?? 0,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`     · 복사: ${f.filename}`);
      }

      // sites 업데이트
      await tx.update(sites)
        .set({
          skinId: NEW_SKIN_ID,
          skinAppliedAt: now,
          skinVersion: skin.version,
          updatedAt: now,
        })
        .where(eq(sites.id, SITE_ID));
      console.log(`✅ sites.skinId = ${NEW_SKIN_ID} 업데이트`);
    });

    console.log(`\n✅ 적용 완료. 즉시 https://roodim-web.vercel.app/${site.slug} 에서 확인 가능.`);
    console.log(`   롤백 필요시: SITE_ID 동일, NEW_SKIN_ID=${ROLLBACK_SKIN_ID} 으로 본 스크립트 수정 후 재실행.`);
  } finally {
    await client.end();
  }
}

apply().catch((err) => {
  console.error('❌ Apply failed:', err);
  process.exit(1);
});
