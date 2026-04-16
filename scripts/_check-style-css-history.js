/**
 * style.css 가 원래 어떤 내용이었는지 간단 확인 + 현재 응답 200 여부.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

(async () => {
  const [s] = await sql`SELECT id, filename, file_size, LEFT(content, 400) as head, created_at, updated_at FROM web_skin_files WHERE skin_id=4 AND filename='style.css'`;
  console.log('style.css 현재:');
  console.log('  id=', s.id, 'size=', s.file_size, 'b');
  console.log('  created:', s.created_at);
  console.log('  updated:', s.updated_at);
  console.log('  head 400b:', s.head.replace(/\n/g,'\n').slice(0, 300));

  // 다른 스킨에 style.css 가 있는지 — 참고용
  const others = await sql`SELECT skin_id, filename, file_size FROM web_skin_files WHERE filename='style.css' AND skin_id != 4 LIMIT 5`;
  console.log('\n타 스킨 style.css:', others);

  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
