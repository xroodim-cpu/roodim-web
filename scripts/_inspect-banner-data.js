/**
 * area_id=3 (루프 정상 작동) vs area_id=4,5 (이미지 누락) 데이터 비교.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

(async () => {
  for (const aid of ['3', '4', '5']) {
    const areas = await sql`
      SELECT id, area_id, area_name, display_type FROM banner_areas
      WHERE site_id = ${SITE_ID} AND area_id = ${aid}`;
    console.log(`\n═══ area_id="${aid}" ═══`);
    console.log('banner_areas rows:', areas.length);
    for (const a of areas) {
      console.log(`  id=${a.id} name="${a.area_name}" display_type=${a.display_type}`);
      const items = await sql`
        SELECT id, num, title, img_url, text_content, images, texts, links, sort_order
        FROM banner_items WHERE area_id = ${a.id} ORDER BY num, sort_order`;
      console.log(`  banner_items(${items.length}):`);
      for (const it of items) {
        console.log(`    [num=${it.num}] title="${(it.title||'').slice(0,20)}" img_url="${(it.img_url||'').slice(-40)}" text="${(it.text_content||'').slice(0,30)}" images=${JSON.stringify(it.images)?.slice(0,80)} texts=${JSON.stringify(it.texts)?.slice(0,60)}`);
      }
    }
  }
  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
