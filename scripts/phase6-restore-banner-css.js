/**
 * 복구: 분리 시 누락된 두 번째 <style id="roo-banner-styles"> 블록을 header.html 의 </head> 앞에 삽입.
 *
 * 배경:
 *  - phase6-split-header-footer.js 는 원본 index.html 의 첫 번째 <style> 블록만 header.html 로 옮겼음.
 *  - 원본에는 <style id="roo-banner-styles"> (5744b, .roo-* 50개) 두 번째 블록이 있어서
 *    criteria-grid / law-cards / roo-slideshow / roo-grid-adaptive 등 배너 CSS 가 거기 있었음.
 *  - 이게 누락되어 현재 배너 레이아웃이 완전히 깨진 상태.
 *
 * 동작:
 *  1) site_configs.skin_backup_split_20260416 에서 원본 index.html 로부터
 *     두 번째 <style ...> ... </style> 블록을 뽑음.
 *  2) 현재 header.html 에 이미 포함돼있지 않으면 </head> 앞에 삽입.
 *  3) idempotent: 이미 있으면 skip.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

(async () => {
  // 1) 백업에서 두 번째 <style> 뽑기
  const [b] = await sql`SELECT data FROM site_configs WHERE site_id=${SITE_ID} AND section='skin_backup_split_20260416'`;
  const d = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
  const idx = d.index_html;
  const allStyles = [...idx.matchAll(/<style\b[\s\S]*?<\/style>/g)].map(m => m[0]);
  if (allStyles.length < 2) {
    console.log('[!] 백업에 <style> 블록이 2개 미만 — 복구 불필요');
    await sql.end(); return;
  }
  const bannerStyle = allStyles[1];
  console.log('[1] 백업에서 추출: 두 번째 <style> 블록', bannerStyle.length + 'b', '(.roo-* 셀렉터', (bannerStyle.match(/\.roo-[a-zA-Z_-]+/g) || []).length, '개)');

  // 2) 현재 header.html 로드
  const [headerFile] = await sql`SELECT id, content FROM web_skin_files WHERE skin_id=4 AND filename='header.html'`;
  if (!headerFile) { console.log('[!] header.html 없음'); process.exit(1); }
  const cur = headerFile.content;
  console.log('[2] 현재 header.html:', cur.length + 'b');

  // 3) idempotent
  if (cur.includes('id="roo-banner-styles"')) {
    console.log('[=] 이미 roo-banner-styles 포함 — skip');
    await sql.end(); return;
  }

  // 4) </head> 앞에 삽입
  const newHeader = cur.replace('</head>', bannerStyle + '\n</head>');
  if (newHeader === cur) { console.log('[!] </head> 못 찾음'); process.exit(1); }
  console.log('[3] 새 header.html:', newHeader.length + 'b', '(+' + (newHeader.length - cur.length) + 'b)');

  // 5) DB update
  await sql`UPDATE web_skin_files SET content = ${newHeader}, file_size = ${newHeader.length}, updated_at = NOW() WHERE id = ${headerFile.id}`;
  console.log('[ok] header.html 업데이트 완료');

  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
