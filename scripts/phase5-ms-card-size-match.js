/**
 * ms-card (슬라이드 배너) 크기를 ms-ceo (고정 1번 배너) 와 동일하게 맞춤.
 *
 * 현재 문제:
 *  - .ms-card 는 min-width: 260 만 지정, width 미지정 → 이미지 자연크기(600x800)대로 렌더 → 600x866
 *  - .ms-ceo 는 width: 280 (모바일 200) 으로 고정 → 280x448
 *  → 슬라이드 카드가 고정 1번 배너보다 2배 이상 큼
 *
 * 수정:
 *  [1] 데스크톱 .ms-card: width 280 고정 + ms-ceo 와 동일한 border-radius/background/border
 *  [2] 모바일 .ms-card: width 200 고정
 *  [3] .ms-card img: ms-ceo img 와 동일하게 object-position/filter 추가
 *  [4] .ms-card-name / .ms-card-text padding/font-size 를 ms-ceo 톤 (center, 16px) 에 맞춤
 *
 * 대상: web_skin_files (skin_id=4, index.html)
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

  // [1] 데스크톱 .ms-card 블록 — 280px 고정 + ms-ceo 와 동일한 디자인톤
  const oldDesktop = `.ms-card { min-width: 260px; flex-shrink: 0; border-radius: 12px; overflow: hidden; background: var(--bg2); }`;
  const newDesktop = `.ms-card { width: 280px; max-width: 280px; flex: 0 0 280px; border-radius: 20px; overflow: hidden; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); text-align: center; transition: all .4s; }
.ms-card:hover { transform: translateY(-6px); border-color: rgba(255,255,255,.15); box-shadow: 0 20px 50px rgba(0,0,0,.3); }`;
  if (html.indexOf(newDesktop) >= 0) {
    console.log('[=] [1] 데스크톱 .ms-card 이미 280 고정 — skip');
  } else if (html.indexOf(oldDesktop) < 0) {
    console.log('[!] 데스크톱 .ms-card 블록 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldDesktop, newDesktop);
    console.log('[1] .ms-card: min-width 260 → width 280 고정 + ms-ceo 톤');
  }

  // [2] .ms-card img — object-position/filter 를 ms-ceo img 와 동일하게
  const oldImg = `.ms-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; }`;
  const newImg = `.ms-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; object-position: center top; display: block; filter: brightness(.95) contrast(1.05); }`;
  if (html.indexOf(newImg) >= 0) {
    console.log('[=] [2] .ms-card img 이미 수정됨 — skip');
  } else if (html.indexOf(oldImg) < 0) {
    console.log('[!] .ms-card img 블록 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldImg, newImg);
    console.log('[2] .ms-card img: object-position/filter 추가 (ms-ceo 톤 맞춤)');
  }

  // [3] .ms-card-name — center 정렬 + font-size 16px (ms-ceo .mcn 과 동일)
  const oldName = `.ms-card-name { padding: 12px 16px 4px; font-weight: 700; font-size: 15px; }`;
  const newName = `.ms-card-name { padding: 16px 12px 6px; font-weight: 700; font-size: 16px; color: var(--text3); text-align: center; }`;
  if (html.indexOf(newName) >= 0) {
    console.log('[=] [3] .ms-card-name 이미 수정됨 — skip');
  } else if (html.indexOf(oldName) < 0) {
    console.log('[!] .ms-card-name 블록 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldName, newName);
    console.log('[3] .ms-card-name: center + 16px (ms-ceo .mcn 톤)');
  }

  // [4] .ms-card-text — padding/정렬 통일
  const oldText = `.ms-card-text { padding: 0 16px 16px; font-size: 13px; color: var(--text2); line-height: 1.6; }`;
  const newText = `.ms-card-text { padding: 0 12px 20px; font-size: 13px; color: var(--text2); line-height: 1.6; text-align: center; }`;
  if (html.indexOf(newText) >= 0) {
    console.log('[=] [4] .ms-card-text 이미 수정됨 — skip');
  } else if (html.indexOf(oldText) < 0) {
    console.log('[!] .ms-card-text 블록 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldText, newText);
    console.log('[4] .ms-card-text: padding/center 정렬');
  }

  // [5] 모바일 .ms-card — width 200 고정
  const oldMobile = `.ms-card { min-width: 200px; }`;
  const newMobile = `.ms-card { width: 200px; max-width: 200px; flex: 0 0 200px; min-width: 200px; }`;
  if (html.indexOf(newMobile) >= 0) {
    console.log('[=] [5] 모바일 .ms-card 이미 200 고정 — skip');
  } else if (html.indexOf(oldMobile) < 0) {
    console.log('[!] 모바일 .ms-card 블록 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldMobile, newMobile);
    console.log('[5] 모바일 .ms-card: width 200 고정');
  }

  if (html.length === before) {
    console.log('[=] 변경 없음');
    await sql.end(); return;
  }

  await sql`
    UPDATE web_skin_files
    SET content = ${html}, file_size = ${html.length}, updated_at = NOW()
    WHERE id = ${row.id}
  `;
  console.log('[ok] web_skin_files.id=' + row.id + ' saved (' + before + ' → ' + html.length + ' bytes, +' + (html.length - before) + 'b)');
  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
