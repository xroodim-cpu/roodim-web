/**
 * 방금 전송된 문의게시판 글을 조회해서 저장 포맷 검증.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

async function run() {
  const rows = await sql`
    SELECT p.id, p.title, p.author_name, p.author_phone, p.author_email,
           p.form_data, p.created_at,
           LEFT(p.content, 800) AS content_preview,
           b.name AS board_name, b.system_key
    FROM board_posts p
    JOIN boards b ON b.id = p.board_id
    WHERE b.system_key = 'inquiry'
    ORDER BY p.created_at DESC
    LIMIT 3
  `;
  console.log('최근 문의글', rows.length, '건');
  rows.forEach((r, i) => {
    console.log('\n[' + i + '] id=' + r.id + '  board=' + r.board_name);
    console.log('  title:', r.title);
    console.log('  author:', r.author_name, '|', r.author_phone, '|', r.author_email);
    console.log('  formData keys:', Object.keys(r.form_data || {}));
    console.log('  formData:', JSON.stringify(r.form_data, null, 2).substring(0, 400));
    console.log('  content preview:', r.content_preview.substring(0, 400));
    console.log('  created:', r.created_at);
  });
  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
