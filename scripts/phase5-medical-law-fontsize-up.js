/**
 * #medical-law 카드 폰트 크기 상향.
 *
 * 사용자 요청: "각 카드의 폰트 크기를 조금 더 키워줘"
 *
 * 변경:
 *  - 데스크톱 h4: 24 → 28px
 *  - 데스크톱 p:  15 → 17px, line-height 1.7 → 1.75
 *  - 모바일  h4: 20 → 22px (기존 @media 블록 내 규칙 교체)
 *  - 모바일  p:  (없음) → 16px 신규 추가
 *
 * 대상: web_skin_files (skin_id=4, index.html)
 * 안전장치: idempotent, 기존 문자열 정확 매칭만
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

  // [1] 데스크톱 h4 — 24 → 28px
  const oldH4 = `.roo-law-card h4 { font-size: 24px; font-weight: 800; margin-bottom: 14px; line-height: 1.35; color: var(--text); text-align: left; }`;
  const newH4 = `.roo-law-card h4 { font-size: 28px; font-weight: 800; margin-bottom: 16px; line-height: 1.35; color: var(--text); text-align: left; }`;
  if (html.indexOf(newH4) >= 0) {
    console.log('[=] [1] 데스크톱 h4 이미 28px — skip');
  } else if (html.indexOf(oldH4) < 0) {
    console.log('[!] [1] 기존 h4 규칙 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldH4, newH4);
    console.log('[1] 데스크톱 h4: 24 → 28px, margin 14 → 16');
  }

  // [2] 데스크톱 p — 15 → 17px, line-height 1.7 → 1.75
  const oldP = `.roo-law-card p { font-size: 15px; line-height: 1.7; color: var(--text2); margin: 0; text-align: left; }`;
  const newP = `.roo-law-card p { font-size: 17px; line-height: 1.75; color: var(--text2); margin: 0; text-align: left; }`;
  if (html.indexOf(newP) >= 0) {
    console.log('[=] [2] 데스크톱 p 이미 17px — skip');
  } else if (html.indexOf(oldP) < 0) {
    console.log('[!] [2] 기존 p 규칙 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldP, newP);
    console.log('[2] 데스크톱 p: 15 → 17px, line-height 1.7 → 1.75');
  }

  // [3] 모바일 h4 — 20 → 22px, 그리고 같은 라인에 모바일 p 규칙 추가
  const oldMobileH4 = `.roo-law-card h4 { font-size: 20px; }`;
  const newMobileH4 = `.roo-law-card h4 { font-size: 22px; }
  .roo-law-card p { font-size: 16px; }`;
  if (html.indexOf(newMobileH4) >= 0) {
    console.log('[=] [3] 모바일 h4/p 이미 상향됨 — skip');
  } else if (html.indexOf(oldMobileH4) < 0) {
    console.log('[!] [3] 모바일 h4 규칙 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(oldMobileH4, newMobileH4);
    console.log('[3] 모바일 h4: 20 → 22px, 모바일 p 16px 신규 추가');
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
