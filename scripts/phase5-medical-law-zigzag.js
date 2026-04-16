/**
 * #medical-law 섹션 배너(area_id=5) 지그재그 레이아웃.
 *
 * 사용자 요청:
 *  - 데스크톱: 1번 배너 이미지 좌/글자 우, 2번 이미지 우/글자 좌 — 지그재그
 *  - 모바일: 이미지 위 / 글자 아래 (세로 배치)
 *
 * 구현:
 *  [1] HTML: 각 .roo-law-card 내부의 <h4>/<p> 를 <div class="roo-law-text"> 로 감쌈
 *  [2] HTML: .roo-banner-area 의 inline style="grid-template-columns:repeat(3,1fr)" 제거
 *  [3] CSS: .roo-law-card { flex, align-items } + :nth-child(even) { flex-direction: row-reverse }
 *  [4] CSS @media 768: .roo-criteria-grid 와 분리하고 .roo-law-card 모바일 column 규칙 추가
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

  // [1-A] HTML: 배너영역 inline grid 3열 제거 (1열 풀와이드로)
  const oldAreaTag = `<div class="roo-banner-area roo-law-cards pg sg" area_id="5" style="grid-template-columns:repeat(3,1fr)">`;
  const newAreaTag = `<div class="roo-banner-area roo-law-cards pg sg" area_id="5">`;
  if (html.indexOf(newAreaTag) >= 0 && html.indexOf(oldAreaTag) < 0) {
    console.log('[=] [1-A] area 태그 이미 수정됨 — skip');
  } else if (html.indexOf(oldAreaTag) < 0) {
    console.log('[!] [1-A] area 태그 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldAreaTag, newAreaTag);
    console.log('[1-A] area inline grid 3열 제거');
  }

  // [1-B] HTML: 3개 카드의 h4/p 를 .roo-law-text 로 감쌈
  for (let i = 1; i <= 3; i++) {
    const oldCard = `<div class="pc roo-law-card"><div class="roo-law-img"><img src="{#img_${i}}" alt="{#title_${i}}" loading="lazy"></div><h4>{#title_${i}}</h4><p>{#text_${i}}</p></div>`;
    const newCard = `<div class="pc roo-law-card"><div class="roo-law-img"><img src="{#img_${i}}" alt="{#title_${i}}" loading="lazy"></div><div class="roo-law-text"><h4>{#title_${i}}</h4><p>{#text_${i}}</p></div></div>`;
    if (html.indexOf(newCard) >= 0) {
      console.log('[=] [1-B] 카드 ' + i + ' 이미 .roo-law-text 래핑 — skip');
      continue;
    }
    if (html.indexOf(oldCard) < 0) {
      console.log('[!] [1-B] 카드 ' + i + ' 원본 찾지 못함'); process.exit(1);
    }
    html = html.replace(oldCard, newCard);
    console.log('[1-B] 카드 ' + i + ' h4/p 를 .roo-law-text 로 래핑');
  }

  // [2] CSS: 지그재그 레이아웃 — .roo-law-card .icon 규칙 뒤에 삽입
  const cssAnchor = `.roo-law-card .icon { display: none; }`;
  const cssBlock = `
/* === MEDICAL-LAW 지그재그 카드 (데스크톱 좌우 반전, 모바일 세로) === */
.roo-law-cards { display: grid !important; grid-template-columns: 1fr !important; gap: 64px !important; max-width: 1100px; margin-left: auto; margin-right: auto; }
.roo-law-card { display: flex; align-items: center; gap: 48px; background: transparent; border: none; padding: 0; text-align: left; }
.roo-law-card:nth-child(even) { flex-direction: row-reverse; }
.roo-law-card .roo-law-img { flex: 0 0 48%; aspect-ratio: 16/10; margin-bottom: 0; border-radius: 14px; overflow: hidden; }
.roo-law-card .roo-law-text { flex: 1; min-width: 0; }
.roo-law-card h4 { font-size: 24px; font-weight: 800; margin-bottom: 14px; line-height: 1.35; color: var(--text); text-align: left; }
.roo-law-card p { font-size: 15px; line-height: 1.7; color: var(--text2); margin: 0; text-align: left; }`;
  if (html.indexOf('MEDICAL-LAW 지그재그') >= 0) {
    console.log('[=] [2] 지그재그 CSS 이미 삽입됨 — skip');
  } else if (html.indexOf(cssAnchor) < 0) {
    console.log('[!] [2] CSS anchor 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(cssAnchor, cssAnchor + cssBlock);
    console.log('[2] 지그재그 CSS 삽입');
  }

  // [3] CSS: @media 768 에서 .roo-criteria-grid 와 .roo-law-cards 분리
  //     (roo-law-cards 는 이미 풀와이드이므로 이 규칙에서 제거, 대신 .roo-law-card 세로 배치 규칙 삽입)
  const oldMedia = `.roo-criteria-grid, .roo-law-cards { grid-template-columns: 1fr 1fr !important; }`;
  const newMedia = `.roo-criteria-grid { grid-template-columns: 1fr 1fr !important; }
  .roo-law-cards { gap: 48px !important; }
  .roo-law-card, .roo-law-card:nth-child(even) { flex-direction: column; gap: 16px; align-items: stretch; }
  .roo-law-card .roo-law-img { flex: none; width: 100%; }
  .roo-law-card h4 { font-size: 20px; }`;
  if (html.indexOf('.roo-law-card, .roo-law-card:nth-child(even) { flex-direction: column') >= 0) {
    console.log('[=] [3] 모바일 column 규칙 이미 적용됨 — skip');
  } else if (html.indexOf(oldMedia) < 0) {
    console.log('[!] [3] 기존 media 규칙 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldMedia, newMedia);
    console.log('[3] @media 768: roo-criteria-grid 분리 + .roo-law-card 세로 규칙 추가');
  }

  if (html.length === before) {
    console.log('[=] 변경 없음'); await sql.end(); return;
  }

  await sql`
    UPDATE web_skin_files
    SET content = ${html}, file_size = ${html.length}, updated_at = NOW()
    WHERE id = ${row.id}
  `;
  const delta = html.length - before;
  console.log('[ok] web_skin_files.id=' + row.id + ' saved (' + before + ' → ' + html.length + ' bytes, ' + (delta >= 0 ? '+' : '') + delta + 'b)');
  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
