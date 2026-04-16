/**
 * 폼 옵션 채우기 JS (f-visit/f-dept/f-svc) 찾기.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

async function run() {
  const [row] = await sql`SELECT content FROM site_files WHERE site_id = ${SITE_ID} AND filename = 'index.html'`;
  const html = row.content;

  // `f-visit` 이후 700자 + `f-dept` 이후 700자 + `f-svc` 이후 700자
  ['f-visit','f-dept','f-svc'].forEach(id => {
    // 초기화 JS 검색 (getElementById('f-visit') 이후 코드)
    const pattern = new RegExp("getElementById\\('" + id + "'\\)", 'g');
    const matches = [];
    let m;
    while ((m = pattern.exec(html)) !== null) {
      matches.push(m.index);
      if (matches.length >= 5) break;
    }
    console.log('\n=== ' + id + ' getElementById matches: ' + matches.length + ' ===');
    matches.forEach(idx => {
      console.log('-- at', idx, ':');
      console.log(html.substring(idx, idx + 500).replace(/\n/g, '\\n'));
    });
  });

  // closeForm 함수도 확인
  console.log('\n=== closeForm ===');
  const close = html.indexOf('function closeForm');
  if (close >= 0) console.log(html.substring(close, close + 400));

  await sql.end();
}
run().catch(e => { console.error(e); process.exit(1); });
