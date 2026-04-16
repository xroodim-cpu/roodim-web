/**
 * Phase 4 보정: ms 섹션의 "고정 1번 배너(손호재 대표)" 처리
 *
 * 기존 site_files HTML 상태:
 *   - .ms-ceo 에 손호재 이미지가 "하드코딩" 되어 있음 (ai.roodim.com/ONDO/1.jpg)
 *   - .ms-slider(area_id="temperature-people") 의 banner_loop 은 "모든" 배너를 출력
 *   → 결과: 1번 배너(손호재)가 ms-ceo + 슬라이더에 "중복" 표시됨
 *
 * 보정 내용:
 *   1) .ms-ceo 전체를 roo-banner-area(area_id="temperature-people") 로 래핑
 *      → 하드코딩 된 이미지/텍스트를 {#img_1} / {#title_1} 로 치환
 *      → 배너 영역 #1 이 없으면 data-empty="1" 로 숨김 처리되어 손호재 영역만 자동 non-display
 *   2) 기존 슬라이더에서는 data-num="1" 을 CSS 로 숨김 (#ms-slider 내 고정 배너 중복 방지)
 *   3) 전체 section#ms 는 비어 있는 경우 hide 되도록 rs:has 규칙 이미 존재
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
    console.log('site_files index.html not found — run phase4-skin-modify.js first.');
    process.exit(1);
  }

  let html = row.content;
  console.log('Before length:', html.length);

  // ── 1. .ms-ceo 하드코딩 이미지/이름 → 배너 #1 치환코드로 변경 + banner-area 래핑
  const oldCeo =
    '<div class="ms-ceo rv"><img src="https://ai.roodim.com/ONDO/1.jpg" alt="손호재 대표" loading="lazy"><div class="mcn">손호재 대표</div></div>';

  const newCeo = `<div class="ms-ceo rv roo-banner-area roo-ceo-area" area_id="temperature-people"><img src="{#img_1}" alt="{#title_1}" loading="lazy"><div class="mcn">{#title_1}</div></div>`;

  if (html.includes(oldCeo)) {
    html = html.replace(oldCeo, newCeo);
    console.log('[1] Replaced .ms-ceo with banner-area #1 placeholders');
  } else if (!html.includes('roo-ceo-area')) {
    console.log('[1] Could not find .ms-ceo hardcoded markup AND no roo-ceo-area yet — please inspect manually.');
  } else {
    console.log('[1] .ms-ceo already using banner-area placeholders — skip');
  }

  // ── 2. CSS: 슬라이더의 data-num="1" 숨김 + ms-ceo 스타일 보정
  const oldCssMarker = '/* ── 슬라이더 (ms section) ── */';
  const slideHideRule = `/* 1번 배너는 ms-ceo 에서 전용 출력 → 슬라이더에서는 제외 */
.mst .ms-card.roo-slide[data-num="1"] { display: none !important; }
/* 1번 배너 전용 고정 영역 */
.roo-ceo-area img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 12px; }
.roo-ceo-area .mcn { margin-top: 12px; font-weight: 700; font-size: 16px; text-align: center; }
`;
  if (!html.includes('roo-slide[data-num="1"]')) {
    html = html.replace(oldCssMarker, slideHideRule + '\n' + oldCssMarker);
    console.log('[2] Inserted CSS: hide .roo-slide[data-num="1"] + .roo-ceo-area polish');
  } else {
    console.log('[2] CSS hide rule already present — skip');
  }

  console.log('After length:', html.length);

  await sql`UPDATE site_files SET content = ${html}, file_size = ${html.length}, updated_at = NOW() WHERE id = ${row.id}`;
  console.log('Saved site_files row', row.id);

  await sql.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
