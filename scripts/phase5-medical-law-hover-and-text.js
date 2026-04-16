/**
 * medical-law 카드 — hover 배경 제거 + 작은 문구(text_content) 채우기.
 *
 * 사용자 요청:
 *  - hover 시 배경 색/테두리/트랜스폼 전부 삭제 (현재는 .pc:hover 가 상속되어 나타남)
 *  - 이전 코드에 있던 아래 3개 문구를 배너 아이템 text_content 에 채워
 *    <p>{#text_N}</p> 부분에 노출되도록
 *
 * 구현:
 *  [1] web_skin_files(skin_id=4, index.html) CSS 에 .roo-law-card:hover 오버라이드 추가
 *      (다른 .pc 계열 카드들의 hover 효과는 그대로 유지)
 *  [2] banner_items (area_id=12 = 의료법) id 17/18/19 의 text_content UPDATE
 *
 * 안전장치:
 *  - 기존 .pc:hover 는 건드리지 않음 (다른 섹션에서 공유됨)
 *  - idempotent: 동일 내용이면 skip
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

const SKIN_ID = 4;

const TEXTS = {
  17: '어느 날 갑자기 날아오는 "의료법 위반 통지서"<br>답답하고 화가납니다.',
  18: '의료문제로 1~100까지 신고하는 경쟁병원,<br>피해갈 수 없습니다.',
  19: '현재 업체의 대응 문제로 "영업정지 및 과태료"<br>고스란히 원장님의 몫입니다.',
};

async function run() {
  // ───────────────────────────────────────────────
  // [1] hover 오버라이드 CSS 추가
  // ───────────────────────────────────────────────
  const [row] = await sql`
    SELECT id, content FROM web_skin_files
    WHERE skin_id = ${SKIN_ID} AND filename = 'index.html'
  `;
  if (!row) { console.log('[!] skin file not found'); process.exit(1); }

  let html = row.content;
  const before = html.length;

  const anchor = `.roo-law-card p { font-size: 15px; line-height: 1.7; color: var(--text2); margin: 0; text-align: left; }`;
  const hoverBlock = `
.roo-law-card:hover { background: transparent !important; border-color: transparent !important; transform: none !important; box-shadow: none !important; }`;
  if (html.indexOf('.roo-law-card:hover') >= 0) {
    console.log('[=] [1] .roo-law-card:hover 오버라이드 이미 존재 — skip CSS');
  } else if (html.indexOf(anchor) < 0) {
    console.log('[!] [1] CSS anchor 찾지 못함'); process.exit(1);
  } else {
    html = html.replace(anchor, anchor + hoverBlock);
    console.log('[1] .roo-law-card:hover 배경/테두리/트랜스폼 리셋 추가');
  }

  if (html.length !== before) {
    await sql`
      UPDATE web_skin_files
      SET content = ${html}, file_size = ${html.length}, updated_at = NOW()
      WHERE id = ${row.id}
    `;
    console.log('[ok] web_skin_files.id=' + row.id + ' saved (' + before + ' → ' + html.length + ' bytes)');
  }

  // ───────────────────────────────────────────────
  // [2] banner_items text_content UPDATE
  // ───────────────────────────────────────────────
  for (const [id, text] of Object.entries(TEXTS)) {
    const [current] = await sql`SELECT text_content FROM banner_items WHERE id = ${Number(id)}`;
    if (!current) { console.log('[!] banner_items id=' + id + ' 없음 — skip'); continue; }
    if (current.text_content === text) {
      console.log('  [=] id=' + id + ' text 동일 — skip');
      continue;
    }
    await sql`UPDATE banner_items SET text_content = ${text}, updated_at = NOW() WHERE id = ${Number(id)}`;
    console.log('  [+] id=' + id + ' text_content 업데이트 (' + (current.text_content?.length || 0) + '→' + text.length + 'b)');
  }

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
