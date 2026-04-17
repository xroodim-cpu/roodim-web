import { db } from './db';
import { siteFiles, siteContents, siteConfigs, siteAdmins, sites, webSkinFiles, bannerAreas, bannerItems, boards, boardPosts } from '@/drizzle/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { getFileContent } from './site';
import { adminApi } from './admin-api';

interface TemplateContext {
  siteId: string;
  slug: string;
  configs: Record<string, Record<string, unknown>>;
}

/**
 * 사용자 업로드 자산(로고/프로필 사진) URL 정규화.
 *
 * 배경: 레거시 사이트는 `site_configs.headerfooter.logo_url` 또는 `siteContents.thumbUrl` 에
 * `/storage/user/2/logo/xxx.png` 같은 Laravel 서버의 루트 상대경로를 그대로 저장해 뒀다.
 * Vercel 에 서빙되는 roodim-web 에서 이 경로를 그대로 쓰면:
 *   - `<base href="/org-1/">` + strip-leading-slash 로 `org-1/storage/...` 가 되거나
 *   - strip 안 하더라도 `https://roodim-web.vercel.app/storage/...` 로 요청돼 404
 *
 * 해결: `/storage/` 로 시작하는 경로는 `ADMIN_API_URL` (루딤 어드민 Laravel 서버) 로
 * 프리픽스를 붙여 절대 URL 로 만든다. 이미 `http(s)://` 또는 `//` 로 시작하면 그대로.
 */
function resolveAssetUrl(value: string | null | undefined): string {
  if (!value) return '';
  const v = value.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v) || v.startsWith('//')) return v;
  if (v.startsWith('/storage/')) {
    const base = (process.env.ADMIN_API_URL || '').replace(/\/$/, '');
    if (base) return `${base}${v}`;
  }
  return v;
}

/**
 * 파일 기반 사이트의 HTML을 렌더링
 * 1. include 처리
 * 2. 직원 루프 처리
 * 3. 치환코드 적용
 */
export async function renderSiteFile(
  siteId: string,
  slug: string,
  filename: string
): Promise<string | null> {
  // 파일 로드 (site_files 우선, 없으면 web_skin_files fallback)
  const content = await getFileContent(siteId, filename);
  if (!content) return null;

  // 설정 로드
  const configRows = await db.select()
    .from(siteConfigs)
    .where(eq(siteConfigs.siteId, siteId));

  const configs: Record<string, Record<string, unknown>> = {};
  for (const c of configRows) {
    configs[c.section] = c.data as Record<string, unknown>;
  }

  const ctx: TemplateContext = { siteId, slug, configs };

  let html = content;

  // 1-pre. 헤더/푸터 별칭 치환
  //   <!--@header-->  → <!--@include("header.html")-->
  //   <!--@footer-->  → <!--@include("footer.html")-->
  // 페이지에 해당 치환코드가 있으면 스킨의 header.html/footer.html 내용이 삽입되고,
  // 없으면 아무 것도 삽입되지 않아 페이지별로 헤더/푸터 노출 on/off 가 가능하다.
  html = html
    .replace(/<!--@header-->/g, '<!--@include("header.html")-->')
    .replace(/<!--@footer-->/g, '<!--@include("footer.html")-->');

  // 1. include 처리 (최대 3 depth)
  html = await processIncludes(siteId, html, 0);

  // 2. 직원 루프 처리
  html = await processStaffLoop(siteId, html);

  // 3. 배너 영역 치환코드 처리
  html = await processBannerAreas(siteId, html);

  // 3.5. 게시판 치환코드 처리
  html = await processBoardCodes(siteId, slug, html);

  // 4. 치환코드 적용
  html = await applyVariables(ctx, html);

  // 4.3. 빈 src 이미지 정리
  // 배경: {{OWNER_PHOTO}}, {{LOGO_URL}}, {#img_N} 등이 DB 에 값이 없을 때 `src=""` 로
  //       치환되는데, 모던 브라우저(Chrome 65+)는 `src=""` 에 대해 load/error 이벤트를
  //       발화하지 않아 스킨 HTML 의 `onerror` 폴백이 작동하지 않고 "깨진 이미지" 아이콘이
  //       표시된다.
  // 조치: 치환 후 `src=""` 이거나 `src` 속성 자체가 없는 img 를 `.roo-empty` 마커 span 으로
  //       교체한다. 이 마커는 상위 섹션의 `.rs:has([data-empty="1"]) { display: none }`
  //       CSS 규칙과 연동되어 해당 섹션을 자연스럽게 숨겨준다.
  html = html.replace(
    /<img\b([^>]*?)\/?>/gi,
    (match, attrs) => {
      const srcMatch = attrs.match(/\ssrc=["']([^"']*)["']/i);
      if (!srcMatch || !srcMatch[1].trim()) {
        return '<span class="roo-empty" data-empty="1" hidden></span>';
      }
      return match;
    }
  );

  // 4.5. 루트 절대경로(/...) → 상대경로 정규화
  // 배경:
  //  - 기본스킨 시더(routes/web.php:391 seed-basic-skin)가 `<link rel="stylesheet" href="/style.css">`
  //    처럼 루트 절대경로로 저장해 왔음.
  //  - roodim-web 은 slug 서브폴더 rewrite(/{slug}/...)로 파일을 서빙하기 때문에
  //    브라우저가 `/style.css` 를 요청하면 루트 도메인으로 가 404 가 남.
  //  - 사용자가 기본스킨을 "커스텀"해 clone 하면 이 깨진 HTML 을 그대로 상속받아
  //    CSS/JS/이미지가 전부 깨지는 현상(= "커스텀한 기본스킨이 적용 안됨")이 발생.
  // 조치:
  //  - <link href="/xxx">, <script src="/xxx">, <img src="/xxx"> 등 로컬 루트 절대경로를
  //    상대경로로 치환해 <base href="/{slug}/"> 와 함께 서브폴더 안에서 정상 해석되게 함.
  //  - 프로토콜(`http://`, `https://`) 과 프로토콜 상대(`//`) 는 건드리지 않음.
  //  - `/storage/`, `/_next/`, `/api/`, `/admin/`, `/favicon` 같은 서버 루트 절대경로는
  //    strip 하지 않는다. 특히 `/storage/user/.../logo.png` 는 Laravel 서버의 실제 파일
  //    경로이므로 Vercel 서브폴더로 재해석되면 404.
  const isServerAbsolute = (path: string) =>
    /^\/(storage|_next|api|admin|favicon)/i.test(path);
  const stripLeadingSlash = (prefix: string, rest: string) => {
    if (isServerAbsolute('/' + rest)) return `${prefix}"/${rest}"`;
    return `${prefix}"${rest}"`;
  };
  html = html.replace(
    /(<link\b[^>]*?\shref=)["']\/(?!\/)([^"']+)["']/gi,
    (_m, prefix, rest) => stripLeadingSlash(prefix, rest)
  );
  html = html.replace(
    /(<(?:script|img|source|video|audio|iframe)\b[^>]*?\ssrc=)["']\/(?!\/)([^"']+)["']/gi,
    (_m, prefix, rest) => stripLeadingSlash(prefix, rest)
  );
  html = html.replace(
    /(<a\b[^>]*?\shref=)["']\/(?!\/)([^"'#?][^"']*)["']/gi,
    (_m, prefix, rest) => stripLeadingSlash(prefix, rest)
  );

  // 5. <head> 자동 주입 (base 태그 + style.css fallback + SEO 메타 태그)
  // 목적:
  //  - <base> : 상대경로 에셋 해결 (이미지/링크 등)
  //  - style.css 자동 link: 스킨 HTML 템플릿이 CSS 링크를 누락해도 동작 보장
  //  - SEO 메타 태그: 스킨에 없으면 site_configs.seo 기반으로 자동 주입
  const needsBase = !/<base\s/i.test(html);
  const alreadyLinksLocalCss = /<link[^>]*rel=["']?stylesheet[^>]*href=["']?(?!https?:|\/\/)[^"'>]*\.css/i.test(html);

  let headInjection = '';
  if (needsBase) {
    headInjection += `\n    <base href="/${slug}/">`;
  }
  if (!alreadyLinksLocalCss) {
    const cssFile = await getFileContent(siteId, 'style.css');
    if (cssFile) {
      headInjection += `\n    <link rel="stylesheet" href="style.css">`;
    }
  }

  // SEO 메타 태그 자동 주입 (스킨에 없는 항목만)
  const seoConfig = (configs.seo || {}) as Record<string, string>;
  const baseConfig = (configs.base || {}) as Record<string, string>;

  const metaTitle = seoConfig.meta_title || baseConfig.site_name || baseConfig.title || '';
  const metaDesc = seoConfig.meta_description || baseConfig.description || '';
  const metaKeywords = seoConfig.meta_keywords || '';
  const ogTitle = seoConfig.og_title || metaTitle;
  const ogDesc = seoConfig.og_description || metaDesc;
  const ogImage = resolveAssetUrl(seoConfig.og_image || '');
  const faviconUrl = resolveAssetUrl(seoConfig.favicon_url || '');

  if (metaTitle && !/<title[^>]*>/i.test(html)) {
    headInjection += `\n    <title>${metaTitle}</title>`;
  }
  if (metaDesc && !/<meta[^>]*name=["']description/i.test(html)) {
    headInjection += `\n    <meta name="description" content="${metaDesc}">`;
  }
  if (metaKeywords && !/<meta[^>]*name=["']keywords/i.test(html)) {
    headInjection += `\n    <meta name="keywords" content="${metaKeywords}">`;
  }
  if (ogTitle && !/<meta[^>]*property=["']og:title/i.test(html)) {
    headInjection += `\n    <meta property="og:title" content="${ogTitle}">`;
  }
  if (ogDesc && !/<meta[^>]*property=["']og:description/i.test(html)) {
    headInjection += `\n    <meta property="og:description" content="${ogDesc}">`;
  }
  if (ogImage && !/<meta[^>]*property=["']og:image/i.test(html)) {
    headInjection += `\n    <meta property="og:image" content="${ogImage}">`;
  }
  if (faviconUrl && !/<link[^>]*rel=["'](?:icon|shortcut icon)/i.test(html)) {
    headInjection += `\n    <link rel="icon" href="${faviconUrl}">`;
  }

  if (headInjection) {
    html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${headInjection}`);
  }

  return html;
}

/**
 * <!--@include("filename.html")--> 처리
 */
async function processIncludes(siteId: string, html: string, depth: number): Promise<string> {
  if (depth >= 3) return html;

  const includeRegex = /<!--@include\("([^"]+)"\)-->/g;
  const matches = [...html.matchAll(includeRegex)];

  for (const match of matches) {
    const [fullMatch, includeFilename] = match;
    // site_files 우선, 없으면 web_skin_files fallback
    const fileContent = await getFileContent(siteId, includeFilename);

    let replacement = fileContent || `<!-- include not found: ${includeFilename} -->`;
    replacement = await processIncludes(siteId, replacement, depth + 1);
    html = html.replace(fullMatch, replacement);
  }

  return html;
}

/**
 * <!--@staff_loop-->...<!--@end_staff_loop--> 처리
 */
async function processStaffLoop(siteId: string, html: string): Promise<string> {
  const loopRegex = /<!--@staff_loop-->([\s\S]*?)<!--@end_staff_loop-->/g;
  const match = loopRegex.exec(html);

  if (!match) return html;

  const [fullMatch, template] = match;

  // 직원 데이터 로드 (siteContents type='staff')
  const staffList = await db.select()
    .from(siteContents)
    .where(and(
      eq(siteContents.siteId, siteId),
      eq(siteContents.type, 'staff'),
      eq(siteContents.isVisible, true)
    ))
    .orderBy(asc(siteContents.sortOrder));

  if (staffList.length === 0) {
    // staff 데이터가 없으면 상위 section 을 숨기기 위한 마커 렌더링.
    // style.css 에서 `.rs:has([data-empty="1"]) { display: none }` 으로 전체 섹션 숨김.
    return html.replace(fullMatch, '<div class="roo-empty" data-empty="1" hidden></div>');
  }

  const rendered = staffList.map(staff => {
    const meta = (staff.metaJson || {}) as Record<string, string>;
    return template
      .replace(/\{\{STAFF_PHOTO\}\}/g, resolveAssetUrl(staff.thumbUrl))
      .replace(/\{\{STAFF_NAME\}\}/g, staff.title || '')
      .replace(/\{\{STAFF_POSITION\}\}/g, meta.position || '')
      .replace(/\{\{STAFF_EMAIL\}\}/g, meta.email || '')
      .replace(/\{\{STAFF_PHONE\}\}/g, meta.phone || '');
  }).join('\n');

  return html.replace(fullMatch, rendered);
}

/**
 * {{VARIABLE}} 치환코드 적용
 */
async function applyVariables(ctx: TemplateContext, html: string): Promise<string> {
  const base = (ctx.configs.base || {}) as Record<string, string>;
  const headerfooter = (ctx.configs.headerfooter || {}) as Record<string, string>;
  const design = (ctx.configs.design || {}) as Record<string, string>;
  const seo = (ctx.configs.seo || {}) as Record<string, string>;

  // Owner 정보 로드
  const owners = await db.select()
    .from(siteAdmins)
    .where(and(
      eq(siteAdmins.siteId, ctx.siteId),
      eq(siteAdmins.role, 'owner')
    ))
    .limit(1);

  const owner = owners[0];

  // Owner 상세정보 (siteContents type='owner_profile'에서)
  const ownerProfile = await db.select()
    .from(siteContents)
    .where(and(
      eq(siteContents.siteId, ctx.siteId),
      eq(siteContents.type, 'owner_profile')
    ))
    .limit(1);

  const ownerMeta = (ownerProfile[0]?.metaJson || {}) as Record<string, string>;

  const variables: Record<string, string> = {
    // 기본 치환코드
    'COMPANY_NAME': base.site_name || base.company_name || '',
    'REPRESENTATIVE': base.representative || headerfooter.representative || '',
    'PHONE': base.phone || headerfooter.phone || '',
    'EMAIL': base.email || headerfooter.email || '',
    'ADDRESS': base.address || headerfooter.address || '',
    // 자산 URL: /storage/... 레거시 경로는 ADMIN_API_URL 로 정규화 (Laravel 서버로 직행)
    'LOGO_URL': resolveAssetUrl(base.logo_url || headerfooter.logo_url || design.logo_url || ''),
    'BUSINESS_NUMBER': base.business_number || headerfooter.business_number || '',
    'COPYRIGHT': headerfooter.copyright || `© ${new Date().getFullYear()} ${base.site_name || ''}`,

    // 대표(Owner) 치환코드
    'OWNER_NAME': owner?.name || ownerMeta.name || '',
    'OWNER_PHOTO': resolveAssetUrl(ownerProfile[0]?.thumbUrl || ownerMeta.photo || ''),
    'OWNER_POSITION': ownerMeta.position || '',
    'OWNER_EMAIL': ownerMeta.email || '',
    'OWNER_PHONE': ownerMeta.phone || '',

    // 사이트 URL
    'SITE_URL': `/${ctx.slug}`,
    'SLUG': ctx.slug,

    // SEO / 마케팅
    'META_TITLE': seo.meta_title || base.site_name || base.title || '',
    'META_DESC': seo.meta_description || base.description || '',
    'META_KEYWORDS': seo.meta_keywords || '',
    'OG_TITLE': seo.og_title || seo.meta_title || base.site_name || '',
    'OG_DESC': seo.og_description || seo.meta_description || '',
    'OG_IMAGE': resolveAssetUrl(seo.og_image || ''),
    'FAVICON_URL': resolveAssetUrl(seo.favicon_url || ''),
    'SNS_SHARE_IMAGE': resolveAssetUrl(seo.sns_share_image || seo.og_image || ''),
    // 검색 로봇 — 기본 index,follow. 검색엔진 차단 시 noindex,nofollow 등
    'ROBOTS': seo.robots || 'index, follow',
  };

  let result = html;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return result;
}

/**
 * 배너 영역 치환코드 처리
 * HTML에서 <div class="roo-banner-area" area_id="..."> 영역을 감지하고
 * 해당 영역의 배너 데이터로 치환코드를 적용
 */
async function processBannerAreas(siteId: string, html: string): Promise<string> {
  // 1. area_id 속성이 있는 모든 배너 영역 감지
  const areaIdRegex = /area_id="([^"]+)"/g;
  const areaIds: string[] = [];
  let areaMatch;
  while ((areaMatch = areaIdRegex.exec(html)) !== null) {
    if (!areaIds.includes(areaMatch[1])) {
      areaIds.push(areaMatch[1]);
    }
  }

  if (areaIds.length === 0) {
    // area_id 없어도 배너 루프가 있을 수 있으므로 전역 처리
    return processBannerLoops(siteId, html, null);
  }

  // 2. 각 area_id별로 배너 데이터 조회 및 치환 (area 범위 내에서만 치환)
  // 배경:
  //  - 과거 버전은 `processBannerLoops` 을 for-loop 외부에서 호출해, 서로 다른 영역이
  //    `<!--@banner_loop-->` 를 각자 가지고 있을 때 첫 번째 영역 아이템이 모든 루프를
  //    덮어씌우는 버그가 있었음.
  //  - 이번 수정: 번호 기반 치환코드(`{#img_1}` 등) 와 `<!--@banner_loop-->` 모두
  //    area 범위 안에서만 해당 area 의 items 로 치환되게 묶음.
  //  - 추가: `banner_areas` 테이블에 해당 `area_id` row 가 아예 없는 신규 사이트도
  //    스킨이 numbered code / banner_loop 를 가지고 있을 수 있으므로, row 부재 시에도
  //    "items=0 인 area" 로 간주해 동일한 정리 로직을 적용한다.
  for (const areaId of areaIds) {
    const area = await db.select()
      .from(bannerAreas)
      .where(and(
        eq(bannerAreas.siteId, siteId),
        eq(bannerAreas.areaId, areaId),
        eq(bannerAreas.isActive, true)
      ))
      .limit(1);

    // area row 가 없으면 items 도 자동으로 빈 배열
    const rawItems = area[0]
      ? await db.select()
          .from(bannerItems)
          .where(and(
            eq(bannerItems.areaId, area[0].id),
            eq(bannerItems.isActive, true)
          ))
          .orderBy(asc(bannerItems.sortOrder), asc(bannerItems.num))
      : [];

    // ── 다중 자산 JSON(images/videos/texts/links) 를 단일 필드로 전개(expand)
    //
    // 배경:
    //  - 루딤링크(Laravel) 어드민은 한 배너 슬롯(`banner_items` row)에 여러 이미지/영상/
    //    텍스트/링크를 JSON 배열로 저장한다. 예) area 3(블로그)의 num=1 row 하나에
    //    이미지 19장이 들어있음.
    //  - 기존 렌더러는 `img_url`/`video_url` 등 단일 컬럼만 봐서, 업로드된 이미지가
    //    모두 무시되고 `.roo-empty` 로 대체됐음.
    //
    // 전개 규칙:
    //  1) `images` 배열 길이 ≥ 2 : 배열 길이만큼 "가상 item" 으로 복제해 각 이미지를
    //     별개 배너로 렌더링. banner_loop 이 N 번 반복된다. texts/links 가 짧으면
    //     [0] 을 재사용.
    //  2) 배열이 비어있거나 1개 : 기존 단일 컬럼 + 배열[0] fallback. item 하나로 유지.
    //  3) 번호 기반 치환(`{#img_1}` 등) 은 `num` 속성으로 매칭되므로, 복제된 가상
    //     item 은 `num` 을 그대로 유지해 첫 번째만 매칭되게 둔다. (블로그처럼 루프
    //     기반 영역에서는 num 중복이 무관하다.)
    type RawItem = typeof rawItems[number];
    type RenderItem = RawItem; // 필드는 동일, 값이 채워져 있다는 보장만 다름.

    const expand = (item: RawItem): RenderItem[] => {
      const images = (item.images || []) as string[];
      const videos = (item.videos || []) as string[];
      const texts = (item.texts || []) as string[];
      const links = (item.links || []) as Array<{ url?: string; target?: string }>;

      // 여러 이미지를 가진 단일 row → 이미지 수만큼 전개
      if (images.length >= 2) {
        return images.map((img, i) => ({
          ...item,
          imgUrl: img,
          videoUrl: item.videoUrl || videos[i] || videos[0] || null,
          textContent: item.textContent || texts[i] || texts[0] || null,
          linkUrl: item.linkUrl || links[i]?.url || links[0]?.url || null,
          linkTarget: item.linkTarget || links[i]?.target || links[0]?.target || '_self',
        }));
      }

      // 단일 이미지/영상 → 배열[0] fallback 만 적용
      return [{
        ...item,
        imgUrl: item.imgUrl || images[0] || null,
        videoUrl: item.videoUrl || videos[0] || null,
        textContent: item.textContent || texts[0] || null,
        linkUrl: item.linkUrl || links[0]?.url || null,
        linkTarget: item.linkTarget || links[0]?.target || '_self',
      }];
    };

    const items: RenderItem[] = rawItems.flatMap(expand);

    // 영역 메타 + 번호 기반 + 루프 — 모두 이 area 의 scope 안에서만 치환
    // 주의: HTML 주석(`<!-- area_id="gallery" -->`) 안에 area_id 가 언급돼 있어도
    //       실제 banner-area div 만 잡도록 `<div ... class="...roo-banner-area..." area_id="..">`
    //       형태를 강제한다.
    const areaRegex = new RegExp(
      `(<div[^>]*roo-banner-area[^>]*area_id="${areaId}"[^>]*>)([\\s\\S]*?)(?=<div[^>]*roo-banner-area|$)`,
      'g'
    );
    html = html.replace(areaRegex,
      (fullMatch) => {
        let result = fullMatch;

        // 빈 area 마커: items 가 0 이면 banner-area 태그에 data-empty="1" 을 주입해
        // CSS 에서 상위 section 을 숨길 수 있게 한다 (`.rs:has([data-empty="1"]){display:none}`).
        if (items.length === 0) {
          // 첫 번째 `>` (= banner-area 여는 태그의 종료) 앞에 주입.
          result = result.replace(/^(<div[^>]*?)(>)/, '$1 data-empty="1"$2');
        }

        // 영역 메타 치환코드 (area row 부재 시 빈 문자열로 안전 기본)
        result = result.replace(/\{#areaName\}/g, area[0]?.areaName || '');
        result = result.replace(/\{#areaDesc\}/g, area[0]?.areaDesc || '');
        result = result.replace(/\{#areaDisplayType\}/g, area[0]?.displayType || 'slide');

        // ── 번호 기반 치환코드: {#img_1}, {#text_1} 등 ──
        // 중요: banner_loop 안에서 {#text_N} 은 "현재 배너의 texts 배열 N번째"를 의미하므로
        //       루프 블록을 먼저 보호하고, 루프 밖에서만 "num=N 배너 아이템" 매칭을 적용한다.
        const loopBlocks: string[] = [];
        let outsideLoops = result.replace(
          /<!--@banner_loop-->([\s\S]*?)<!--@end_banner_loop-->/g,
          (match) => { loopBlocks.push(match); return `__BLOOP_${loopBlocks.length - 1}__`; }
        );

        for (const item of items) {
          const n = item.num;
          outsideLoops = outsideLoops.replace(new RegExp(`\\{#img_${n}\\}`, 'g'), item.imgUrl || '');
          outsideLoops = outsideLoops.replace(new RegExp(`\\{#text_${n}\\}`, 'g'), item.textContent || '');
          outsideLoops = outsideLoops.replace(new RegExp(`\\{#link_${n}\\}`, 'g'), item.linkUrl || '');
          outsideLoops = outsideLoops.replace(new RegExp(`\\{#video_${n}\\}`, 'g'), item.videoUrl || '');
          outsideLoops = outsideLoops.replace(new RegExp(`\\{#target_${n}\\}`, 'g'), item.linkTarget || '_self');
          outsideLoops = outsideLoops.replace(new RegExp(`\\{#title_${n}\\}`, 'g'), item.title || '');
          outsideLoops = outsideLoops.replace(new RegExp(`\\{#html_${n}\\}`, 'g'), item.htmlContent || '');

          const mediaRegex = new RegExp(`\\{#img_${n}_or_video_${n}\\}`, 'g');
          outsideLoops = outsideLoops.replace(mediaRegex, () => {
            if (item.imgUrl) return `<img src="${item.imgUrl}" alt="${item.title || ''}" loading="lazy">`;
            if (item.videoUrl) return `<video src="${item.videoUrl}" autoplay muted loop playsinline></video>`;
            return '';
          });
        }

        // 루프 블록 복원
        result = outsideLoops.replace(/__BLOOP_(\d+)__/g, (_, idx) => loopBlocks[parseInt(idx)]);

        // ── 배너 루프 — area 범위 안에서만 처리 ──
        // 루프 안 {#text_N} → 현재 아이템의 texts[N-1], {#img_N} → images[N-1] 등
        result = result.replace(/<!--@banner_loop-->([\s\S]*?)<!--@end_banner_loop-->/g, (loopMatch, template) => {
          if (items.length === 0) {
            return '<!-- no banner data -->';
          }
          return items.map(item => {
            let rendered = template
              .replace(/\{#img\}/g, item.imgUrl || '')
              .replace(/\{#text\}/g, item.textContent || '')
              .replace(/\{#link\}/g, item.linkUrl || '')
              .replace(/\{#video\}/g, item.videoUrl || '')
              .replace(/\{#target\}/g, item.linkTarget || '_self')
              .replace(/\{#title\}/g, item.title || '')
              .replace(/\{#html\}/g, item.htmlContent || '')
              .replace(/\{#num\}/g, String(item.num))
              .replace(/\{#displayType\}/g, item.displayType || '')
              .replace(/\{#img_or_video\}/g, () => {
                if (item.imgUrl) return `<img src="${item.imgUrl}" alt="${item.title || ''}" loading="lazy">`;
                if (item.videoUrl) return `<video src="${item.videoUrl}" autoplay muted loop playsinline></video>`;
                return '';
              });

            // 번호 기반 → 현재 아이템의 JSON 배열에서 N번째 (1-indexed)
            const itemTexts = (item.texts || []) as string[];
            const itemImages = (item.images || []) as string[];
            const itemVideos = (item.videos || []) as string[];
            const itemLinks = (item.links || []) as Array<{ url?: string; target?: string }>;

            rendered = rendered
              .replace(/\{#text_(\d+)\}/g, (_m: string, n: string) => itemTexts[parseInt(n) - 1] || '')
              .replace(/\{#img_(\d+)\}/g, (_m: string, n: string) => itemImages[parseInt(n) - 1] || '')
              .replace(/\{#video_(\d+)\}/g, (_m: string, n: string) => itemVideos[parseInt(n) - 1] || '')
              .replace(/\{#link_(\d+)\}/g, (_m: string, n: string) => itemLinks[parseInt(n) - 1]?.url || '')
              .replace(/\{#target_(\d+)\}/g, (_m: string, n: string) => itemLinks[parseInt(n) - 1]?.target || '_self')
              .replace(/\{#title_(\d+)\}/g, (_m: string, n: string) => itemTexts[parseInt(n) - 1] || '')
              .replace(/\{#img_(\d+)_or_video_\1\}/g, (_m: string, n: string) => {
                const img = itemImages[parseInt(n) - 1];
                const vid = itemVideos[parseInt(n) - 1];
                if (img) return `<img src="${img}" alt="${item.title || ''}" loading="lazy">`;
                if (vid) return `<video src="${vid}" autoplay muted loop playsinline></video>`;
                return '';
              });

            return rendered;
          }).join('\n');
        });

        // 빈 area 클린업 — items 배열이 비어있거나 해당 슬롯에 data 가 없으면
        // 번호 기반 치환코드가 raw 문자열로 남는다. "{#img_3_or_video_3}" 같은 조합형을 먼저,
        // 그 다음 단순 키를 지운다.
        result = result.replace(/\{#img_(\d+)_or_video_\1\}/g, '');
        result = result.replace(/\{#(img|text|link|video|target|title|html)_\d+\}/g, '');

        return result;
      }
    );
  }

  // 3. area 바깥에 남아있는 orphan banner_loop 는 "no data" 로 정리
  html = await processBannerLoops(siteId, html, null);

  return html;
}

/**
 * <!--@banner_loop-->...<!--@end_banner_loop--> 처리
 */
async function processBannerLoops(
  siteId: string,
  html: string,
  items: Array<{
    num: number; title: string | null; imgUrl: string | null;
    videoUrl: string | null; linkUrl: string | null; linkTarget: string | null;
    textContent: string | null; htmlContent: string | null; displayType: string | null;
  }> | null
): Promise<string> {
  const loopRegex = /<!--@banner_loop-->([\s\S]*?)<!--@end_banner_loop-->/g;
  let match;
  let result = html;

  while ((match = loopRegex.exec(html)) !== null) {
    const [fullMatch, template] = match;

    if (!items || items.length === 0) {
      result = result.replace(fullMatch, '<!-- no banner data -->');
      continue;
    }

    const rendered = items.map(item => {
      return template
        .replace(/\{#img\}/g, item.imgUrl || '')
        .replace(/\{#text\}/g, item.textContent || '')
        .replace(/\{#link\}/g, item.linkUrl || '')
        .replace(/\{#video\}/g, item.videoUrl || '')
        .replace(/\{#target\}/g, item.linkTarget || '_self')
        .replace(/\{#title\}/g, item.title || '')
        .replace(/\{#html\}/g, item.htmlContent || '')
        .replace(/\{#num\}/g, String(item.num))
        .replace(/\{#displayType\}/g, item.displayType || '')
        .replace(/\{#img_or_video\}/g, () => {
          if (item.imgUrl) return `<img src="${item.imgUrl}" alt="${item.title || ''}" loading="lazy">`;
          if (item.videoUrl) return `<video src="${item.videoUrl}" autoplay muted loop playsinline></video>`;
          return '';
        });
    }).join('\n');

    result = result.replace(fullMatch, rendered);
  }

  return result;
}

/**
 * `form.roo-inquiry` 에 바인딩되는 제출 핸들러 스크립트.
 *
 * 영역 = `<form class="roo-inquiry">` 요소. 그 안의 모든 label + input/textarea/select
 * 쌍을 순회해 `<p><strong>라벨</strong>: 값</p>` HTML 로 합치고, `{slug, content, mode:'unified'}`
 * 로 `/api/public/inquiry` 에 POST. 스킨이 어느 사이트에서 렌더되든 `${slug}` 는 이미
 * 상위 라우터가 호스트→slug 해석을 마친 뒤 주입해 줘서 자동 사이트 감지가 성립함.
 *
 * 한 페이지에 여러 form.roo-inquiry 가 있어도 한 번만 바인딩되도록 window 플래그로 보호.
 */
function rooInquiryScript(slug: string): string {
  return `<script>
(function(){
  if (window.__roo_inquiry_bound) return;
  window.__roo_inquiry_bound = true;
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function gather(form){
    var lines = [];
    var labels = Array.prototype.slice.call(form.querySelectorAll('label'));
    var used = new Set();
    // 1) label[for=id] + 해당 control
    labels.forEach(function(lbl){
      var forId = lbl.getAttribute('for');
      var ctl = forId ? form.querySelector('#' + CSS.escape(forId)) : lbl.querySelector('input,textarea,select');
      if (!ctl || used.has(ctl)) return;
      used.add(ctl);
      var label = (lbl.textContent || '').trim();
      var value = (ctl.type === 'checkbox' || ctl.type === 'radio')
        ? (ctl.checked ? (ctl.value || '체크됨') : '')
        : (ctl.value || '').trim();
      if (!label && !value) return;
      lines.push('<p><strong>' + esc(label) + '</strong>: ' + esc(value).replace(/\\n/g,'<br>') + '</p>');
    });
    // 2) label 이 없는 나머지 control — name 기반
    form.querySelectorAll('input,textarea,select').forEach(function(ctl){
      if (used.has(ctl)) return;
      if (ctl.type === 'submit' || ctl.type === 'button' || ctl.type === 'hidden') return;
      used.add(ctl);
      var label = (ctl.getAttribute('placeholder') || ctl.name || '').trim();
      var value = (ctl.type === 'checkbox' || ctl.type === 'radio')
        ? (ctl.checked ? (ctl.value || '체크됨') : '')
        : (ctl.value || '').trim();
      if (!label && !value) return;
      lines.push('<p><strong>' + esc(label) + '</strong>: ' + esc(value).replace(/\\n/g,'<br>') + '</p>');
    });
    return lines.join('\\n');
  }
  function bind(form){
    if (form.__roo_bound) return;
    form.__roo_bound = true;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"],input[type="submit"],.roo-inquiry-submit');
      var msg = form.querySelector('#roo-inquiry-msg') || document.getElementById('roo-inquiry-msg');
      if (btn) { btn.disabled = true; var origText = btn.textContent; btn.textContent = '접수 중...'; }
      var content = gather(form);
      if (!content) {
        if (msg) { msg.style.display='block'; msg.style.background='#fce4ec'; msg.style.color='#c62828'; msg.textContent='입력된 내용이 없습니다.'; }
        if (btn) { btn.disabled = false; btn.textContent = origText || '문의 접수'; }
        return;
      }
      fetch('/api/public/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: '${slug}', content: content, mode: 'unified' })
      }).then(function(r){ return r.json(); }).then(function(data){
        if (data.ok) {
          if (msg) { msg.style.display='block'; msg.style.background='#e8f5e9'; msg.style.color='#2e7d32'; msg.textContent='문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.'; }
          else { alert('문의가 접수되었습니다.'); }
          form.reset();
          var modal = document.getElementById('roo-inquiry-modal');
          if (modal) setTimeout(function(){ modal.style.display='none'; if (msg) msg.style.display='none'; }, 2500);
        } else {
          if (msg) { msg.style.display='block'; msg.style.background='#fce4ec'; msg.style.color='#c62828'; msg.textContent = data.error || '접수 실패. 다시 시도해주세요.'; }
          else { alert(data.error || '접수 실패'); }
        }
      }).catch(function(){
        if (msg) { msg.style.display='block'; msg.style.background='#fce4ec'; msg.style.color='#c62828'; msg.textContent='네트워크 오류. 다시 시도해주세요.'; }
        else { alert('네트워크 오류'); }
      }).finally(function(){
        if (btn) { btn.disabled = false; btn.textContent = origText || '문의 접수'; }
      });
    });
  }
  function init(){
    document.querySelectorAll('form.roo-inquiry').forEach(bind);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>`;
}

/**
 * 게시판 치환코드 처리
 * - <!--@inquiry_form--> : 자동 모달 + 기본 4개 필드. 제출 시 통합 텍스트로 수집 → roodim-web DB 저장.
 * - <form class="roo-inquiry"> : 스킨 직접 작성 폼. 동일 수집 스크립트 자동 바인딩. (신규)
 * - <!--@qna_loop-->...<!--@end_qna_loop--> : 로컬 Q&A 반복 출력 (레거시)
 * - <!--@faq_loop-->...<!--@end_faq_loop--> : 루딤링크 Laravel FAQ 게시판 반복 출력
 * - <!--@inquiry_list--> : 최근 문의 목록 (title 만, 레거시)
 */
async function processBoardCodes(siteId: string, slug: string, html: string): Promise<string> {
  // 사이트 타입 + 어드민 조직 ID 조회 (partner 사이트 → 루딤링크 게시판 사용)
  const [siteRow] = await db.select({
    siteType: sites.siteType,
    adminOrganizationId: sites.adminOrganizationId,
  }).from(sites).where(eq(sites.id, siteId)).limit(1);
  const isPartner = siteRow?.siteType === 'partner' && !!siteRow.adminOrganizationId;
  const orgId = siteRow?.adminOrganizationId ?? null;

  // ── inquiry_form 위젯 ──
  if (html.includes('<!--@inquiry_form-->')) {
    // 문의 폼 필드 설정 로드 (없으면 기본 필드)
    const configRows = await db.select()
      .from(siteConfigs)
      .where(and(eq(siteConfigs.siteId, siteId), eq(siteConfigs.section, 'inquiry_form')))
      .limit(1);

    const formConfig = (configRows[0]?.data || {}) as Record<string, unknown>;
    const fields = (formConfig.fields as Array<{ name: string; type?: string; required?: boolean }>) || [
      { name: '성함', type: 'text', required: true },
      { name: '연락처', type: 'tel', required: true },
      { name: '이메일', type: 'email', required: false },
      { name: '문의내용', type: 'textarea', required: true },
    ];

    const fieldHtml = fields.map(f => {
      const req = f.required ? ' required' : '';
      if (f.type === 'textarea') {
        return `<div class="roo-form-field"><label>${escapeHtmlTpl(f.name)}</label><textarea name="${escapeHtmlTpl(f.name)}" rows="4" placeholder="${escapeHtmlTpl(f.name)}을(를) 입력하세요"${req}></textarea></div>`;
      }
      return `<div class="roo-form-field"><label>${escapeHtmlTpl(f.name)}</label><input type="${f.type || 'text'}" name="${escapeHtmlTpl(f.name)}" placeholder="${escapeHtmlTpl(f.name)}을(를) 입력하세요"${req}></div>`;
    }).join('\n          ');

    const widget = `
<!-- 문의 폼 위젯 (자동생성) -->
<div class="roo-inquiry-widget">
  <button type="button" class="roo-inquiry-trigger" onclick="document.getElementById('roo-inquiry-modal').style.display='flex'">문의하기</button>
  <div id="roo-inquiry-modal" class="roo-inquiry-modal" style="display:none">
    <div class="roo-inquiry-modal-content">
      <div class="roo-inquiry-modal-header">
        <h3>문의하기</h3>
        <button type="button" onclick="document.getElementById('roo-inquiry-modal').style.display='none'">&times;</button>
      </div>
      <form id="roo-inquiry-form" class="roo-inquiry roo-inquiry-form">
        <div class="roo-inquiry-fields">
          ${fieldHtml}
        </div>
        <div class="roo-inquiry-actions">
          <button type="submit" class="roo-inquiry-submit">문의 접수</button>
        </div>
        <div id="roo-inquiry-msg" style="display:none;padding:8px;margin-top:8px;border-radius:4px;text-align:center"></div>
      </form>
    </div>
  </div>
</div>
<style>
.roo-inquiry-trigger{background:#cc222c;color:#fff;border:none;padding:12px 24px;border-radius:6px;font-size:15px;cursor:pointer;font-weight:600}
.roo-inquiry-trigger:hover{opacity:.9}
.roo-inquiry-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center}
.roo-inquiry-modal-content{background:#fff;border-radius:12px;width:min(480px,90vw);max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.roo-inquiry-modal-header{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #eee}
.roo-inquiry-modal-header h3{margin:0;font-size:18px}
.roo-inquiry-modal-header button{background:none;border:none;font-size:24px;cursor:pointer;color:#999}
.roo-inquiry-form{padding:24px}
.roo-inquiry-fields{display:flex;flex-direction:column;gap:16px}
.roo-form-field label{display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:#333}
.roo-form-field input,.roo-form-field textarea{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box}
.roo-form-field input:focus,.roo-form-field textarea:focus{outline:none;border-color:#cc222c}
.roo-inquiry-actions{margin-top:20px;text-align:center}
.roo-inquiry-submit{background:#cc222c;color:#fff;border:none;padding:12px 40px;border-radius:6px;font-size:15px;cursor:pointer;font-weight:600}
.roo-inquiry-submit:hover{opacity:.9}
.roo-inquiry-submit:disabled{opacity:.5;cursor:not-allowed}
</style>
${rooInquiryScript(slug)}
<!-- /문의 폼 위젯 -->`;

    html = html.replace('<!--@inquiry_form-->', widget);
  }

  // ── 스킨이 직접 작성한 form.roo-inquiry 감지 — 수집 스크립트 1회 주입 ──
  // 스킨 제작자가 `<!--@inquiry_form-->` 대신 자유 레이아웃으로 폼을 짠 경우,
  // `<form class="roo-inquiry">` 내부의 모든 label + input/textarea/select 값을
  // 하나의 HTML 본문으로 합쳐서 제출한다. (공통 1개 치환코드, 자동 사이트 감지)
  if (
    !html.includes('window.__roo_inquiry_bound') &&
    /<form\b[^>]*\bclass\s*=\s*["'][^"']*\broo-inquiry\b/i.test(html)
  ) {
    html = html.replace('</body>', `${rooInquiryScript(slug)}\n</body>`);
    // </body> 없는 스킨 대응 — 맨 끝에 추가
    if (!html.includes('window.__roo_inquiry_bound')) {
      html += `\n${rooInquiryScript(slug)}`;
    }
  }

  // ── faq_loop (루딤링크 Laravel 어드민 FAQ 게시판에서 로드) ──
  // 마커: <!--@faq_loop-->...<!--@end_faq_loop-->
  // 템플릿 변수: {#faq_title}, {#faq_content}, {#faq_num}, {#faq_date}
  // partner 사이트 → Bridge API (/api/bridge/bulletins/faq/posts?org_id=X)
  // 기타 사이트 → 기존 경로 (하위호환)
  const faqLoopRegex = /<!--@faq_loop-->([\s\S]*?)<!--@end_faq_loop-->/g;
  const faqMatch = faqLoopRegex.exec(html);
  if (faqMatch) {
    const [fullMatch, template] = faqMatch;
    try {
      const faqApiPath = isPartner && orgId
        ? `/api/bridge/bulletins/faq/posts?org_id=${orgId}&limit=50`
        : `/api/sites/${encodeURIComponent(slug)}/bulletins/faq/posts?limit=50`;
      const result = await adminApi<{ ok: boolean; posts?: Array<{ id: number; title: string; content: string; author: string | null; created_label: string }> }>(
        'GET', faqApiPath
      );
      const posts = result.ok && result.data?.posts ? result.data.posts : [];
      if (posts.length > 0) {
        const rendered = posts.map((post, idx) => template
          .replace(/\{#faq_title\}/g, escapeHtmlTpl(post.title || ''))
          .replace(/\{#faq_content\}/g, post.content || '')
          .replace(/\{#faq_num\}/g, String(idx + 1))
          .replace(/\{#faq_date\}/g, post.created_label || '')
        ).join('\n');
        html = html.replace(fullMatch, rendered);
      } else {
        html = html.replace(fullMatch, '<!-- no FAQ data -->');
      }
    } catch {
      html = html.replace(fullMatch, '<!-- FAQ load failed -->');
    }
  }

  // ── qna_loop ──
  // 항상 roodim-web DB(boards.systemKey='qna')를 먼저 조회.
  // 로컬 데이터 없고 partner 사이트일 때만 Bridge API 폴백.
  const qnaLoopRegex = /<!--@qna_loop-->([\s\S]*?)<!--@end_qna_loop-->/g;
  const qnaMatch = qnaLoopRegex.exec(html);
  if (qnaMatch) {
    const [fullMatch, template] = qnaMatch;
    let qnaResolved = false;

    // 1) 로컬 DB 조회 (partner 포함 모든 사이트)
    const [qnaBoard] = await db.select()
      .from(boards)
      .where(and(eq(boards.siteId, siteId), eq(boards.systemKey, 'qna')))
      .limit(1);

    if (qnaBoard) {
      const qnaPosts = await db.select()
        .from(boardPosts)
        .where(and(
          eq(boardPosts.boardId, qnaBoard.id),
          eq(boardPosts.isVisible, true),
        ))
        .orderBy(desc(boardPosts.isPinned), desc(boardPosts.createdAt))
        .limit(50);

      if (qnaPosts.length > 0) {
        const rendered = qnaPosts.map((post, idx) => {
          return template
            .replace(/\{#qna_title\}/g, escapeHtmlTpl(post.title))
            .replace(/\{#qna_content\}/g, post.content || '')
            .replace(/\{#qna_num\}/g, String(idx + 1))
            .replace(/\{#qna_author\}/g, escapeHtmlTpl(post.authorName || ''))
            .replace(/\{#qna_date\}/g, new Date(post.createdAt).toLocaleDateString('ko-KR'));
        }).join('\n');
        html = html.replace(fullMatch, rendered);
        qnaResolved = true;
      }
    }

    // 2) 로컬 데이터 없으면 partner Bridge API 폴백
    if (!qnaResolved && isPartner && orgId) {
      try {
        const result = await adminApi<{ ok: boolean; posts?: Array<{ id: number; title: string; content: string; author: string | null; created_label: string }> }>(
          'GET', `/api/bridge/bulletins/faq/posts?org_id=${orgId}&limit=50`
        );
        const posts = result.ok && result.data?.posts ? result.data.posts : [];
        if (posts.length > 0) {
          const rendered = posts.map((post, idx) => template
            .replace(/\{#qna_title\}/g, escapeHtmlTpl(post.title || ''))
            .replace(/\{#qna_content\}/g, post.content || '')
            .replace(/\{#qna_num\}/g, String(idx + 1))
            .replace(/\{#qna_author\}/g, escapeHtmlTpl(post.author || ''))
            .replace(/\{#qna_date\}/g, post.created_label || '')
          ).join('\n');
          html = html.replace(fullMatch, rendered);
          qnaResolved = true;
        }
      } catch { /* bridge fallback failed — continue to empty */ }
    }

    if (!qnaResolved) {
      html = html.replace(fullMatch, '<!-- no Q&A data -->');
    }
  }

  // ── #faq.fl 자동 연동 ──
  // 루딤링크(Laravel) FAQ 게시판이 있고, 스킨 HTML 에 <ul id="faq" class="fl">
  // (또는 ol / class 에 fl 포함) 이 있으면 해당 요소의 <li> 하위를 FAQ 데이터로 치환.
  //
  // 작동 방식:
  //   1) <ul id="faq" class="... fl ...">...</ul> 매칭 (ol 도 지원, id/class 순서 무관)
  //   2) 안쪽 첫 <li>...</li> 를 템플릿으로 사용
  //   3) 템플릿 내에 {#faq_title} / {#faq_content} / {#faq_num} / {#faq_date} 플레이스홀더가
  //      있으면 해당 값으로 치환. 플레이스홀더가 전혀 없으면 안전한 기본 구조로 교체.
  //   4) <!--@faq_loop--> 마커가 이미 페이지에 있으면 해당 블록의 처리를 우선하고,
  //      #faq.fl 자동 주입은 중복 방지를 위해 건너뜀.
  //
  // 목적: 사용자가 기존 스킨 HTML 의 <ul id="faq" class="fl"> 에 하드코딩한 예시 FAQ 를
  //       매번 수정하지 않아도, 루딤링크의 FAQ 게시판 데이터가 자동 반영되게 함.
  if (!html.includes('<!--@faq_loop-->')) {
    const faqListRegex = /<(ul|ol)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    const matches: Array<{ full: string; tag: string; attrs: string; inner: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = faqListRegex.exec(html)) !== null) {
      const [full, tag, attrs, inner] = m;
      // id="faq" AND class 에 "fl" 이 하나의 단어로 포함
      const hasFaqId = /\bid\s*=\s*["']faq["']/i.test(attrs);
      const hasFlClass = /\bclass\s*=\s*["'][^"']*\bfl\b[^"']*["']/i.test(attrs);
      if (hasFaqId && hasFlClass) {
        matches.push({ full, tag, attrs, inner });
      }
    }

    if (matches.length > 0) {
      // Laravel 어드민 FAQ 조회 (fail-open — 실패 시 원본 유지)
      const faqAutoPath = isPartner && orgId
        ? `/api/bridge/bulletins/faq/posts?org_id=${orgId}&limit=50`
        : `/api/sites/${encodeURIComponent(slug)}/bulletins/faq/posts?limit=50`;
      let posts: Array<{ id: number; title: string; content: string; author: string | null; created_label: string }> = [];
      try {
        const result = await adminApi<{ ok: boolean; posts?: typeof posts }>(
          'GET', faqAutoPath
        );
        if (result.ok && result.data?.posts) {
          posts = result.data.posts;
        }
      } catch {
        // 네트워크/HMAC 오류 시 원본 그대로 (디자인 깨짐 방지)
      }

      if (posts.length > 0) {
        for (const match of matches) {
          // 첫 <li>...</li> 를 템플릿으로
          const liMatch = /<li\b[^>]*>[\s\S]*?<\/li>/i.exec(match.inner);
          const templateLi = liMatch
            ? liMatch[0]
            : '<li><strong>{#faq_title}</strong><div>{#faq_content}</div></li>';

          const hasPlaceholder = /\{#faq_(title|content|num|date)\}/.test(templateLi);

          const renderedItems = posts.map((post, idx) => {
            if (hasPlaceholder) {
              return templateLi
                .replace(/\{#faq_title\}/g, escapeHtmlTpl(post.title || ''))
                .replace(/\{#faq_content\}/g, post.content || '')
                .replace(/\{#faq_num\}/g, String(idx + 1))
                .replace(/\{#faq_date\}/g, post.created_label || '');
            }
            // 플레이스홀더 없으면 최소 안전 구조로 치환 (원 <li> 디자인 유지 위해 최소 HTML)
            return `<li><strong>${escapeHtmlTpl(post.title || '')}</strong><div>${post.content || ''}</div></li>`;
          }).join('\n');

          const replacement = `<${match.tag}${match.attrs}>\n${renderedItems}\n</${match.tag}>`;
          html = html.replace(match.full, replacement);
        }
      }
    }
  }

  // ── inquiry_list ──
  if (html.includes('<!--@inquiry_list-->')) {
    const [inquiryBoard] = await db.select()
      .from(boards)
      .where(and(eq(boards.siteId, siteId), eq(boards.systemKey, 'inquiry')))
      .limit(1);

    if (inquiryBoard) {
      const recentPosts = await db.select()
        .from(boardPosts)
        .where(and(eq(boardPosts.boardId, inquiryBoard.id), eq(boardPosts.isVisible, true)))
        .orderBy(desc(boardPosts.createdAt))
        .limit(10);

      if (recentPosts.length > 0) {
        const listHtml = `<ul class="roo-inquiry-list">\n${recentPosts.map(p =>
          `  <li><span class="roo-inquiry-list-title">${escapeHtmlTpl(p.title)}</span><span class="roo-inquiry-list-date">${new Date(p.createdAt).toLocaleDateString('ko-KR')}</span></li>`
        ).join('\n')}\n</ul>`;
        html = html.replace('<!--@inquiry_list-->', listHtml);
      } else {
        html = html.replace('<!--@inquiry_list-->', '<!-- no inquiries -->');
      }
    } else {
      html = html.replace('<!--@inquiry_list-->', '<!-- no inquiry board -->');
    }
  }

  return html;
}

/** 템플릿용 HTML 이스케이프 */
function escapeHtmlTpl(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 치환코드 목록 반환 (에디터에서 사용)
 */
export function getAvailableVariables(): { code: string; description: string; category: string }[] {
  return [
    // 기본
    { code: '{{COMPANY_NAME}}', description: '회사명', category: '기본정보' },
    { code: '{{REPRESENTATIVE}}', description: '대표자명', category: '기본정보' },
    { code: '{{PHONE}}', description: '전화번호', category: '기본정보' },
    { code: '{{EMAIL}}', description: '이메일', category: '기본정보' },
    { code: '{{ADDRESS}}', description: '주소', category: '기본정보' },
    { code: '{{LOGO_URL}}', description: '로고 이미지 URL', category: '기본정보' },
    { code: '{{BUSINESS_NUMBER}}', description: '사업자번호', category: '기본정보' },
    { code: '{{COPYRIGHT}}', description: '저작권 텍스트', category: '기본정보' },
    // 대표
    { code: '{{OWNER_NAME}}', description: '비즈대표 이름', category: '대표정보' },
    { code: '{{OWNER_PHOTO}}', description: '비즈대표 프로필 사진 URL', category: '대표정보' },
    { code: '{{OWNER_POSITION}}', description: '비즈대표 직위', category: '대표정보' },
    { code: '{{OWNER_EMAIL}}', description: '비즈대표 이메일', category: '대표정보' },
    { code: '{{OWNER_PHONE}}', description: '비즈대표 연락처', category: '대표정보' },
    // 직원 루프
    { code: '<!--@staff_loop-->', description: '직원 루프 시작', category: '직원루프' },
    { code: '<!--@end_staff_loop-->', description: '직원 루프 끝', category: '직원루프' },
    { code: '{{STAFF_PHOTO}}', description: '직원 프로필 사진 (루프 내)', category: '직원루프' },
    { code: '{{STAFF_NAME}}', description: '직원 이름 (루프 내)', category: '직원루프' },
    { code: '{{STAFF_POSITION}}', description: '직원 직위 (루프 내)', category: '직원루프' },
    // Include
    { code: '<!--@include("header.html")-->', description: '헤더 파일 삽입', category: 'Include' },
    { code: '<!--@include("footer.html")-->', description: '푸터 파일 삽입', category: 'Include' },
    // 사이트
    { code: '{{SITE_URL}}', description: '사이트 기본 경로', category: '사이트' },
    { code: '{{SLUG}}', description: '사이트 슬러그', category: '사이트' },
    // SEO / 마케팅
    { code: '{{META_TITLE}}', description: '메타 타이틀', category: 'SEO' },
    { code: '{{META_DESC}}', description: '메타 설명', category: 'SEO' },
    { code: '{{META_KEYWORDS}}', description: '메타 키워드', category: 'SEO' },
    { code: '{{OG_TITLE}}', description: 'OG 타이틀 (SNS 공유 제목)', category: 'SEO' },
    { code: '{{OG_DESC}}', description: 'OG 설명 (SNS 공유 설명)', category: 'SEO' },
    { code: '{{OG_IMAGE}}', description: 'OG 이미지 URL (SNS 공유 이미지)', category: 'SEO' },
    { code: '{{FAVICON_URL}}', description: '파비콘 이미지 URL', category: 'SEO' },
    { code: '{{SNS_SHARE_IMAGE}}', description: 'SNS 공유 이미지 URL', category: 'SEO' },
    { code: '{{ROBOTS}}', description: '검색 로봇 지시자 (index,follow / noindex,nofollow 등)', category: 'SEO' },
    // 레이아웃 (헤더/푸터)
    { code: '<!--@header-->', description: '스킨의 header.html 내용 삽입 (없으면 미노출)', category: '레이아웃' },
    { code: '<!--@footer-->', description: '스킨의 footer.html 내용 삽입 (없으면 미노출)', category: '레이아웃' },
    { code: '<!--@include("파일명.html")-->', description: '임의의 스킨 파일 삽입 (최대 3단계 중첩)', category: '레이아웃' },
    // 배너 치환코드
    { code: '{#img_N}', description: '배너 N번 이미지 URL', category: '배너' },
    { code: '{#text_N}', description: '배너 N번 텍스트', category: '배너' },
    { code: '{#link_N}', description: '배너 N번 링크 URL', category: '배너' },
    { code: '{#video_N}', description: '배너 N번 동영상 URL', category: '배너' },
    { code: '{#target_N}', description: '배너 N번 링크 타겟 (_blank/_self)', category: '배너' },
    { code: '{#title_N}', description: '배너 N번 제목', category: '배너' },
    { code: '{#img_N_or_video_N}', description: '이미지/동영상 자동 태그', category: '배너' },
    { code: '{#areaName}', description: '배너 영역 이름', category: '배너' },
    { code: '{#areaDesc}', description: '배너 영역 설명', category: '배너' },
    { code: '<!--@banner_loop-->', description: '배너 루프 시작', category: '배너루프' },
    { code: '<!--@end_banner_loop-->', description: '배너 루프 끝', category: '배너루프' },
    { code: '{#img}', description: '현재 배너 이미지 (루프 내)', category: '배너루프' },
    { code: '{#text}', description: '현재 배너 텍스트 (루프 내)', category: '배너루프' },
    { code: '{#link}', description: '현재 배너 링크 (루프 내)', category: '배너루프' },
    { code: '{#title}', description: '현재 배너 제목 (루프 내)', category: '배너루프' },
    { code: '{#num}', description: '현재 배너 번호 (루프 내)', category: '배너루프' },
    // 게시판 치환코드
    { code: '<!--@inquiry_form-->', description: '문의 폼 팝업 위젯', category: '게시판' },
    { code: '<!--@inquiry_list-->', description: '최근 문의 목록', category: '게시판' },
    { code: '<!--@qna_loop-->', description: 'Q&A 루프 시작', category: '게시판' },
    { code: '<!--@end_qna_loop-->', description: 'Q&A 루프 끝', category: '게시판' },
    { code: '{#qna_title}', description: 'Q&A 제목 (루프 내)', category: '게시판' },
    { code: '{#qna_content}', description: 'Q&A 내용 (루프 내)', category: '게시판' },
    { code: '{#qna_num}', description: 'Q&A 번호 (루프 내)', category: '게시판' },
    { code: '{#qna_author}', description: 'Q&A 작성자 (루프 내)', category: '게시판' },
    { code: '{#qna_date}', description: 'Q&A 작성일 (루프 내)', category: '게시판' },
    // FAQ 치환코드 (루딤링크 Laravel 어드민 FAQ 게시판 기반)
    { code: '<!--@faq_loop-->', description: 'FAQ 루프 시작 (루딤링크 FAQ)', category: '게시판' },
    { code: '<!--@end_faq_loop-->', description: 'FAQ 루프 끝', category: '게시판' },
    { code: '{#faq_title}', description: 'FAQ 질문 (루프 내)', category: '게시판' },
    { code: '{#faq_content}', description: 'FAQ 답변 HTML (루프 내)', category: '게시판' },
    { code: '{#faq_num}', description: 'FAQ 순번 (루프 내)', category: '게시판' },
    { code: '{#faq_date}', description: 'FAQ 작성일 (루프 내)', category: '게시판' },
  ];
}
