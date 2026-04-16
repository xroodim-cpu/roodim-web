/**
 * Phase 4 보정 #3: 원본 스킨의 하드코딩 masters JS 제거
 *
 * 문제:
 *   원본 스킨은 `#sliderTrack` 에 하드코딩된 마스터 8명을 JS 로 주입하는 IIFE 를 가지고 있다.
 *   이 IIFE 가 내 banner_loop 으로 렌더된 .ms-card 들을 `t.innerHTML = h + h` 로 덮어쓴다.
 *   결과: 배너 데이터 대신 모비/리민/델리아 등 하드코딩 마스터만 표시됨.
 *
 * 해결:
 *   해당 IIFE 블록(`// Masters - 대표는 상단 고정, 나머지만 슬라이드` 로 시작)을 통째로 삭제한다.
 *   삭제 후에도 기존 레이아웃은 유지되고, banner_loop 의 .ms-card 들이 그대로 슬라이드된다.
 *   내 roo-banner-scripts 가 무한 슬라이드 클론 + 애니메이션 처리를 담당한다.
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

  // 패턴: `// Masters - 대표는 상단 고정, 나머지만 슬라이드\n(function(){const t=document.getElementById('sliderTrack');...h+h})();`
  // IIFE 전체 매칭 — 주석 시작 + IIFE + 닫기 )();
  const pattern = /\/\/ Masters - 대표는 상단 고정, 나머지만 슬라이드[\s\S]*?t\.innerHTML=h\+h\}\)\(\);/;

  const match = html.match(pattern);
  if (!match) {
    console.log('[!] Masters IIFE pattern NOT found — 이미 제거되었거나 원본이 달라짐.');
    console.log('    body last 600 chars:');
    console.log(html.substring(html.length - 600));
    process.exit(0);
  }

  console.log('[1] Found Masters IIFE:', match[0].length, 'chars');
  html = html.replace(pattern, '// [Masters IIFE removed - replaced by banner_loop] ');
  console.log('[1] Removed.');
  console.log(`Length ${before} → ${html.length}`);

  await sql`UPDATE site_files SET content = ${html}, file_size = ${html.length}, updated_at = NOW() WHERE id = ${row.id}`;
  console.log('Saved site_files row', row.id);

  await sql.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
