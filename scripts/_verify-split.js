/**
 * 분리 후 상태 검증:
 *  - web_skin_files: index/header/footer 각각의 길이 & 선두 표식
 *  - site_configs: base(회사정보) / seo(robots 포함) 조회
 *  - 원본 백업 존재 확인 (section=skin_backup_split_20260416)
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

(async () => {
  const files = await sql`SELECT filename, file_size, LEFT(content, 80) as head FROM web_skin_files WHERE skin_id = 4 AND filename IN ('index.html','header.html','footer.html') ORDER BY filename`;
  console.log('=== web_skin_files ===');
  for (const f of files) console.log(`${f.filename.padEnd(14)} size=${String(f.file_size).padStart(6)}b  head="${f.head.replace(/\n/g,'\n').slice(0,60)}..."`);

  const base = await sql`SELECT data FROM site_configs WHERE site_id = ${SITE_ID} AND section = 'base'`;
  const seo = await sql`SELECT data FROM site_configs WHERE site_id = ${SITE_ID} AND section = 'seo'`;
  const backup = await sql`SELECT section, updated_at FROM site_configs WHERE site_id = ${SITE_ID} AND section = 'skin_backup_split_20260416'`;

  console.log('\n=== site_configs.base (회사정보) ===');
  console.log(JSON.stringify(base[0]?.data || null, null, 2));
  console.log('\n=== site_configs.seo ===');
  console.log(JSON.stringify(seo[0]?.data || null, null, 2));
  console.log('\n=== 원본 백업 ===');
  console.log(backup[0] ? `section=${backup[0].section}  updated=${backup[0].updated_at}` : '(없음)');

  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
