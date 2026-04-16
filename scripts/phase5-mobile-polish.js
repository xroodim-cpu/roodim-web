/**
 * 모바일 폴리싱 4종.
 *
 * 사용자 요청:
 *  [A] medical-law 모바일 — 각 배너 사이 구분선/간격으로 구분 명확화
 *  [B] scroll-nav 모바일 — 호버 효과 전부 제거 (dot-label 노출, dot 스케일 등)
 *  [C] scroll-nav 모바일 — dot 위아래 간격 축소
 *  [D] scroll-nav 모바일 — .tt (세로 온도 바) 높이 반으로
 *
 * 위치: web_skin_files (skin_id=4, index.html) 의 기존 @media (max-width:768px) 블록 내부
 *
 * 안전장치:
 *  - 기존 블록 내부 끝에 추가 (기존 규칙 손상 없음)
 *  - idempotent: 마커 주석으로 중복 삽입 방지
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

const SKIN_ID = 4;
const MARKER = '/* [M-POLISH] */';

async function run() {
  const [row] = await sql`
    SELECT id, content FROM web_skin_files
    WHERE skin_id = ${SKIN_ID} AND filename = 'index.html'
  `;
  if (!row) { console.log('[!] not found'); process.exit(1); }

  let html = row.content;
  const before = html.length;

  if (html.indexOf(MARKER) >= 0) {
    console.log('[=] [M-POLISH] 마커 존재 — 이미 적용됨, skip');
    await sql.end(); return;
  }

  // 기존 @media 768 블록 내부, 우리 이전 수정사항 뒤에 추가
  // anchor: `.roo-law-card h4 { font-size: 20px; }` (직전 phase5 에서 추가한 마지막 규칙)
  const anchor = `.roo-law-card h4 { font-size: 20px; }`;
  if (html.indexOf(anchor) < 0) {
    console.log('[!] anchor 찾지 못함'); process.exit(1);
  }

  const polishBlock = `
  ${MARKER}
  /* [A] medical-law 카드 구분선 — 모바일에서 각 카드 사이 얇은 divider + 여백 */
  .roo-law-card { padding-bottom: 36px; border-bottom: 1px solid rgba(255, 255, 255, .10); }
  .roo-law-card:last-child { padding-bottom: 0; border-bottom: none; }
  .roo-law-cards { gap: 36px !important; }

  /* [B] scroll-nav 호버 효과 제거 (모바일은 호버 컨셉 없음) */
  .dn:hover a .dot-label { max-width: 0 !important; opacity: 0 !important; padding-right: 0 !important; margin-right: 0 !important; }
  .dn a:hover .dot-label { color: rgba(255,255,255,.7) !important; }
  .dn a:hover .dot { background: rgba(255,255,255,.15) !important; box-shadow: none !important; transform: none !important; }

  /* [C] scroll-nav 도트 세로 간격 축소 */
  .dn { gap: 4px; margin-bottom: 6px; }

  /* [D] .tt (세로 온도 바) 높이 반으로 */
  .tt { height: 100px; }`;

  // anchor 뒤에 polishBlock 삽입 (anchor 유지)
  html = html.replace(anchor, anchor + polishBlock);
  console.log('[1] @media 768 블록 내 [M-POLISH] 4종 규칙 추가');

  await sql`
    UPDATE web_skin_files
    SET content = ${html}, file_size = ${html.length}, updated_at = NOW()
    WHERE id = ${row.id}
  `;
  console.log('[ok] web_skin_files.id=' + row.id + ' saved (' + before + ' → ' + html.length + ' bytes, +' + (html.length - before) + 'b)');
  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
