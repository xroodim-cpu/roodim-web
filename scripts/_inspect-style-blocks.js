/**
 * 백업 원본에 <style> 블록이 몇 개 있었는지, 각각 어떤 내용인지 확인.
 * 현재 header.html 에는 1개만 들어가 있는데, 원본에 더 있었을 가능성.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';

(async () => {
  const [b] = await sql`SELECT data FROM site_configs WHERE site_id=${SITE_ID} AND section='skin_backup_split_20260416'`;
  const d = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
  const idx = d.index_html;

  const allStyles = [...idx.matchAll(/<style\b[\s\S]*?<\/style>/g)];
  console.log('백업 원본 <style> 블록 개수:', allStyles.length);
  for (let i = 0; i < allStyles.length; i++) {
    const s = allStyles[i][0];
    const rooCount = (s.match(/\.roo-[a-zA-Z_-]+/g) || []).length;
    console.log(`\n[${i}] ${s.length}b  .roo-* 셀렉터 ${rooCount}개`);
    console.log(`   처음 200b: ${s.slice(0, 200).replace(/\n/g,'\n')}`);
    console.log(`   마지막 200b: ${s.slice(-200).replace(/\n/g,'\n')}`);
  }

  // 이 style 블록들의 위치
  console.log('\n각 <style> 위치:');
  for (const m of allStyles) console.log('  offset=', m.index, ' (head=' + (m.index < idx.indexOf('</head>') ? 'in' : 'out') + ')');

  // style.css 파일은 따로 있는지?
  const styleCssFile = await sql`SELECT filename, content FROM web_skin_files WHERE skin_id=4 AND filename LIKE '%style%'`;
  console.log('\nstyle.css 파일 존재:', styleCssFile.length ? styleCssFile.map(f => f.filename + ' (' + f.content.length + 'b)') : '없음');

  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
