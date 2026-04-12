import {
  pgTable, uuid, varchar, text, integer, boolean, timestamp, date, time,
  serial, jsonb, uniqueIndex, index, pgEnum,
} from 'drizzle-orm/pg-core';

// ===== Enums =====
export const siteStatusEnum = pgEnum('site_status', ['draft', 'active', 'maintenance']);
export const reservationStatusEnum = pgEnum('reservation_status', ['pending', 'confirmed', 'cancelled', 'completed']);
export const maintenancePriorityEnum = pgEnum('maintenance_priority', ['low', 'normal', 'high', 'urgent']);
export const maintenanceStatusEnum = pgEnum('maintenance_status', ['pending', 'reviewing', 'working', 'done', 'cancelled']);
export const syncStatusEnum = pgEnum('sync_status', ['pending', 'synced', 'failed']);
export const adminRoleEnum = pgEnum('admin_role', ['owner', 'editor']);

// ===== site_type enum =====
export const siteTypeEnum = pgEnum('site_type', ['standalone', 'rental', 'partner', 'creator']);

// ===== sites =====
export const sites = pgTable('sites', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  customDomain: varchar('custom_domain', { length: 253 }),
  templateId: varchar('template_id', { length: 64 }).default('default'),
  status: siteStatusEnum('status').default('draft').notNull(),
  // 사이트 유형 + 어드민 참조 (Laravel DB의 ID만 저장, FK 없음)
  siteType: siteTypeEnum('site_type').default('standalone').notNull(),
  adminCustomerId: integer('admin_customer_id'),
  adminMemberId: integer('admin_member_id'),
  adminOrganizationId: integer('admin_organization_id'),
  // 웹스킨 관련
  skinId: integer('skin_id'),
  skinAppliedAt: timestamp('skin_applied_at'),
  skinVersion: varchar('skin_version', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== site_configs =====
export const siteConfigs = pgTable('site_configs', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  section: varchar('section', { length: 64 }).notNull(),
  data: jsonb('data').default({}).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('site_configs_site_section_idx').on(table.siteId, table.section),
]);

// ===== site_sections =====
export const siteSections = pgTable('site_sections', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  sectionKey: varchar('section_key', { length: 32 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== site_contents =====
export const siteContents = pgTable('site_contents', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 32 }).notNull(),
  slug: varchar('slug', { length: 190 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary'),
  content: text('content'),
  thumbUrl: text('thumb_url'),
  metaJson: jsonb('meta_json').default({}).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isVisible: boolean('is_visible').default(true).notNull(),
  startAt: timestamp('start_at'),
  endAt: timestamp('end_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('site_contents_unique_idx').on(table.siteId, table.type, table.slug),
  index('site_contents_type_idx').on(table.siteId, table.type),
]);

// ===== site_menu_items =====
export const siteMenuItems = pgTable('site_menu_items', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  menuType: varchar('menu_type', { length: 20 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  url: varchar('url', { length: 500 }),
  icon: varchar('icon', { length: 64 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  parentId: integer('parent_id'),
});

// ===== reservations (v1 상담 예약) =====
export const reservations = pgTable('reservations', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  customerName: varchar('customer_name', { length: 100 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 50 }).notNull(),
  customerEmail: varchar('customer_email', { length: 200 }),
  treatmentId: integer('treatment_id'),
  treatmentName: varchar('treatment_name', { length: 255 }),
  reservedDate: date('reserved_date').notNull(),
  reservedTime: time('reserved_time'),
  memo: text('memo'),
  status: reservationStatusEnum('status').default('pending').notNull(),
  adminMemo: text('admin_memo'),
  // 동기화 필드
  syncStatus: syncStatusEnum('sync_status').default('pending').notNull(),
  syncAttempts: integer('sync_attempts').default(0).notNull(),
  lastSyncError: text('last_sync_error'),
  nextRetryAt: timestamp('next_retry_at'),
  externalAdminId: integer('external_admin_id'),
  syncedAt: timestamp('synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('reservations_site_idx').on(table.siteId),
  index('reservations_sync_idx').on(table.syncStatus, table.nextRetryAt),
]);

// ===== maintenance_requests =====
export const maintenanceRequests = pgTable('maintenance_requests', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).default('other').notNull(),
  priority: maintenancePriorityEnum('priority').default('normal').notNull(),
  status: maintenanceStatusEnum('status').default('pending').notNull(),
  requestedBy: jsonb('requested_by').default({}).notNull(),
  attachments: jsonb('attachments').default([]).notNull(),
  resolvedAt: timestamp('resolved_at'),
  adminOrderId: integer('admin_order_id'),
  // 동기화 필드
  syncStatus: syncStatusEnum('sync_status').default('pending').notNull(),
  syncAttempts: integer('sync_attempts').default(0).notNull(),
  lastSyncError: text('last_sync_error'),
  nextRetryAt: timestamp('next_retry_at'),
  externalAdminId: integer('external_admin_id'),
  syncedAt: timestamp('synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('maintenance_site_idx').on(table.siteId),
  index('maintenance_sync_idx').on(table.syncStatus, table.nextRetryAt),
]);

// ===== maintenance_messages (채팅) =====
export const maintenanceMessages = pgTable('maintenance_messages', {
  id: serial('id').primaryKey(),
  maintenanceRequestId: integer('maintenance_request_id').notNull()
    .references(() => maintenanceRequests.id, { onDelete: 'cascade' }),
  senderType: varchar('sender_type', { length: 20 }).notNull(), // 'customer' | 'staff'
  senderName: varchar('sender_name', { length: 100 }).notNull(),
  body: text('body').notNull(),
  attachments: jsonb('attachments').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('maintenance_messages_request_idx').on(table.maintenanceRequestId),
]);

// ===== site_admins (SSO) =====
export const siteAdmins = pgTable('site_admins', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  adminMemberId: integer('admin_member_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  role: adminRoleEnum('role').default('editor').notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ===== used_sso_tokens (1회용 검증) =====
export const usedSsoTokens = pgTable('used_sso_tokens', {
  jti: varchar('jti', { length: 64 }).primaryKey(),
  usedAt: timestamp('used_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

// ===== site_credentials (고객 로그인용) =====
export const siteCredentials = pgTable('site_credentials', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  adminCustomerId: integer('admin_customer_id'),
  adminMemberId: integer('admin_member_id'),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('site_credentials_site_email_idx').on(table.siteId, table.email),
]);

// ===== web_skins (웹스킨 마스터 템플릿) =====
export const webSkins = pgTable('web_skins', {
  id: serial('id').primaryKey(),
  productId: integer('product_id'),                              // Laravel products.id (nullable, 무료=null)
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  previewUrl: varchar('preview_url', { length: 500 }),
  version: varchar('version', { length: 20 }).default('1.0.0'),
  category: varchar('category', { length: 50 }),                 // beauty, clinic, cafe, general
  isDefault: boolean('is_default').default(false),
  isFree: boolean('is_free').default(true),
  creatorId: integer('creator_id'),                              // Laravel members.id
  fileCount: integer('file_count').default(0),
  status: varchar('status', { length: 20 }).default('draft'),    // draft, active, archived
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== web_skin_files (웹스킨 파일) =====
export const webSkinFiles = pgTable('web_skin_files', {
  id: serial('id').primaryKey(),
  skinId: integer('skin_id').references(() => webSkins.id, { onDelete: 'cascade' }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 20 }).notNull(),      // html, css, js
  content: text('content'),                                       // 파일 내용 (텍스트)
  fileSize: integer('file_size').default(0),
  isEntry: boolean('is_entry').default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('web_skin_files_skin_filename_idx').on(table.skinId, table.filename),
]);

// ===== org_skin_purchases (조직별 스킨 구매 내역) =====
export const orgSkinPurchases = pgTable('org_skin_purchases', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull(),           // Laravel organizations.id
  skinId: integer('skin_id').references(() => webSkins.id, { onDelete: 'cascade' }).notNull(),
  orderId: integer('order_id'),                                   // Laravel orders.id
  purchasedAt: timestamp('purchased_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('org_skin_purchases_org_skin_idx').on(table.organizationId, table.skinId),
]);

// ===== banner_areas (배너 영역/그룹) =====
export const bannerAreas = pgTable('banner_areas', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  areaId: varchar('area_id', { length: 100 }).notNull(),
  areaName: varchar('area_name', { length: 255 }).notNull(),
  areaDesc: text('area_desc'),
  displayType: varchar('display_type', { length: 50 }).default('slide'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('banner_areas_site_area_idx').on(table.siteId, table.areaId),
]);

// ===== banner_items (개별 배너) =====
export const bannerItems = pgTable('banner_items', {
  id: serial('id').primaryKey(),
  areaId: integer('area_id').notNull().references(() => bannerAreas.id, { onDelete: 'cascade' }),
  num: integer('num').notNull(),
  title: varchar('title', { length: 255 }),
  imgUrl: text('img_url'),
  videoUrl: text('video_url'),
  linkUrl: text('link_url'),
  linkTarget: varchar('link_target', { length: 20 }).default('_self'),
  textContent: text('text_content'),
  htmlContent: text('html_content'),
  displayType: varchar('display_type', { length: 50 }),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===== site_files (회원 임대 홈페이지 파일 저장 - 카페24 방식) =====
export const siteFiles = pgTable('site_files', {
  id: serial('id').primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 500 }),
  fileType: varchar('file_type', { length: 20 }).notNull(), // html, css, js, image
  content: text('content'),                                    // HTML/CSS/JS 텍스트 내용
  blobUrl: varchar('blob_url', { length: 1000 }),             // 이미지 등 바이너리 URL
  fileSize: integer('file_size').default(0),
  isEntry: boolean('is_entry').default(false),                 // index.html = true
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('site_files_site_filename_idx').on(table.siteId, table.filename),
]);
