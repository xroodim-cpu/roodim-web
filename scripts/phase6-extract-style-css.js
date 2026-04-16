/**
 * 두 작업:
 *  (A) #medical-law 섹션 .roo-law-card 의 모바일 레이아웃: column → column-reverse
 *      → 텍스트가 이미지 위(먼저), 이미지가 아래로 오게.
 *  (B) header.html 안의 <style> 블록 2개를 style.css 로 분리.
 *      header.html 의 </head> 앞에는 <link rel="stylesheet" href="style.css"> 만 남김.
 *      (bare path — `<base href="/{slug}/">` 가 자동 주입되므로 `/slug/style.css` 로 해석됨.
 *       `{{SITE_URL}}/style.css` 로 쓰면 template-engine 의 leading-slash strip 로직이
 *       `org-5/style.css` 로 바꿔버려 base 와 겹쳐 `/org-5/org-5/style.css` 404 발생.)
 *
 * 순서:
 *   1) 현재 header.html 읽기
 *   2) <style> 블록 2개 추출 → concat (1번은 그대로, 2번은 id 주석만 첨부)
 *   3) concat 된 CSS 에서 roo-law-card column → column-reverse 치환
 *   4) web_skin_files 에 style.css INSERT/UPDATE
 *   5) header.html 에서 두 <style>...</style> 블록 제거 + <link> 삽입
 *   6) DB UPDATE header.html
 *
 * idempotent 체크: header.html 에 이미 `<link ... style.css">` 가 있으면 skip.
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const SKIN_ID = 4;

(async () => {
  // ── 1) header.html 로드
  const [headerFile] = await sql`SELECT id, content FROM web_skin_files WHERE skin_id=${SKIN_ID} AND filename='header.html'`;
  if (!headerFile) { console.log('[!] header.html not found'); process.exit(1); }
  const hdr = headerFile.content;
  console.log('[1] header.html 현재:', hdr.length + 'b');

  // idempotent
  if (/\<link[^>]+href=[^>]+style\.css/.test(hdr) && !hdr.includes('<style')) {
    console.log('[=] 이미 style.css 로 분리됨 — skip');
    await sql.end(); return;
  }

  // ── 2) <style> 블록 2개 추출
  const styleMatches = [...hdr.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];
  if (styleMatches.length < 1) { console.log('[!] <style> 없음'); process.exit(1); }
  console.log('[2] <style> 블록:', styleMatches.length, '개');

  const parts = styleMatches.map((m, i) => {
    // 안쪽 CSS 텍스트만 꺼냄
    const inner = m[1].replace(/^\n+|\n+$/g, '');
    // 두 번째 블록은 id="roo-banner-styles" 이었으니 주석으로 구분
    const label = m[0].match(/id="([^"]+)"/)?.[1];
    return label ? `/* ══════ ${label} ══════ */\n${inner}` : `/* ══════ base CSS ══════ */\n${inner}`;
  });
  let mergedCss = parts.join('\n\n');

  // ── 3) .roo-law-card 모바일 column → column-reverse
  const lawOld = '.roo-law-card, .roo-law-card:nth-child(even) { flex-direction: column;';
  const lawNew = '.roo-law-card, .roo-law-card:nth-child(even) { flex-direction: column-reverse;';
  if (mergedCss.indexOf(lawOld) < 0) {
    console.log('[!] 모바일 .roo-law-card column 규칙 미발견 — 전체 검색으로 재시도');
    const alt = mergedCss.match(/\.roo-law-card[^{]*:nth-child\(even\)[^{]*\{[^}]*flex-direction:\s*column[^-]/);
    console.log('  재검색:', alt?.[0]);
  } else {
    mergedCss = mergedCss.replace(lawOld, lawNew);
    console.log('[3] .roo-law-card: flex-direction column → column-reverse (모바일에서 텍스트가 이미지 위로)');
  }

  console.log('[3-done] style.css 최종 크기:', mergedCss.length + 'b');

  // ── 4) web_skin_files.style.css INSERT/UPDATE
  const existing = await sql`SELECT id FROM web_skin_files WHERE skin_id=${SKIN_ID} AND filename='style.css'`;
  if (existing[0]) {
    await sql`UPDATE web_skin_files SET content=${mergedCss}, file_size=${mergedCss.length}, updated_at=NOW() WHERE id=${existing[0].id}`;
    console.log('[4] style.css UPDATE (id=' + existing[0].id + ')');
  } else {
    await sql`INSERT INTO web_skin_files (skin_id, filename, file_type, content, file_size, created_at, updated_at)
              VALUES (${SKIN_ID}, 'style.css', 'css', ${mergedCss}, ${mergedCss.length}, NOW(), NOW())`;
    console.log('[4] style.css INSERT');
  }

  // ── 5) header.html 에서 <style>...</style> 블록 제거 + <link> 삽입
  let newHdr = hdr.replace(/\s*<style\b[^>]*>[\s\S]*?<\/style>\s*/g, '\n');
  // </head> 앞에 <link> 삽입
  const linkTag = '<link rel="stylesheet" href="style.css">';
  newHdr = newHdr.replace('</head>', linkTag + '\n</head>');
  console.log('[5] new header.html:', newHdr.length + 'b  (기존 ' + hdr.length + 'b → -' + (hdr.length - newHdr.length) + 'b)');

  // ── 6) DB UPDATE
  await sql`UPDATE web_skin_files SET content=${newHdr}, file_size=${newHdr.length}, updated_at=NOW() WHERE id=${headerFile.id}`;
  console.log('[6] header.html UPDATE 완료');

  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
