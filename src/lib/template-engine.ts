import { db } from './db';
import { siteFiles, siteContents, siteConfigs, siteAdmins } from '@/drizzle/schema';
import { eq, and, asc } from 'drizzle-orm';

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
  // 파일 로드
  const file = await db.select()
    .from(siteFiles)
    .where(and(
      eq(siteFiles.siteId, siteId),
      eq(siteFiles.filename, filename)
    ))
    .limit(1);

  if (!file[0] || !file[0].content) return null;

  // 설정 로드
  const configRows = await db.select()
    .from(siteConfigs)
    .where(eq(siteConfigs.siteId, siteId));

  const configs: Record<string, Record<string, unknown>> = {};
  for (const c of configRows) {
    configs[c.section] = c.data as Record<string, unknown>;
  }

  const ctx: TemplateContext = { siteId, slug, configs };

  let html = file[0].content;

  // 1. include 처리 (최대 3 depth)
  html = await processIncludes(siteId, html, 0);

  // 2. 직원 루프 처리
  html = await processStaffLoop(siteId, html);

  // 3. 치환코드 적용
  html = await applyVariables(ctx, html);

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
    const includeFile = await db.select({ content: siteFiles.content })
      .from(siteFiles)
      .where(and(
        eq(siteFiles.siteId, siteId),
        eq(siteFiles.filename, includeFilename)
      ))
      .limit(1);

    let replacement = includeFile[0]?.content || `<!-- include not found: ${includeFilename} -->`;
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
  ];
}
