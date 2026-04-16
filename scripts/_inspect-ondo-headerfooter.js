/**
 * header.html / footer.html 도 치환코드 사용 여부 확인 + index.html 의 header/footer 인라인 부분 비교.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

async function run() {
  const files = await sql`SELECT filename, content FROM web_skin_files WHERE skin_id = 4 AND filename IN ('header.html', 'footer.html', 'main.js')`;
  for (const f of files) {
    if (!f.content) { console.log('\n=== ' + f.filename + ' (NULL) ==='); continue; }
    console.log('\n=== ' + f.filename + ' (' + f.content.length + 'b) ===');
    console.log(f.content);
  }
  await sql.end();
}
run().catch(e => { console.error(e); process.exit(1); });
