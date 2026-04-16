/**
 * ONDO 스킨(skin_id=4)에서 실제 사용 중인 치환코드 전수조사.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

async function run() {
  const files = await sql`
    SELECT filename, length(content) AS len
    FROM web_skin_files WHERE skin_id = 4
    ORDER BY filename
  `;
  console.log('\n=== ONDO 스킨 파일 목록 ===');
  for (const f of files) console.log('  ' + f.filename + '  (' + f.len + 'b)');

  // 전체 합쳐서 치환코드 종류 카운트
  const all = await sql`
    SELECT filename, content FROM web_skin_files WHERE skin_id = 4
  `;

  const counts = {
    vars: new Map(),        // {{NAME}} -> count
    includes: new Map(),    // <!--@include("x")-->
    headerFooter: new Map(),// <!--@header--> 등
    bannerArea: new Map(),  // area_id="X"
    bannerLoop: 0,
    staffLoop: 0,
    bannerNumbered: new Map(), // {#img_1}, {#text_3} 등 → key="img", nums=Set
    bannerLoopInner: new Map(),// loop 내부 변수 {#img}, {#text} 등
    meta: new Map(),        // {#areaName} 등
    board: new Map(),       // <!--@qna_loop--> 등
    qnaInner: new Map(),    // {#qna_title} 등
  };

  for (const f of all) {
    const html = f.content || '';
    if (!f.content) { console.log('  [warn] ' + f.filename + ' content=null, skip'); continue; }

    // {{VAR}}
    for (const m of html.matchAll(/\{\{([A-Z_]+)\}\}/g)) {
      counts.vars.set(m[1], (counts.vars.get(m[1]) || 0) + 1);
    }
    // <!--@include("x")-->
    for (const m of html.matchAll(/<!--@include\("([^"]+)"\)-->/g)) {
      counts.includes.set(m[1], (counts.includes.get(m[1]) || 0) + 1);
    }
    // <!--@header--> / <!--@footer-->
    for (const m of html.matchAll(/<!--@(header|footer)-->/g)) {
      counts.headerFooter.set(m[1], (counts.headerFooter.get(m[1]) || 0) + 1);
    }
    // area_id
    for (const m of html.matchAll(/area_id="([^"]+)"/g)) {
      counts.bannerArea.set(m[1], (counts.bannerArea.get(m[1]) || 0) + 1);
    }
    // @banner_loop
    counts.bannerLoop += (html.match(/<!--@banner_loop-->/g) || []).length;
    // @staff_loop
    counts.staffLoop += (html.match(/<!--@staff_loop-->/g) || []).length;

    // {#img_N} 등 넘버링
    for (const m of html.matchAll(/\{#(img|text|link|video|target|title|html)_(\d+)(?:_or_video_\d+)?\}/g)) {
      const k = m[1];
      if (!counts.bannerNumbered.has(k)) counts.bannerNumbered.set(k, new Set());
      counts.bannerNumbered.get(k).add(Number(m[2]));
    }

    // 루프 내부 변수 {#img}, {#text} 등
    for (const m of html.matchAll(/\{#(img|text|link|video|target|title|html|num|displayType|img_or_video)\}/g)) {
      counts.bannerLoopInner.set(m[1], (counts.bannerLoopInner.get(m[1]) || 0) + 1);
    }

    // 영역 메타 {#areaName}
    for (const m of html.matchAll(/\{#(areaName|areaDesc|areaDisplayType)\}/g)) {
      counts.meta.set(m[1], (counts.meta.get(m[1]) || 0) + 1);
    }

    // 게시판 {#qna_*}
    for (const m of html.matchAll(/\{#qna_(title|content|num|author|date)\}/g)) {
      counts.qnaInner.set(m[1], (counts.qnaInner.get(m[1]) || 0) + 1);
    }
    for (const m of html.matchAll(/<!--@(inquiry_form|inquiry_list|qna_loop|end_qna_loop)-->/g)) {
      counts.board.set(m[1], (counts.board.get(m[1]) || 0) + 1);
    }
  }

  console.log('\n=== {{VAR}} 치환코드 (파일 전체 합산) ===');
  for (const [k, v] of [...counts.vars.entries()].sort()) console.log('  {{' + k + '}} ×' + v);

  console.log('\n=== <!--@header-->, <!--@footer--> ===');
  for (const [k, v] of counts.headerFooter) console.log('  <!--@' + k + '--> ×' + v);

  console.log('\n=== <!--@include("...")--> ===');
  for (const [k, v] of counts.includes) console.log('  ' + k + ' ×' + v);

  console.log('\n=== 배너영역 area_id 분포 ===');
  for (const [k, v] of [...counts.bannerArea.entries()].sort((a,b)=>Number(a[0])-Number(b[0]))) console.log('  area_id="' + k + '" ×' + v);

  console.log('\n=== 번호 기반 배너 치환코드 {#img_N} 등 (영역별 최대 num 파악용) ===');
  for (const [k, v] of counts.bannerNumbered) {
    const arr = [...v].sort((a,b)=>a-b);
    console.log('  {#' + k + '_N}  N ∈ {' + arr.join(', ') + '}');
  }

  console.log('\n=== 루프 내부 변수 ===');
  console.log('  <!--@banner_loop--> ×' + counts.bannerLoop);
  for (const [k, v] of counts.bannerLoopInner) console.log('  {#' + k + '} ×' + v);

  console.log('\n=== 영역 메타 ===');
  for (const [k, v] of counts.meta) console.log('  {#' + k + '} ×' + v);

  console.log('\n=== <!--@staff_loop--> ===');
  console.log('  횟수: ' + counts.staffLoop);

  console.log('\n=== 게시판 치환코드 ===');
  for (const [k, v] of counts.board) console.log('  <!--@' + k + '--> ×' + v);
  for (const [k, v] of counts.qnaInner) console.log('  {#qna_' + k + '} ×' + v);

  // 각 배너 area 별 실제 DB 데이터 상태도 뽑아보자
  console.log('\n=== banner_areas / banner_items (site_id of org-5) ===');
  const [site] = await sql`SELECT id, slug FROM sites WHERE slug = 'org-5' LIMIT 1`;
  if (site) {
    console.log('  site: ' + site.slug + ' (id=' + site.id + ')');
    const areas = await sql`
      SELECT id, area_id, area_name, display_type, is_active
      FROM banner_areas WHERE site_id = ${site.id}
      ORDER BY area_id
    `;
    for (const a of areas) {
      const items = await sql`
        SELECT id, num, title, img_url, text_content, link_url
        FROM banner_items WHERE area_id = ${a.id} AND is_active = true
        ORDER BY sort_order, num
      `;
      console.log(`  [area_id="${a.area_id}" "${a.area_name}"  type=${a.display_type}  active=${a.is_active}]`);
      for (const it of items) {
        const t = (it.text_content || '').replace(/\s+/g, ' ').slice(0, 40);
        const img = it.img_url ? '📷' : '  ';
        console.log(`    ${img} num=${it.num}  "${it.title || ''}"  ${t}`);
      }
      if (items.length === 0) console.log('      (비어있음)');
    }
  }

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
