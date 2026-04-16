/**
 * 현재 header.html 의 <style> 블록 2개를 raw 텍스트로 확인.
 * 모바일 .roo-law-card column 규칙의 정확한 위치/문자열 파악.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

(async () => {
  const [f] = await sql`SELECT content FROM web_skin_files WHERE skin_id=4 AND filename='header.html'`;
  const c = f.content;
  const styles = [...c.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)];
  console.log('header.html 길이:', c.length);
  console.log('<style> 개수:', styles.length);
  for (let i = 0; i < styles.length; i++) {
    const s = styles[i][0];
    console.log(`\n[${i}] 시작 offset=${styles[i].index}, 길이=${s.length}`);
    console.log(`   첫 50b: ${s.slice(0, 50)}`);
    console.log(`   마지막 50b: ${s.slice(-50)}`);
  }

  // .roo-law-card 의 flex-direction column 부분 검색
  const mobileCol = c.match(/\.roo-law-card[^}]*?flex-direction:\s*column[^;}]*/g);
  console.log('\n.roo-law-card + flex-direction: column 매치:', mobileCol);

  // 더 정확히: column 규칙이 있는 블록 전체 추출
  const lawColBlock = c.match(/\.roo-law-card[^{]*,[^{]*\.roo-law-card:nth-child\(even\)\s*\{[^}]*flex-direction:\s*column[^}]*\}/);
  console.log('\n.roo-law-card 모바일 블록:');
  console.log(lawColBlock?.[0]);

  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
