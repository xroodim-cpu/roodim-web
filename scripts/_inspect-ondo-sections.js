/**
 * ONDO index.html 구조 파악.
 *  - 각 section 의 id/class 뽑기
 *  - 각 section 내부에서 사용된 치환코드 요약
 *  - area_id 가 어느 section 에 속해있는지 매핑
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

async function run() {
  const [row] = await sql`SELECT content FROM web_skin_files WHERE skin_id = 4 AND filename = 'index.html'`;
  const html = row.content;

  // <section ... id="..."> 블록만 잘라서 치환코드 요약
  const sectionRegex = /<section\b([^>]*)>([\s\S]*?)<\/section>/g;
  let idx = 0;
  for (const m of html.matchAll(sectionRegex)) {
    idx++;
    const attrs = m[1];
    const body = m[2];

    const idMatch = attrs.match(/\bid="([^"]*)"/);
    const classMatch = attrs.match(/\bclass="([^"]*)"/);
    const id = idMatch ? idMatch[1] : '(no-id)';
    const cls = classMatch ? classMatch[1] : '';

    // 치환코드 요약
    const tokens = new Set();
    for (const t of body.matchAll(/\{\{([A-Z_]+)\}\}/g)) tokens.add('{{' + t[1] + '}}');
    for (const t of body.matchAll(/area_id="([^"]+)"/g)) tokens.add('area_id="' + t[1] + '"');
    for (const t of body.matchAll(/\{#([a-zA-Z_0-9]+)\}/g)) tokens.add('{#' + t[1] + '}');
    if (/<!--@banner_loop-->/.test(body)) tokens.add('<!--@banner_loop-->');
    if (/<!--@staff_loop-->/.test(body)) tokens.add('<!--@staff_loop-->');
    if (/<!--@header-->/.test(body)) tokens.add('<!--@header-->');
    if (/<!--@footer-->/.test(body)) tokens.add('<!--@footer-->');

    // 내부 h2/h1 첫 번째 텍스트 (요약용)
    const titleMatch = body.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 30) : '';

    console.log(`\n[section #${idx}] id="${id}"  class="${cls}"`);
    if (title) console.log('  ∙ 제목: ' + title);
    if (tokens.size === 0) console.log('  ∙ (치환코드 없음)');
    else for (const t of tokens) console.log('  ∙ ' + t);
  }

  // <section> 밖에 남아있는 치환코드 (header/footer/body 직하위)
  console.log('\n=== <section> 외곽 (body/header/footer 직하위) ===');
  let outerHtml = html;
  // section 블록 제거
  outerHtml = outerHtml.replace(/<section\b[^>]*>[\s\S]*?<\/section>/g, '');
  const outerTokens = new Set();
  for (const t of outerHtml.matchAll(/\{\{([A-Z_]+)\}\}/g)) outerTokens.add('{{' + t[1] + '}}');
  for (const t of outerHtml.matchAll(/area_id="([^"]+)"/g)) outerTokens.add('area_id="' + t[1] + '"');
  for (const t of outerHtml.matchAll(/\{#([a-zA-Z_0-9]+)\}/g)) outerTokens.add('{#' + t[1] + '}');
  for (const t of outerTokens) console.log('  ∙ ' + t);
  if (outerTokens.size === 0) console.log('  ∙ (없음)');

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
