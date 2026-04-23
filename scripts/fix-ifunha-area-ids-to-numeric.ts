import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { bannerAreas } from '../src/drizzle/schema';
import { and, eq, inArray } from 'drizzle-orm';

/**
 * 일회용 (cleanup): 내가 실수로 INSERT 한 이프운하 사이트의 단어 기반 area 6개를 삭제.
 *
 * 맥락:
 *   - 이프운하 사이트는 이미 코드생성기를 통해 area_id '1'~'6' (사용자 데이터) 가 존재.
 *   - 나는 이걸 모르고 'hero','cinematic','ai_models','craft','packages','faq' 6개를 추가로
 *     INSERT 했음. 스킨 공용 규약 위반.
 *
 * 조치:
 *   - 내가 만든 6개 row 만 선택적으로 DELETE.
 *   - banner_items 는 FK CASCADE 로 자동 삭제.
 *   - 사용자의 기존 '1'~'6' area 와 items 는 무영향.
 *
 * 안전 가드:
 *   - site_id + area_id 단어 리스트 필터 (다른 row 무영향)
 *   - before/after 출력
 */

const SITE_ID = '89fbee8b-e919-4991-a1ab-33c961a0a28c'; // ifunha
const WRONG_AREA_IDS = ['hero', 'cinematic', 'ai_models', 'craft', 'packages', 'faq'];

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client);

  try {
    const before = await db.select({
      id: bannerAreas.id,
      areaId: bannerAreas.areaId,
      areaName: bannerAreas.areaName,
    }).from(bannerAreas).where(and(
      eq(bannerAreas.siteId, SITE_ID),
      inArray(bannerAreas.areaId, WRONG_AREA_IDS),
    ));

    console.log('=== 삭제 대상 ===');
    for (const r of before) console.log(`  row#${r.id} area_id='${r.areaId}' name='${r.areaName}'`);
    if (before.length === 0) {
      console.log('대상 없음. 이미 clean 상태.');
      return;
    }

    const deleted = await db.delete(bannerAreas).where(and(
      eq(bannerAreas.siteId, SITE_ID),
      inArray(bannerAreas.areaId, WRONG_AREA_IDS),
    )).returning({ id: bannerAreas.id, areaId: bannerAreas.areaId });

    console.log(`\n✅ ${deleted.length} row 삭제 (banner_items CASCADE).`);

    // 남은 상태 확인
    const after = await db.select({
      id: bannerAreas.id,
      areaId: bannerAreas.areaId,
      areaName: bannerAreas.areaName,
    }).from(bannerAreas).where(eq(bannerAreas.siteId, SITE_ID));

    console.log(`\n=== 이프운하 banner_areas 현재 상태 (${after.length} row) ===`);
    for (const r of after) console.log(`  row#${r.id} area_id='${r.areaId}' name='${r.areaName}'`);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
