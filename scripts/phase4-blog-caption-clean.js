/**
 * blog-focus 섹션 — caption 제거 + 이미지 비율 그대로 + 둥글기 제거.
 *
 * 사용자 요청:
 *  - <div class="roo-grid-caption"></div> (타이틀/여백) 제거
 *  - 이미지 비율 그대로 (aspect-ratio 16:10 고정 해제 → 원본 비율)
 *  - object-fit cover 해제 (짤림 없이)
 *  - border-radius 제거 (둥글기 없이)
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

const SKIN_ID = 4;

async function run() {
  const [row] = await sql`
    SELECT id, content FROM web_skin_files
    WHERE skin_id = ${SKIN_ID} AND filename = 'index.html'
  `;
  if (!row) { console.log('[!] not found'); process.exit(1); }

  let html = row.content;
  const before = html.length;

  // [1] HTML: banner_loop 템플릿에서 caption 제거
  const oldTpl = `<!--@banner_loop-->
<div class="roo-grid-item"><a href="{#link}" target="{#target}"><img src="{#img}" alt="{#title}" loading="lazy"><div class="roo-grid-caption">{#title}</div></a></div>
<!--@end_banner_loop-->`;
  const newTpl = `<!--@banner_loop-->
<div class="roo-grid-item"><a href="{#link}" target="{#target}"><img src="{#img}" alt="{#title}" loading="lazy"></a></div>
<!--@end_banner_loop-->`;
  if (html.indexOf(oldTpl) >= 0) {
    html = html.replace(oldTpl, newTpl);
    console.log('[1] banner_loop 템플릿에서 roo-grid-caption 제거');
  } else if (html.indexOf('<div class="roo-grid-caption">') < 0 || html.indexOf('roo-grid-caption">{#title}') < 0) {
    console.log('[=] caption 이미 제거됨 — skip');
  } else {
    console.log('[!] 예상 caption 패턴 찾지 못함'); process.exit(1);
  }

  // [2] .roo-grid-item CSS — border-radius, background 제거
  const oldItemCss = `.roo-grid-item { border-radius: 12px; overflow: hidden; background: var(--bg2); transition: transform .3s; }`;
  const newItemCss = `.roo-grid-item { transition: transform .3s; }`;
  if (html.indexOf(oldItemCss) >= 0) {
    html = html.replace(oldItemCss, newItemCss);
    console.log('[2] .roo-grid-item: border-radius/background/overflow 제거');
  } else {
    console.log('[=] .roo-grid-item CSS 이미 수정됨 — skip');
  }

  // [3] .roo-grid-item img — aspect-ratio, object-fit 제거, display block
  const oldImgCss = `.roo-grid-item img { width: 100%; aspect-ratio: 16/10; object-fit: cover; }`;
  const newImgCss = `.roo-grid-item img { width: 100%; height: auto; display: block; }`;
  if (html.indexOf(oldImgCss) >= 0) {
    html = html.replace(oldImgCss, newImgCss);
    console.log('[3] .roo-grid-item img: aspect-ratio/object-fit 제거 → 원본 비율');
  } else {
    console.log('[=] .roo-grid-item img CSS 이미 수정됨 — skip');
  }

  // [4] .roo-grid-caption CSS 블록 제거
  const oldCapCss = `.roo-grid-caption { padding: 12px 14px; font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4; }\n`;
  if (html.indexOf(oldCapCss) >= 0) {
    html = html.replace(oldCapCss, '');
    console.log('[4] .roo-grid-caption CSS 블록 제거');
  } else {
    console.log('[=] .roo-grid-caption CSS 이미 제거됨 — skip');
  }

  if (html.length === before) { console.log('[=] 변경 없음'); await sql.end(); return; }

  await sql`
    UPDATE web_skin_files
    SET content = ${html}, file_size = ${html.length}, updated_at = NOW()
    WHERE id = ${row.id}
  `;
  console.log('[ok] web_skin_files.id=' + row.id + ' saved (' + before + ' → ' + html.length + ' bytes)');
  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
