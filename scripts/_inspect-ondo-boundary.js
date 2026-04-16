/**
 * index.html 의 헤더/본문/푸터 경계 파악.
 *  - DOCTYPE 부터 <body> 까지 = "head" 영역 (최종 header.html)
 *  - body 안: 사이트 상단 영역(로고/네비/CTA) 경계 찾기
 *  - 첫 <section> 시작 전까지 = 상단 바
 *  - 마지막 </section> 이후 ~ </body></html> = 하단 푸터 영역
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

async function run() {
  const [row] = await sql`SELECT content FROM web_skin_files WHERE skin_id = 4 AND filename = 'index.html'`;
  const html = row.content;

  // 1) 첫 <section ...> 의 시작 인덱스
  const firstSec = html.search(/<section\b/);
  // 2) 마지막 </section> 의 끝 인덱스
  const allSec = [...html.matchAll(/<\/section>/g)];
  const lastSecEnd = allSec.length ? allSec[allSec.length - 1].index + '</section>'.length : -1;
  // 3) </body> 시작 인덱스
  const bodyClose = html.indexOf('</body>');
  // 4) <body ...> 끝 인덱스
  const bodyOpenMatch = html.match(/<body\b[^>]*>/);
  const bodyOpenEnd = bodyOpenMatch ? bodyOpenMatch.index + bodyOpenMatch[0].length : -1;
  // 5) <head> 끝 인덱스
  const headCloseIdx = html.indexOf('</head>');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' ONDO index.html 구조 경계');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('전체 길이 : ' + html.length + 'b');
  console.log('<head> 끝  : ' + headCloseIdx);
  console.log('<body> 시작 (태그 뒤): ' + bodyOpenEnd);
  console.log('첫 <section>: ' + firstSec);
  console.log('마지막 </section> 끝: ' + lastSecEnd);
  console.log('</body> 시작: ' + bodyClose);

  console.log('\n[ 영역 A: DOCTYPE ~ <head> 끝 ] (' + (headCloseIdx + 7) + 'b)');
  console.log('-----------------------------------------------------');
  console.log(html.slice(0, headCloseIdx + 7).slice(0, 1500) + (headCloseIdx + 7 > 1500 ? '\n... [생략]' : ''));

  console.log('\n[ 영역 B: <body> 태그 ~ 첫 <section> 직전 ] (' + (firstSec - bodyOpenEnd) + 'b)');
  console.log('-----------------------------------------------------');
  console.log(html.slice(bodyOpenEnd, firstSec).trim());

  console.log('\n[ 영역 C: 마지막 </section> 끝 ~ </body> ] (' + (bodyClose - lastSecEnd) + 'b)');
  console.log('-----------------------------------------------------');
  console.log(html.slice(lastSecEnd, bodyClose).trim());

  await sql.end();
}
run().catch(e => { console.error(e); process.exit(1); });
