/**
 * Phase 4 보정 #2: HTML area_id → DB banner_areas.area_id 매핑 일치화
 *
 * 문제: 계획 단계에서 HTML 에 `area_id="temperature-people"` / "blog" / "criteria" / "medical-law"
 *       등 의미적 이름을 넣었지만, 실제 DB banner_areas 의 area_id 는 숫자 문자열("2","3","4","5")이다.
 *       → 템플릿 엔진이 area 를 못 찾아 모두 data-empty 처리 + banner_loop = "no data"
 *       → 해당 섹션이 모두 숨겨짐
 *
 * 매핑:
 *   temperature-people → "2"  (온도사람들, 4 items)
 *   blog               → "3"  (블로그 — 이미 원본 success 섹션에 "3" 사용중; 충돌!)
 *   criteria           → "4"  (업체 선택기준, 4 items)
 *   medical-law        → "5"  (의료법, 3 items)
 *
 * blog 충돌 해결:
 *   - 원본 skin 의 #success 이후 `<div class="roo-banner-area" area_id="3">` 블록은
 *     깨진 template 구문(`{#img_1}` 을 banner_loop 내부에서 사용, 실제로는 작동 안함)
 *   - 원본 `area_id="3"` 블록을 그대로 두고, 내가 추가한 blog-focus 섹션의 area_id="blog"
 *     를 "3" 으로 변경 → 결과적으로 #blog-focus 섹션과 원본 success 섹션 둘 다 area 3 데이터 사용
 *   - 원본 success 섹션의 깨진 블록은 처리 단계에서 data-empty 가 아닌 no-op (items>0 라서
 *     banner_loop 만 반복) 하므로 깨지지 않는다.
 *
 * 실행: DATABASE_URL 로드 후 node scripts/phase4-remap-area-ids.js
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

async function run() {
  const [row] = await sql`
    SELECT id, content FROM site_files
    WHERE site_id = ${SITE_ID} AND filename = 'index.html'
  `;
  if (!row) {
    console.log('site_files index.html not found.');
    process.exit(1);
  }

  let html = row.content;
  const before = html.length;

  // 매핑
  const replacements = [
    { from: 'area_id="temperature-people"', to: 'area_id="2"' },
    { from: 'area_id="blog"', to: 'area_id="3"' },
    { from: 'area_id="criteria"', to: 'area_id="4"' },
    { from: 'area_id="medical-law"', to: 'area_id="5"' },
  ];

  for (const { from, to } of replacements) {
    const count = (html.match(new RegExp(from.replace(/"/g, '\\"'), 'g')) || []).length;
    html = html.split(from).join(to);
    console.log(`  ${from} → ${to}  (${count} replacements)`);
  }

  console.log(`Length ${before} → ${html.length}`);

  // 검증: 남아있는 의미적 area_id 가 있는지
  const leftovers = [...html.matchAll(/area_id="([^"]+)"/g)].map(m => m[1]);
  console.log('Final area_ids in HTML:', leftovers);

  await sql`UPDATE site_files SET content = ${html}, file_size = ${html.length}, updated_at = NOW() WHERE id = ${row.id}`;
  console.log('Saved site_files row', row.id);

  await sql.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
