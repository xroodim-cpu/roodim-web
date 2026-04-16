/**
 * ONDO(skin_id=4) 리팩토링: monolithic index.html 을 header.html / index.html / footer.html 로 분리.
 *
 * 목표:
 *  - header.html = <!DOCTYPE> ~ <head>(SEO + CSS + Pretendard) + <body> 열고 + 상단 nav/scroll-nav
 *  - footer.html = 팝업폼 + <footer>(회사정보 치환코드) + bottom-bar + 모든 script + </body></html>
 *  - index.html  = <!--@header--> + <section>×13 + <!--@footer-->   (초슬림)
 *
 * 치환코드 적용:
 *  - <head>: {{META_TITLE}} {{META_DESC}} {{META_KEYWORDS}} {{OG_TITLE}} {{OG_DESC}} {{OG_IMAGE}}
 *             {{FAVICON_URL}} {{ROBOTS}} (신규) 모두 포함
 *  - <footer>: 하드코딩 "손호재 / 261-25-01645 / 주소" → {{REPRESENTATIVE}} {{BUSINESS_NUMBER}} {{ADDRESS}}
 *             상단 브랜드명 "ONDO" → {{COMPANY_NAME}}
 *             copyright → {{COPYRIGHT}}
 *
 * 안전장치:
 *  - 시작 전 현재 3개 파일(index/header/footer) 내용을 site_configs.section='skin_backup_split' 에 저장
 *  - idempotent: 이미 `<!--@header-->` 로 슬림화된 index.html 이면 skip
 */
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } });

const SKIN_ID = 4;
const SITE_ID = '1bfe08ba-e9c4-48e7-b2c5-8318aa7e3d09'; // org-5 시즈닝데이

async function run() {
  // ── 0) 현재 파일들 로드
  const files = await sql`
    SELECT id, filename, content FROM web_skin_files
    WHERE skin_id = ${SKIN_ID} AND filename IN ('index.html','header.html','footer.html')
  `;
  const byName = Object.fromEntries(files.map(f => [f.filename, f]));
  const indexFile = byName['index.html'];
  const headerFile = byName['header.html'];
  const footerFile = byName['footer.html'];

  if (!indexFile) { console.log('[!] index.html not found'); process.exit(1); }
  const raw = indexFile.content;

  // ── 0-A) idempotent 체크
  if (raw.trimStart().startsWith('<!--@header-->')) {
    console.log('[=] 이미 슬림 index.html (starts with <!--@header-->) — skip');
    await sql.end(); return;
  }

  // ── 1) 경계 인덱스
  const headCloseIdx = raw.indexOf('</head>');
  const bodyOpenMatch = raw.match(/<body\b[^>]*>/);
  const bodyOpenStart = bodyOpenMatch.index;
  const bodyOpenEnd = bodyOpenStart + bodyOpenMatch[0].length;
  const firstSectionStart = raw.search(/<section\b/);
  const allSec = [...raw.matchAll(/<\/section>/g)];
  const lastSectionEnd = allSec[allSec.length - 1].index + '</section>'.length;
  const bodyCloseIdx = raw.indexOf('</body>');

  console.log('[경계] </head>=' + headCloseIdx + '  <body>=' + bodyOpenEnd + '  첫<section>=' + firstSectionStart + '  마지막</section>끝=' + lastSectionEnd + '  </body>=' + bodyCloseIdx);

  // ── 2) 원본에서 <head> 내부 요소 분리
  //    원본 head: <head> ... <title>하드코딩</title> <link pretendard> <style> ... </style> </head>
  //    목표:       <head> + 치환코드 메타 + pretendard + style + </head>
  const headInner = raw.slice(raw.indexOf('<head>') + '<head>'.length, headCloseIdx);

  // <title>...</title> 제거 (치환코드로 대체됨)
  // <meta charset/viewport> 는 유지 (앞단에서 다시 쓸 것)
  // pretendard link 추출
  const pretendardMatch = headInner.match(/<link[^>]*pretendard[^>]*>/i);
  const pretendardLink = pretendardMatch ? pretendardMatch[0] : '<link href="https://cdnjs.cloudflare.com/ajax/libs/pretendard/1.3.9/variable/pretendardvariable.min.css" rel="stylesheet">';

  // <style> 블록 추출
  const styleMatch = headInner.match(/<style\b[\s\S]*?<\/style>/i);
  const styleBlock = styleMatch ? styleMatch[0] : '';
  console.log('[추출] <style> 블록 ' + (styleMatch ? styleMatch[0].length : 0) + 'b');

  // ── 3) body 상단 래퍼 (<body> 열고 + 상단 nav/scroll-nav)
  const bodyOpenTag = bodyOpenMatch[0]; // <body ...>
  const topBodyBlock = raw.slice(bodyOpenEnd, firstSectionStart).trim(); // overlay, gp, top-nav, scroll-nav

  // ── 4) 섹션 본문 (index.html 에 남을 부분)
  const sectionsBlock = raw.slice(firstSectionStart, lastSectionEnd).trim();
  console.log('[추출] 섹션 본문 ' + sectionsBlock.length + 'b');

  // ── 5) </section> 이후 ~ </body> 사이 (팝업폼 + 기존 footer + bottom-bar + scripts)
  let bottomBlock = raw.slice(lastSectionEnd, bodyCloseIdx).trim();

  // ── 6) 기존 하드코딩 <footer> 내부를 치환코드로 교체
  //      패턴: <footer ...>...</footer>  ← 여러 줄
  //      교체: <footer>..{{COMPANY_NAME}} / {{REPRESENTATIVE}} / {{BUSINESS_NUMBER}} / {{ADDRESS}} / {{COPYRIGHT}}..</footer>
  const newFooterBlock = `<footer style="padding:60px 48px 120px;text-align:left;border-top:1px solid rgba(255,255,255,.06);position:relative;z-index:1;max-width:1200px;margin:0 auto">
<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:32px">
<div>
<div style="font-size:24px;font-weight:900;letter-spacing:.05em;margin-bottom:16px;color:var(--text)">{{COMPANY_NAME}}</div>
<div style="font-size:13px;color:var(--text2);line-height:2">
대표자명 : {{REPRESENTATIVE}}<br>
사업자 번호 : {{BUSINESS_NUMBER}}<br>
주소 : {{ADDRESS}}
</div>
</div>
<div style="text-align:right">
<div style="font-size:12px;color:rgba(255,255,255,.2);margin-top:8px">{{COPYRIGHT}}</div>
</div>
</div>
</footer>`;
  bottomBlock = bottomBlock.replace(/<footer\b[\s\S]*?<\/footer>/, newFooterBlock);
  console.log('[치환] <footer> 내부를 치환코드로 교체 ({{COMPANY_NAME}}/{{REPRESENTATIVE}}/{{BUSINESS_NUMBER}}/{{ADDRESS}}/{{COPYRIGHT}})');

  // ── 7) 새 header.html 조립
  const newHeader = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{META_TITLE}}</title>
<meta name="description" content="{{META_DESC}}">
<meta name="keywords" content="{{META_KEYWORDS}}">
<meta name="robots" content="{{ROBOTS}}">
<meta property="og:title" content="{{OG_TITLE}}">
<meta property="og:description" content="{{OG_DESC}}">
<meta property="og:image" content="{{OG_IMAGE}}">
<meta property="og:type" content="website">
<link rel="icon" href="{{FAVICON_URL}}">
${pretendardLink}
${styleBlock}
</head>
${bodyOpenTag}
${topBodyBlock}`;

  // ── 8) 새 footer.html 조립
  const newFooter = `${bottomBlock}
</body>
</html>`;

  // ── 9) 새 index.html 조립 (초슬림)
  const newIndex = `<!--@header-->
${sectionsBlock}
<!--@footer-->`;

  console.log('[조립] new header.html = ' + newHeader.length + 'b');
  console.log('[조립] new footer.html = ' + newFooter.length + 'b');
  console.log('[조립] new index.html  = ' + newIndex.length + 'b  (기존 ' + raw.length + 'b → -' + (raw.length - newIndex.length) + 'b)');

  // ── 10) 백업 저장 (site_configs)
  await sql`
    INSERT INTO site_configs (site_id, section, data, updated_at)
    VALUES (${SITE_ID}, ${'skin_backup_split_20260416'}, ${JSON.stringify({
      index_html: raw,
      header_html: headerFile ? headerFile.content : null,
      footer_html: footerFile ? footerFile.content : null,
      ts: new Date().toISOString(),
    })}, NOW())
    ON CONFLICT (site_id, section) DO UPDATE
    SET data = EXCLUDED.data, updated_at = NOW()
  `;
  console.log('[백업] site_configs.section=skin_backup_split_20260416 저장');

  // ── 11) 각 파일 UPDATE (없으면 INSERT)
  // header.html
  if (headerFile) {
    await sql`UPDATE web_skin_files SET content = ${newHeader}, file_size = ${newHeader.length}, updated_at = NOW() WHERE id = ${headerFile.id}`;
    console.log('[upd] web_skin_files.id=' + headerFile.id + ' header.html 저장');
  } else {
    await sql`INSERT INTO web_skin_files (skin_id, filename, file_type, content, file_size, created_at, updated_at) VALUES (${SKIN_ID}, 'header.html', 'html', ${newHeader}, ${newHeader.length}, NOW(), NOW())`;
    console.log('[new] web_skin_files header.html INSERT');
  }
  // footer.html
  if (footerFile) {
    await sql`UPDATE web_skin_files SET content = ${newFooter}, file_size = ${newFooter.length}, updated_at = NOW() WHERE id = ${footerFile.id}`;
    console.log('[upd] web_skin_files.id=' + footerFile.id + ' footer.html 저장');
  } else {
    await sql`INSERT INTO web_skin_files (skin_id, filename, file_type, content, file_size, created_at, updated_at) VALUES (${SKIN_ID}, 'footer.html', 'html', ${newFooter}, ${newFooter.length}, NOW(), NOW())`;
    console.log('[new] web_skin_files footer.html INSERT');
  }
  // index.html
  await sql`UPDATE web_skin_files SET content = ${newIndex}, file_size = ${newIndex.length}, updated_at = NOW() WHERE id = ${indexFile.id}`;
  console.log('[upd] web_skin_files.id=' + indexFile.id + ' index.html 슬림화 저장');

  // ── 12) base/headerfooter 설정에 하드코딩 데이터 이관 (아직 비어있으면만)
  const baseRow = await sql`SELECT data FROM site_configs WHERE site_id = ${SITE_ID} AND section = 'base' LIMIT 1`;
  const base = (baseRow[0]?.data || {});
  const needBaseUpdate = {
    site_name: base.site_name || 'ONDO',
    representative: base.representative || '손호재',
    business_number: base.business_number || '261-25-01645',
    address: base.address || '충청북도 청주시 서원구 사직동 141-6 (3층, 304호)',
  };
  const merged = { ...base, ...needBaseUpdate };
  await sql`
    INSERT INTO site_configs (site_id, section, data, updated_at)
    VALUES (${SITE_ID}, 'base', ${JSON.stringify(merged)}, NOW())
    ON CONFLICT (site_id, section) DO UPDATE
    SET data = EXCLUDED.data, updated_at = NOW()
  `;
  console.log('[cfg] site_configs.base 에 회사정보 이관: ' + JSON.stringify(needBaseUpdate));

  // SEO 기본값
  const seoRow = await sql`SELECT data FROM site_configs WHERE site_id = ${SITE_ID} AND section = 'seo' LIMIT 1`;
  const seo = (seoRow[0]?.data || {});
  const seoMerged = {
    meta_title: seo.meta_title || '브랜드온도 | 병원을 브랜드로 만드는 사람들',
    meta_description: seo.meta_description || '환자가 증가하고 경쟁사에서도 알면 그때부터가 시작. 브랜드온도의 의료법 대응팀이 함께합니다.',
    meta_keywords: seo.meta_keywords || '브랜드온도, 병원마케팅, 의료법대응, 블로그마케팅, 채널관리',
    og_title: seo.og_title || seo.meta_title || '브랜드온도',
    og_description: seo.og_description || seo.meta_description || '병원을 브랜드로 만드는 사람들',
    robots: seo.robots || 'index, follow',
    ...seo,
  };
  await sql`
    INSERT INTO site_configs (site_id, section, data, updated_at)
    VALUES (${SITE_ID}, 'seo', ${JSON.stringify(seoMerged)}, NOW())
    ON CONFLICT (site_id, section) DO UPDATE
    SET data = EXCLUDED.data, updated_at = NOW()
  `;
  console.log('[cfg] site_configs.seo 기본값 세팅 (robots=index,follow 포함)');

  await sql.end();
  console.log('\n✓ 분리 완료');
}

run().catch(e => { console.error(e); process.exit(1); });
