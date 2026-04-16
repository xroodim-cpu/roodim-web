/**
 * skin 내 submitForm() / openForm() 함수 정의 + 모달 마크업 덤프
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

async function run() {
  const [row] = await sql`
    SELECT content FROM site_files
    WHERE site_id = ${SITE_ID} AND filename = 'index.html'
  `;
  const html = row.content;

  // submitForm 정의 전체 덤프 (function submitForm 부터 다음 </script> 까지)
  const submitIdx = html.indexOf('function submitForm');
  if (submitIdx >= 0) {
    console.log('=== function submitForm() (from def to end of block) ===');
    // 중괄호 깊이로 함수 끝 찾기
    let depth = 0;
    let started = false;
    let end = submitIdx;
    for (let i = submitIdx; i < html.length; i++) {
      const c = html[i];
      if (c === '{') { depth++; started = true; }
      else if (c === '}') { depth--; if (started && depth === 0) { end = i + 1; break; } }
    }
    console.log(html.substring(submitIdx, Math.min(end, submitIdx + 2000)));
  }

  console.log('\n\n=== function openForm() ===');
  const openIdx = html.indexOf('function openForm');
  if (openIdx >= 0) {
    let depth = 0; let started = false; let end = openIdx;
    for (let i = openIdx; i < html.length; i++) {
      const c = html[i];
      if (c === '{') { depth++; started = true; }
      else if (c === '}') { depth--; if (started && depth === 0) { end = i + 1; break; } }
    }
    console.log(html.substring(openIdx, Math.min(end, openIdx + 800)));
  }

  // 모달 HTML (openForm 바로 위 영역)
  console.log('\n\n=== modal HTML (5000 chars before openForm definition) ===');
  const modalStart = Math.max(0, openIdx - 5000);
  console.log('...(', modalStart, ')');
  console.log(html.substring(modalStart, openIdx));

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
