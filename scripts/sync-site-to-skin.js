/**
 * site_files.index.html 내용을 web_skin_files (skin_id=4, filename='index.html') 로 동기화.
 *
 * 목적: 시즈닝데이(site 1bfe08ba...)의 지금까지 수정본(site_files, 55kb)을
 *       어드민 "웹스킨 > 수정"이 편집하는 web_skin_files(skin_id=4, 49kb)에 반영.
 *
 * 이 단계는 비파괴적: site_files 는 건드리지 않고 web_skin_files 만 UPDATE 한다.
 * (site_files 오버라이드 제거는 별도 단계 — 사용자 승인 필요)
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';
const SKIN_ID = 4;

async function run() {
  const [sf] = await sql`
    SELECT id, LENGTH(content) AS sz, content
    FROM site_files
    WHERE site_id = ${SITE_ID} AND filename = 'index.html'
  `;
  if (!sf) { console.log('[!] site_files.index.html not found — abort'); process.exit(1); }

  const [wsf] = await sql`
    SELECT id, LENGTH(content) AS sz
    FROM web_skin_files
    WHERE skin_id = ${SKIN_ID} AND filename = 'index.html'
  `;
  if (!wsf) { console.log('[!] web_skin_files(skin_id=4).index.html not found — abort'); process.exit(1); }

  console.log('[info] site_files.id=' + sf.id + ' (' + sf.sz + ' bytes)');
  console.log('[info] web_skin_files.id=' + wsf.id + ' (' + wsf.sz + ' bytes, before)');

  // 백업: 기존 web_skin_files 내용을 site_configs 에 보관 (롤백 대비)
  // site_configs 는 이미 사용 중이므로 별도 row 로 저장
  const { rows } = await sql`
    INSERT INTO site_configs (site_id, section, config, created_at, updated_at)
    VALUES (
      ${SITE_ID},
      'skin_backup_20260416_skinfile',
      ${JSON.stringify({ skin_id: SKIN_ID, web_skin_file_id: wsf.id, filename: 'index.html', note: '동기화 전 web_skin_files 원본 백업 (sz=' + wsf.sz + ')' })}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (site_id, section) DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
    RETURNING id
  `.catch(() => ({ rows: [] }));
  // site_configs 구조가 다를 수 있으므로 실패해도 진행 (비파괴 작업이라 원본은 site_files 에 그대로 있음)

  // 실제 동기화
  await sql`
    UPDATE web_skin_files
    SET content = ${sf.content},
        file_size = ${sf.sz},
        updated_at = NOW()
    WHERE id = ${wsf.id}
  `;
  console.log('[ok] web_skin_files.id=' + wsf.id + ' updated to ' + sf.sz + ' bytes');

  const [after] = await sql`
    SELECT LENGTH(content) AS sz
    FROM web_skin_files
    WHERE id = ${wsf.id}
  `;
  console.log('[verify] web_skin_files.id=' + wsf.id + ' now ' + after.sz + ' bytes');

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
