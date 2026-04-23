import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { webSkins, webSkinFiles } from '../src/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

/**
 * 이프운하 vogue 스킨 시드 스크립트
 *
 * 동작:
 *   1. resources/skins/ifunha-vogue/ 의 모든 파일 자동 로드
 *   2. webSkins 에 slug='vogue' upsert (기존 webSkins 별도 보존, 신규 레코드)
 *   3. webSkinFiles 에 파일별 upsert (skinId + filename 유니크)
 *
 * 안전 가드:
 *   - 신규 webSkins 레코드만 INSERT, 기존 "테스트커스텀스킨 수정본" 등 다른 스킨 무영향
 *   - sites.skinId 변경 없음 (별도 단계에서 /api/skins/apply 또는 직접 SQL 로 교체)
 *
 * 환경변수:
 *   DATABASE_URL  필수
 *   SKIN_NAME     선택 (기본: '이프운하 보그')
 *   SKIN_SLUG     선택 (기본: 'vogue')
 *
 * 실행:
 *   cd roodim-web
 *   npx tsx scripts/seed-ifunha-vogue.ts
 */

const SKIN_DIR = join(process.cwd(), 'resources', 'skins', 'ifunha-vogue');
const SKIN_SLUG = process.env.SKIN_SLUG || 'vogue';
const SKIN_NAME = process.env.SKIN_NAME || '이프운하 보그';

const FILE_TYPE_MAP: Record<string, string> = {
  '.html': 'html',
  '.css': 'css',
  '.js': 'js',
  '.json': 'json',
};

function detectFileType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return FILE_TYPE_MAP[ext] || 'other';
}

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL 환경변수가 없습니다. roodim-web/.env 또는 .env.local 확인.');
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  try {
    console.log(`🌱 Seeding skin: slug=${SKIN_SLUG}, name=${SKIN_NAME}`);
    console.log(`   from: ${SKIN_DIR}\n`);

    // 1. 디렉토리 검증
    try {
      const dirStat = statSync(SKIN_DIR);
      if (!dirStat.isDirectory()) throw new Error('not a directory');
    } catch {
      console.error(`❌ 디렉토리가 없습니다: ${SKIN_DIR}`);
      process.exit(1);
    }

    // 2. webSkins upsert (slug 기준)
    const existing = await db.select().from(webSkins).where(eq(webSkins.slug, SKIN_SLUG)).limit(1);

    let skinId: number;
    if (existing.length > 0) {
      skinId = existing[0].id;
      console.log(`  ✓ 기존 '${SKIN_SLUG}' 스킨 발견 (id=${skinId}) — 메타+파일 갱신`);

      await db.update(webSkins)
        .set({
          name: SKIN_NAME,
          description: 'iFUNHA Vogue — 매거진 에디토리얼 스킨 (페이퍼 톤 + 와인 레드 액센트)',
          category: 'magazine-editorial',
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(webSkins.id, skinId));

      // 기존 파일 통째 삭제 후 재삽입
      await db.delete(webSkinFiles).where(eq(webSkinFiles.skinId, skinId));
    } else {
      const [skin] = await db.insert(webSkins).values({
        slug: SKIN_SLUG,
        name: SKIN_NAME,
        description: 'iFUNHA Vogue — 매거진 에디토리얼 스킨 (페이퍼 톤 + 와인 레드 액센트)',
        version: '1.0.0',
        category: 'magazine-editorial',
        targetType: 'customer',
        isDefault: false,
        isFree: true,
        status: 'active',
      }).returning();
      skinId = skin.id;
      console.log(`  ✓ 신규 '${SKIN_SLUG}' 스킨 생성 (id=${skinId})`);
    }

    // 3. 파일 자동 로드 + INSERT
    const files = readdirSync(SKIN_DIR).filter(f => {
      const full = join(SKIN_DIR, f);
      return statSync(full).isFile();
    });

    if (files.length === 0) {
      console.error('❌ 시드할 파일이 없습니다.');
      process.exit(1);
    }

    let sortOrder = 0;
    for (const filename of files) {
      const fullPath = join(SKIN_DIR, filename);
      const content = readFileSync(fullPath, 'utf-8');
      const fileType = detectFileType(filename);
      const isEntry = filename === 'index.html';

      await db.insert(webSkinFiles).values({
        skinId,
        filename,
        fileType,
        content,
        fileSize: Buffer.byteLength(content, 'utf-8'),
        isEntry,
        sortOrder: sortOrder++,
      });

      console.log(`     · ${filename.padEnd(20)} (${fileType.padEnd(5)}, ${Buffer.byteLength(content, 'utf-8').toLocaleString()} bytes${isEntry ? ', entry' : ''})`);
    }

    // 4. fileCount 갱신
    await db.update(webSkins)
      .set({ fileCount: files.length, updatedAt: new Date() })
      .where(eq(webSkins.id, skinId));

    console.log(`\n✅ 시드 완료. skinId=${skinId}, ${files.length}개 파일 적재.`);
    console.log(`\n다음 단계: 사이트의 sites.skinId 를 ${skinId} 로 변경하면 적용됩니다.`);
    console.log(`   예) /api/skins/apply POST { siteId: '<uuid>', skinId: ${skinId} }`);
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
