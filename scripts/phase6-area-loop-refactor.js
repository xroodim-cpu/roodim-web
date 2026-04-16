/**
 * area_id="4" (업체 선택기준) / area_id="5" (의료법) 를 고정 슬롯 → 루프 방식으로 리팩토링.
 *
 * 변경:
 *  - area_id=4: 4개 복붙 카드 → <!--@banner_loop--> 1개 템플릿
 *  - area_id=5: 3개 복붙 카드 → <!--@banner_loop--> 1개 템플릿
 *
 * 디자인 유지:
 *  - 모든 class 명 그대로 (.roo-criteria-card, .roo-law-card, .roo-law-text 등)
 *  - 지그재그 CSS 는 :nth-child(even) 기반이라 루프로 찍혀도 동일하게 적용됨
 *  - 이미지 alt/loading 속성도 동일
 *
 * 루프 내부 치환:
 *  - {#img_N}  → {#img}
 *  - {#title_N}→ {#title}
 *  - {#text_N} → {#text}
 *
 * 대상: web_skin_files (skin_id=4, index.html)
 * 안전장치: 기존 블록 정확 매칭. 이미 루프면 skip (idempotent).
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

  // ───────────────────────────────────────────────
  // [1] area_id="4" (업체 선택기준) — 4카드 복붙 → 루프
  // ───────────────────────────────────────────────
  const area4Old = `<div class="roo-banner-area roo-criteria-grid pg sg" area_id="4">
<div class="pc roo-criteria-card"><div class="roo-criteria-img"><img src="{#img_1}" alt="{#title_1}" loading="lazy"></div><h4>{#title_1}</h4><p>{#text_1}</p></div>
<div class="pc roo-criteria-card"><div class="roo-criteria-img"><img src="{#img_2}" alt="{#title_2}" loading="lazy"></div><h4>{#title_2}</h4><p>{#text_2}</p></div>
<div class="pc roo-criteria-card"><div class="roo-criteria-img"><img src="{#img_3}" alt="{#title_3}" loading="lazy"></div><h4>{#title_3}</h4><p>{#text_3}</p></div>
<div class="pc roo-criteria-card"><div class="roo-criteria-img"><img src="{#img_4}" alt="{#title_4}" loading="lazy"></div><h4>{#title_4}</h4><p>{#text_4}</p></div>
</div>`;

  const area4New = `<div class="roo-banner-area roo-criteria-grid pg sg" area_id="4">
<!--@banner_loop-->
<div class="pc roo-criteria-card"><div class="roo-criteria-img"><img src="{#img}" alt="{#title}" loading="lazy"></div><h4>{#title}</h4><p>{#text}</p></div>
<!--@end_banner_loop-->
</div>`;

  if (html.indexOf(area4New) >= 0) {
    console.log('[=] [1] area_id="4" 이미 루프 방식 — skip');
  } else if (html.indexOf(area4Old) < 0) {
    console.log('[!] [1] area_id="4" 기존 블록 매칭 실패 — 중단');
    process.exit(1);
  } else {
    html = html.replace(area4Old, area4New);
    console.log('[1] area_id="4" 업체 선택기준: 고정 4슬롯 → 루프 템플릿 (CSS 그대로, 개수 자유)');
  }

  // ───────────────────────────────────────────────
  // [2] area_id="5" (의료법) — 3카드 복붙 → 루프
  // ───────────────────────────────────────────────
  const area5Old = `<div class="roo-banner-area roo-law-cards pg sg" area_id="5">
<div class="pc roo-law-card"><div class="roo-law-img"><img src="{#img_1}" alt="{#title_1}" loading="lazy"></div><div class="roo-law-text"><h4>{#title_1}</h4><p>{#text_1}</p></div></div>
<div class="pc roo-law-card"><div class="roo-law-img"><img src="{#img_2}" alt="{#title_2}" loading="lazy"></div><div class="roo-law-text"><h4>{#title_2}</h4><p>{#text_2}</p></div></div>
<div class="pc roo-law-card"><div class="roo-law-img"><img src="{#img_3}" alt="{#title_3}" loading="lazy"></div><div class="roo-law-text"><h4>{#title_3}</h4><p>{#text_3}</p></div></div>
</div>`;

  const area5New = `<div class="roo-banner-area roo-law-cards pg sg" area_id="5">
<!--@banner_loop-->
<div class="pc roo-law-card"><div class="roo-law-img"><img src="{#img}" alt="{#title}" loading="lazy"></div><div class="roo-law-text"><h4>{#title}</h4><p>{#text}</p></div></div>
<!--@end_banner_loop-->
</div>`;

  if (html.indexOf(area5New) >= 0) {
    console.log('[=] [2] area_id="5" 이미 루프 방식 — skip');
  } else if (html.indexOf(area5Old) < 0) {
    console.log('[!] [2] area_id="5" 기존 블록 매칭 실패 — 중단');
    process.exit(1);
  } else {
    html = html.replace(area5Old, area5New);
    console.log('[2] area_id="5" 의료법: 고정 3슬롯 → 루프 템플릿 (지그재그 CSS 는 nth-child 기반이라 그대로 동작)');
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
