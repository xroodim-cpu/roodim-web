/**
 * openForm 앞 모달 HTML 전체 덤프.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

async function run() {
  const [row] = await sql`SELECT content FROM site_files WHERE site_id = ${SITE_ID} AND filename = 'index.html'`;
  const html = row.content;

  const overlayStart = html.indexOf('id="formOverlay"');
  if (overlayStart < 0) { console.log('formOverlay not found'); await sql.end(); return; }
  // back up to the opening <
  let open = overlayStart;
  while (open > 0 && html[open] !== '<') open--;

  // forward until "f-memo" or "f-phone" input section ends  (closing </div> block ~3000 chars enough)
  const chunk = html.substring(open, open + 5000);
  console.log(chunk);
  console.log('\n---(end chunk 5000)---');

  await sql.end();
}
run().catch(e => { console.error(e); process.exit(1); });
