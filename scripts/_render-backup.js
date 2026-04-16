/**
 * 백업된 원본 index.html 을 임시로 web_skin_files 에 넣어서 /org-5 를 렌더해본다.
 * 단, DB 를 변경하지 않고, 단순히 백업 원본 HTML 을 파일로 추출해서 직접 읽기.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';
const fs = require('fs');

(async () => {
  const [b] = await sql`SELECT data FROM site_configs WHERE site_id=${SITE_ID} AND section='skin_backup_split_20260416'`;
  const data = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
  const outPath = (process.env.TEMP || '.') + '\\backup-index.html';
  fs.writeFileSync(outPath, data.index_html);
  console.log('백업 원본 저장:', outPath, data.index_html.length + 'b');

  // 백업 원본에서 area_id=4,5 블록 그대로 뽑기 (리팩토링 전 모습)
  const idx = data.index_html;
  const a4Start = idx.search(/<div[^>]*area_id="4"/);
  const a4End = idx.indexOf('</div>', idx.indexOf('<section', a4Start + 1) - 100) + 6;
  const a5Start = idx.search(/<div[^>]*area_id="5"/);
  const a5End = idx.indexOf('</section>', a5Start);

  console.log('\n═══ 백업 원본 area_id="4" (리팩토링 전) ═══');
  console.log(idx.slice(a4Start, idx.indexOf('</section>', a4Start)).slice(0, 2000));

  console.log('\n═══ 백업 원본 area_id="5" ═══');
  console.log(idx.slice(a5Start, a5End).slice(0, 2500));

  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
