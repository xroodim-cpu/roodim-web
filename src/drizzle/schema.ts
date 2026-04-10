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
