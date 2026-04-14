import { db } from './db';
import { sites, siteConfigs, siteSections, siteContents, siteMenuItems, siteFiles } from '@/drizzle/schema';
import { eq, and, asc, desc, sql as sqlRaw } from 'drizzle-orm';

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
 * 사이트의 특정 파일 조회 (site_files 우선, 없으면 web_skin_files fallback)
 *
 * 성능: site_files + sites + web_skin_files 를 단일 LEFT JOIN 으로 합쳐
 * 1회 왕복에 해결. 이전 구현은 순차 3쿼리였음.
 */
export async function getSiteFile(siteId: string, filename: string) {
  const rows = await db.execute(sqlRaw`
    SELECT
      COALESCE(sf.id, wsf.id) AS id,
      COALESCE(sf.filename, wsf.filename) AS filename,
      sf.file_path AS file_path,
      COALESCE(sf.file_type, wsf.file_type) AS file_type,
      COALESCE(sf.content, wsf.content) AS content,
      sf.blob_url AS blob_url,
      COALESCE(sf.file_size, wsf.file_size) AS file_size,
      COALESCE(sf.is_entry, wsf.is_entry) AS is_entry,
      COALESCE(sf.sort_order, wsf.sort_order) AS sort_order,
      COALESCE(sf.created_at, wsf.created_at) AS created_at,
      COALESCE(sf.updated_at, wsf.updated_at) AS updated_at,
      (sf.id IS NULL AND wsf.id IS NOT NULL) AS from_skin
    FROM sites s
    LEFT JOIN site_files sf
      ON sf.site_id = s.id AND sf.filename = ${filename}
    LEFT JOIN web_skin_files wsf
      ON wsf.skin_id = s.skin_id AND wsf.filename = ${filename}
    WHERE s.id = ${siteId}
    LIMIT 1
  `);

  const row = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!row || row.id == null) return null;

  return {
    id: row.id as number,
    siteId,
    filename: row.filename as string,
    filePath: (row.file_path as string | null) ?? null,
    fileType: row.file_type as string,
    content: (row.content as string | null) ?? null,
    blobUrl: (row.blob_url as string | null) ?? null,
    fileSize: (row.file_size as number | null) ?? null,
    isEntry: Boolean(row.is_entry),
    sortOrder: (row.sort_order as number | null) ?? 0,
    createdAt: row.created_at as Date | null,
    updatedAt: row.updated_at as Date | null,
    _fromSkin: Boolean(row.from_skin),
  };
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

/**
 * 사이트의 파일 내용 조회 (template-engine용 - site_files 우선, skin fallback)
 */
export async function getFileContent(siteId: string, filename: string): Promise<string | null> {
  const file = await getSiteFile(siteId, filename);
  return file?.content || null;
}
