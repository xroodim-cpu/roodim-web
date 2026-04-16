/**
 * 성공사례 섹션(section#success) 하단에 들어간 배너영역(area_id="3") 블록 제거.
 *
 * 사용자 요청:
 *  - 실제 성공사례 밑에 들어간 배너영역 코드#3 삭제
 *
 * 대상: web_skin_files (skin_id=4, index.html) — 시즈닝데이 커스텀 스킨 ONDO
 *
 * 안전장치:
 *  - 원본 배너 블록 문자열이 정확히 한 번만 매칭될 때만 제거
 *  - 없으면 skip (idempotent)
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

  const target = `<div class="roo-banner-area" area_id="3">
  <!--@banner_loop-->
  <div class="roo-banner">
    <a>
      <img src="{#img_1}">
    </a>
    <p>{#text_1}</p>
  </div>
  <!--@end_banner_loop-->
</div>
`;

  const occurrences = html.split(target).length - 1;
  if (occurrences === 0) {
    console.log('[=] area_id="3" 배너영역 블록 이미 제거됨 — skip');
    await sql.end();
    return;
  }
  if (occurrences > 1) {
    console.log('[!] 동일한 블록이 ' + occurrences + '회 발견 — 안전을 위해 중단');
    process.exit(1);
  }

  html = html.replace(target, '');
  console.log('[1] section#success 내부 area_id="3" 배너영역 블록 제거');

  await sql`
    UPDATE web_skin_files
    SET content = ${html}, file_size = ${html.length}, updated_at = NOW()
    WHERE id = ${row.id}
  `;
  console.log('[ok] web_skin_files.id=' + row.id + ' saved (' + before + ' → ' + html.length + ' bytes, -' + (before - html.length) + 'b)');
  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
