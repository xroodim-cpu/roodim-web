import { db } from './db';
import { sites, siteConfigs, siteSections, siteContents, siteMenuItems, siteFiles } from '@/drizzle/schema';
import { eq, and, asc, desc } from 'drizzle-orm';

/**
 * slug로 사이트 조회
 */
export async function getSiteBySlug(slug: string) {
  const result = await db.select()
    .from(sites)
    .where(eq(sites.slug, slug))
    .limit(1);

  return result[0] || null;
}

/**
 * 사이트 설정 조회
 */
export async function getSiteConfig(siteId: string, section: string) {
  const result = await db.select()
    .from(siteConfigs)
    .where(and(
      eq(siteConfigs.siteId, siteId),
      eq(siteConfigs.section, section)
    ))
    .limit(1);

  return (result[0]?.data as Record<string, unknown>) || {};
}

/**
 * 사이트 설정 전체 조회 (한 번에)
 */
export async function getAllSiteConfigs(siteId: string) {
  const configs = await db.select()
    .from(siteConfigs)
    .where(eq(siteConfigs.siteId, siteId));

  const map: Record<string, Record<string, unknown>> = {};
  for (const c of configs) {
    map[c.section] = c.data as Record<string, unknown>;
  }
  return map;
}

/**
 * 활성 섹션 조회 (정렬순)
 */
export async function getActiveSections(siteId: string) {
  return db.select()
    .from(siteSections)
    .where(and(
      eq(siteSections.siteId, siteId),
      eq(siteSections.isActive, true)
    ))
    .orderBy(asc(siteSections.sortOrder));
}

/**
 * 콘텐츠 목록 조회 (타입별)
 */
export async function getContentsByType(siteId: string, type: string, limit = 50) {
  return db.select()
    .from(siteContents)
    .where(and(
      eq(siteContents.siteId, siteId),
      eq(siteContents.type, type),
      eq(siteContents.isVisible, true)
    ))
    .orderBy(asc(siteContents.sortOrder), desc(siteContents.createdAt))
    .limit(limit);
}

/**
 * 메뉴 조회
 */
export async function getMenuItems(siteId: string, menuType: string) {
  return db.select()
    .from(siteMenuItems)
    .where(and(
      eq(siteMenuItems.siteId, siteId),
      eq(siteMenuItems.menuType, menuType),
      eq(siteMenuItems.isActive, true)
    ))
    .orderBy(asc(siteMenuItems.sortOrder));
}

// ===== 사이트 파일 관련 (회원 임대 홈페이지) =====

/**
 * 사이트의 파일 목록 조회
 */
export async function getSiteFileList(siteId: string) {
  return db.select()
    .from(siteFiles)
    .where(eq(siteFiles.siteId, siteId))
    .orderBy(asc(siteFiles.sortOrder), asc(siteFiles.filename));
}

/**
 * 사이트의 특정 파일 조회
 */
export async function getSiteFile(siteId: string, filename: string) {
  const result = await db.select()
    .from(siteFiles)
    .where(and(
      eq(siteFiles.siteId, siteId),
      eq(siteFiles.filename, filename)
    ))
    .limit(1);
  return result[0] || null;
}

/**
 * 파일 ID로 조회
 */
export async function getSiteFileById(fileId: number) {
  const result = await db.select()
    .from(siteFiles)
    .where(eq(siteFiles.id, fileId))
    .limit(1);
  return result[0] || null;
}
