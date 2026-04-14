import { db } from './db';
import { siteFiles, siteContents, siteConfigs, siteAdmins, sites, webSkinFiles, bannerAreas, bannerItems } from '@/drizzle/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getFileContent } from './site';

interface TemplateContext {
  siteId: string;
  slug: string;
  configs: Record<string, Record<string, unknown>>;
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

  // 1. include 처리 (최대 3 depth)
  html = await processIncludes(siteId, html, 0);

  // 2. 직원 루프 처리
  html = await processStaffLoop(siteId, html);

  // 3. 배너 영역 치환코드 처리
  html = await processBannerAreas(siteId, html);

  // 4. 치환코드 적용
  html = await applyVariables(ctx, html);

  // 5. <head> 자동 주입 (base 태그 + style.css fallback)
  // 목적:
  //  - <base> : 상대경로 에셋 해결 (이미지/링크 등)
  //  - style.css 자동 link: 스킨 HTML 템플릿이 CSS 링크를 누락해도 동작 보장
  //    (브랜드온도 스킨 사례: web_skin_files.style.css 는 있지만 index.html 에
  //     <link rel="stylesheet"> 태그가 빠져있어 화면이 무스타일로 나오던 문제)
  const needsBase = !/<base\s/i.test(html);
  const alreadyLinksLocalCss = /<link[^>]*rel=["']?stylesheet[^>]*href=["']?(?!https?:|\/\/)[^"'>]*\.css/i.test(html);

  let headInjection = '';
  if (needsBase) {
    headInjection += `\n    <base href="/${slug}/">`;
  }
  if (!alreadyLinksLocalCss) {
    // style.css 가 실제 web_skin_files / site_files 에 존재할 때만 주입
    const cssFile = await getFileContent(siteId, 'style.css');
    if (cssFile) {
      headInjection += `\n    <link rel="stylesheet" href="style.css">`;
    }
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
    return html.replace(fullMatch, '<!-- no staff data -->');
  }

  const rendered = staffList.map(staff => {
    const meta = (staff.metaJson || {}) as Record<string, string>;
    return template
      .replace(/\{\{STAFF_PHOTO\}\}/g, staff.thumbUrl || '')
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
    'LOGO_URL': base.logo_url || design.logo_url || '',
    'BUSINESS_NUMBER': base.business_number || headerfooter.business_number || '',
    'COPYRIGHT': headerfooter.copyright || `© ${new Date().getFullYear()} ${base.site_name || ''}`,

    // 대표(Owner) 치환코드
    'OWNER_NAME': owner?.name || ownerMeta.name || '',
    'OWNER_PHOTO': ownerProfile[0]?.thumbUrl || ownerMeta.photo || '',
    'OWNER_POSITION': ownerMeta.position || '',
    'OWNER_EMAIL': ownerMeta.email || '',
    'OWNER_PHONE': ownerMeta.phone || '',

    // 사이트 URL
    'SITE_URL': `/${ctx.slug}`,
    'SLUG': ctx.slug,
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

  // 2. 각 area_id별로 배너 데이터 조회 및 치환
  for (const areaId of areaIds) {
    const area = await db.select()
      .from(bannerAreas)
      .where(and(
        eq(bannerAreas.siteId, siteId),
        eq(bannerAreas.areaId, areaId),
        eq(bannerAreas.isActive, true)
      ))
      .limit(1);

    if (!area[0]) continue;

    const items = await db.select()
      .from(bannerItems)
      .where(and(
        eq(bannerItems.areaId, area[0].id),
        eq(bannerItems.isActive, true)
      ))
      .orderBy(asc(bannerItems.sortOrder), asc(bannerItems.num));

    // 영역 메타 치환
    html = html.replace(new RegExp(`(area_id="${areaId}"[^>]*>)([\\s\\S]*?)(?=<div class="roo-banner-area"|$)`, 'g'),
      (fullMatch) => {
        let result = fullMatch;

        // 영역 메타 치환코드
        result = result.replace(/\{#areaName\}/g, area[0].areaName || '');
        result = result.replace(/\{#areaDesc\}/g, area[0].areaDesc || '');
        result = result.replace(/\{#areaDisplayType\}/g, area[0].displayType || 'slide');

        // 개별 배너 번호 기반 치환코드: {#img_1}, {#text_1}, {#link_1}, {#video_1}, {#target_1}
        for (const item of items) {
          const n = item.num;
          result = result.replace(new RegExp(`\\{#img_${n}\\}`, 'g'), item.imgUrl || '');
          result = result.replace(new RegExp(`\\{#text_${n}\\}`, 'g'), item.textContent || '');
          result = result.replace(new RegExp(`\\{#link_${n}\\}`, 'g'), item.linkUrl || '');
          result = result.replace(new RegExp(`\\{#video_${n}\\}`, 'g'), item.videoUrl || '');
          result = result.replace(new RegExp(`\\{#target_${n}\\}`, 'g'), item.linkTarget || '_self');
          result = result.replace(new RegExp(`\\{#title_${n}\\}`, 'g'), item.title || '');
          result = result.replace(new RegExp(`\\{#html_${n}\\}`, 'g'), item.htmlContent || '');

          // {#img_N_or_video_N} — 이미지 우선, 없으면 비디오
          const mediaRegex = new RegExp(`\\{#img_${n}_or_video_${n}\\}`, 'g');
          result = result.replace(mediaRegex, () => {
            if (item.imgUrl) return `<img src="${item.imgUrl}" alt="${item.title || ''}" loading="lazy">`;
            if (item.videoUrl) return `<video src="${item.videoUrl}" autoplay muted loop playsinline></video>`;
            return '';
          });
        }

        return result;
      }
    );

    // 배너 루프 처리
    html = await processBannerLoops(siteId, html, items);
  }

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
  ];
}
