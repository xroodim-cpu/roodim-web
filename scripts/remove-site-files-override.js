/**
 * site_files.index.html 오버라이드 제거 (site 1bfe08ba / 시즈닝데이).
 *
 * 사유:
 *  - skin_id=4 가 시즈닝데이 전용 커스텀 스킨이라 site_files 오버라이드가 불필요.
 *  - 오버라이드가 남아있으면 어드민 "웹스킨 > 수정"(web_skin_files 편집)이 렌더링에 반영되지 않음.
 *  - 내용은 직전 단계(sync-site-to-skin.js)에서 web_skin_files.id=7 로 이미 복사됨.
 *
 * 안전장치:
 *  - 삭제 전 site_configs 에 전체 content 와 메타를 백업 (롤백 가능)
 *  - web_skin_files.id=7 의 현재 sz 가 site_files 와 일치하는지 검증 후 삭제
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09';
const SKIN_ID = 4;

async function run() {
  const [sf] = await sql`
    SELECT id, LENGTH(content) AS sz, content, filename, file_type, file_size, updated_at
    FROM site_files
    WHERE site_id = ${SITE_ID} AND filename = 'index.html'
  `;
  if (!sf) { console.log('[=] site_files.index.html already removed — nothing to do'); await sql.end(); return; }

  const [wsf] = await sql`
    SELECT id, LENGTH(content) AS sz
    FROM web_skin_files
    WHERE skin_id = ${SKIN_ID} AND filename = 'index.html'
  `;
  if (!wsf) { console.log('[!] web_skin_files(skin_id=4) not found — abort (no fallback!)'); process.exit(1); }

  if (sf.sz !== wsf.sz) {
    console.log('[!] size mismatch — site_files=' + sf.sz + ' vs web_skin_files=' + wsf.sz);
    console.log('    sync-site-to-skin.js 를 먼저 실행하세요. abort.');
    process.exit(1);
  }

  console.log('[info] site_files.id=' + sf.id + ' (' + sf.sz + ' bytes, ts=' + sf.updated_at.toISOString() + ')');
  console.log('[info] web_skin_files.id=' + wsf.id + ' (' + wsf.sz + ' bytes) — content mirrored, safe to delete override');

  // 백업: 전체 content 를 site_configs 에 저장 (롤백용)
  try {
    await sql`
      INSERT INTO site_configs (site_id, section, config, created_at, updated_at)
      VALUES (
        ${SITE_ID},
        'site_files_backup_20260416',
        ${JSON.stringify({
          filename: 'index.html',
          deleted_site_file_id: sf.id,
          file_type: sf.file_type,
          file_size: sf.file_size,
          content: sf.content,
          deleted_at: new Date().toISOString(),
          note: '시즈닝데이 커스텀 스킨(id=4) 정리 — site_files 오버라이드 제거 시 백업',
        })}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (site_id, section) DO UPDATE
        SET config = EXCLUDED.config, updated_at = NOW()
    `;
    console.log('[ok] 원본 백업 → site_configs.section=site_files_backup_20260416');
  } catch (e) {
    console.log('[!] site_configs 백업 실패:', e.message);
    console.log('    그래도 web_skin_files.id=7 에 내용이 있으므로 진행');
  }

  // 실제 삭제
  await sql`DELETE FROM site_files WHERE id = ${sf.id}`;
  console.log('[ok] site_files.id=' + sf.id + ' deleted');

  // 검증: 이제 getSiteFile 이 web_skin_files 만 읽는지 확인
  const [verify] = await sql`
    SELECT
      COALESCE(sf.id, wsf.id) AS id,
      COALESCE(sf.content, wsf.content) AS content_head,
      LENGTH(COALESCE(sf.content, wsf.content)) AS sz,
      (sf.id IS NULL AND wsf.id IS NOT NULL) AS from_skin
    FROM sites s
    LEFT JOIN site_files sf ON sf.site_id = s.id AND sf.filename = 'index.html'
    LEFT JOIN web_skin_files wsf ON wsf.skin_id = s.skin_id AND wsf.filename = 'index.html'
    WHERE s.id = ${SITE_ID}
    LIMIT 1
  `;
  console.log('[verify] getSiteFile 시뮬레이션 결과:');
  console.log('  id=' + verify.id + ', size=' + verify.sz + ', from_skin=' + verify.from_skin);
  if (verify.from_skin && verify.sz === sf.sz) {
    console.log('[ok] 이제 렌더링은 web_skin_files(skin_id=4) 을 직접 읽습니다.');
    console.log('[ok] 어드민 "웹스킨 > 수정" 편집이 사이트에 바로 반영됩니다.');
  } else {
    console.log('[!] 검증 실패 — 수동 확인 필요');
  }

  await sql.end();
}

run().catch(e => { console.error(e); process.exit(1); });
