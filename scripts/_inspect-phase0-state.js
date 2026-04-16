/**
 * Phase 0: 실행 전 DB 상태 스냅샷
 *  - ONDO 스킨(skin_id=4) 파일 목록 + font-size 분포
 *  - custom_domain 을 가진 sites 목록
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

function extractFontSizes(content) {
  const out = { inStyle: new Map(), inline: new Map() };
  if (!content) return out;

  // <style> 블록 안
  for (const sm of content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const styleBody = sm[1];
    for (const m of styleBody.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)) {
      const v = Number(m[1]);
      out.inStyle.set(v, (out.inStyle.get(v) || 0) + 1);
    }
  }
  // 인라인 style="... font-size:Xpx ..."
  for (const m of content.matchAll(/style\s*=\s*"[^"]*font-size\s*:\s*(\d+(?:\.\d+)?)px[^"]*"/gi)) {
    const v = Number(m[1]);
    out.inline.set(v, (out.inline.get(v) || 0) + 1);
  }
  // HTML 속성형 인라인 (single-quote)
  for (const m of content.matchAll(/style\s*=\s*'[^']*font-size\s*:\s*(\d+(?:\.\d+)?)px[^']*'/gi)) {
    const v = Number(m[1]);
    out.inline.set(v, (out.inline.get(v) || 0) + 1);
  }
  return out;
}

async function run() {
  console.log('=== ONDO 스킨(skin_id=4) 파일 ===');
  const files = await sql`SELECT id, filename, file_type, LENGTH(content) AS bytes FROM web_skin_files WHERE skin_id = 4 ORDER BY filename`;
  for (const f of files) {
    console.log(`  id=${f.id}  ${f.filename.padEnd(20)} type=${f.file_type}  bytes=${f.bytes}`);
  }

  console.log('\n=== font-size 분포 (px) ===');
  for (const f of files) {
    const [row] = await sql`SELECT content FROM web_skin_files WHERE id = ${f.id}`;
    const sizes = extractFontSizes(row.content);
    const styleEntries = [...sizes.inStyle.entries()].sort((a, b) => a[0] - b[0]);
    const inlineEntries = [...sizes.inline.entries()].sort((a, b) => a[0] - b[0]);
    const totalStyle = styleEntries.reduce((s, [, c]) => s + c, 0);
    const totalInline = inlineEntries.reduce((s, [, c]) => s + c, 0);
    console.log(`\n  [${f.filename}] <style>: ${totalStyle}건 / inline: ${totalInline}건`);
    if (styleEntries.length > 0) {
      console.log('    <style>:  ' + styleEntries.map(([v, c]) => `${v}px×${c}`).join(', '));
    }
    if (inlineEntries.length > 0) {
      console.log('    inline:   ' + inlineEntries.map(([v, c]) => `${v}px×${c}`).join(', '));
    }
  }

  console.log('\n=== custom_domain 등록된 사이트 ===');
  const domains = await sql`SELECT slug, name, custom_domain, status FROM sites WHERE custom_domain IS NOT NULL`;
  if (domains.length === 0) {
    console.log('  (없음)');
  } else {
    for (const d of domains) {
      console.log(`  ${d.slug.padEnd(15)}  ${d.custom_domain.padEnd(40)} status=${d.status}`);
    }
  }

  console.log('\n=== sites 테이블 컬럼 ===');
  const cols = await sql`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name LIKE '%domain%'
    ORDER BY ordinal_position
  `;
  for (const c of cols) {
    console.log(`  ${c.column_name.padEnd(25)} ${c.data_type}${c.character_maximum_length ? '(' + c.character_maximum_length + ')' : ''}`);
  }

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
