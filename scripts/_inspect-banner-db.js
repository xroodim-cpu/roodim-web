/**
 * 각 area_id 의 배너 DB 저장 구조 확인.
 *  - site_banner_areas / site_banners / site_banner_items (이름은 확인)
 *  - area_id=3 (이미 루프 방식 — 잘 작동) vs area_id=4,5 (새로 루프로 바꾼 것 — 이미지 사라짐) 의 데이터 비교
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

(async () => {
  // 1) 배너 관련 테이블 이름 추정
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND (table_name LIKE '%banner%' OR table_name LIKE '%area%')
    ORDER BY table_name`;
  console.log('배너 관련 테이블:', tables.map(t => t.table_name));

  for (const t of tables) {
    const cols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name = ${t.table_name}
      ORDER BY ordinal_position`;
    console.log(`\n[ ${t.table_name} ] columns:`);
    for (const c of cols) console.log(`  - ${c.column_name} (${c.data_type})`);
  }

  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
