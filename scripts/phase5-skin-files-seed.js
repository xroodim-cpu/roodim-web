/**
 * 커스텀 스킨(skin_id=3, 4)에 누락된 header.html / footer.html / main.js 를
 * 기본스킨(skin_id=1)에서 시드한다. 스킨 구조 통일.
 *
 * 목적:
 *  - 커스텀 스킨이 기본스킨과 동일한 5파일 구조(index/style/header/footer/main) 를 갖게 함
 *  - 어드민 "웹스킨 > 수정" 에서 header/footer/main 을 개별 편집 가능
 *  - 렌더 엔진의 <!--@header--> / <!--@footer--> 가 실제 파일을 로드해 삽입할 수 있게 함
 *
 * 안전장치:
 *  - 이미 파일이 존재하면 건드리지 않음 (idempotent)
 *  - 기본스킨의 content 를 그대로 복제 (사용자는 어드민에서 자유롭게 수정)
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

const BASIC_SKIN_ID = 1;
const TARGET_SKIN_IDS = [3, 4];
const FILES_TO_SEED = ['header.html', 'footer.html', 'main.js'];

async function run() {
  const basicFiles = {};
  for (const fn of FILES_TO_SEED) {
    const [row] = await sql`
      SELECT content, file_type FROM web_skin_files
      WHERE skin_id = ${BASIC_SKIN_ID} AND filename = ${fn}
    `;
    if (!row) { console.log('[!] 기본스킨에서 ' + fn + ' 을 찾지 못했습니다 — abort'); process.exit(1); }
    basicFiles[fn] = row;
    console.log('[seed] 기본스킨 ' + fn + ' = ' + (row.content || '').length + ' bytes');
  }

  for (const sid of TARGET_SKIN_IDS) {
    const [skin] = await sql`SELECT id, name, slug FROM web_skins WHERE id = ${sid}`;
    console.log('\n── skin_id=' + sid + ' [' + skin.slug + '] ' + skin.name + ' ──');

    for (const fn of FILES_TO_SEED) {
      const existing = await sql`
        SELECT id, LENGTH(content) AS sz FROM web_skin_files
        WHERE skin_id = ${sid} AND filename = ${fn}
      `;
      if (existing.length > 0) {
        console.log('  [=] ' + fn + ' 이미 존재 (id=' + existing[0].id + ', ' + existing[0].sz + 'b) — skip');
        continue;
      }
      const src = basicFiles[fn];
      const inserted = await sql`
        INSERT INTO web_skin_files (skin_id, filename, file_type, content, file_size, is_entry, sort_order, created_at, updated_at)
        VALUES (${sid}, ${fn}, ${src.file_type}, ${src.content}, ${(src.content || '').length}, false, 10, NOW(), NOW())
        RETURNING id
      `;
      console.log('  [+] ' + fn + ' 시드 완료 (id=' + inserted[0].id + ', ' + (src.content || '').length + 'b)');
    }

    // file_count 메타 업데이트
    const [cnt] = await sql`SELECT COUNT(*)::int AS c FROM web_skin_files WHERE skin_id = ${sid}`;
    await sql`UPDATE web_skins SET file_count = ${cnt.c}, updated_at = NOW() WHERE id = ${sid}`;
    console.log('  [~] file_count 메타 갱신 → ' + cnt.c);
  }

  // 기본스킨의 file_count 도 정리
  const [basicCnt] = await sql`SELECT COUNT(*)::int AS c FROM web_skin_files WHERE skin_id = ${BASIC_SKIN_ID}`;
  await sql`UPDATE web_skins SET file_count = ${basicCnt.c} WHERE id = ${BASIC_SKIN_ID}`;
  console.log('\n[~] 기본스킨 file_count → ' + basicCnt.c);

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
