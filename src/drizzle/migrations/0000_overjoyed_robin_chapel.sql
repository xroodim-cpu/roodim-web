CREATE TYPE "public"."admin_role" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TYPE "public"."maintenance_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('pending', 'reviewing', 'working', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('draft', 'active', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."site_type" AS ENUM('standalone', 'rental', 'partner', 'creator');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'synced', 'failed');--> statement-breakpoint
CREATE TABLE "maintenance_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"maintenance_request_id" integer NOT NULL,
	"sender_type" varchar(20) NOT NULL,
	"sender_name" varchar(100) NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"priority" "maintenance_priority" DEFAULT 'normal' NOT NULL,
	"status" "maintenance_status" DEFAULT 'pending' NOT NULL,
	"requested_by" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved_at" timestamp,
	"admin_order_id" integer,
	"sync_status" "sync_status" DEFAULT 'pending' NOT NULL,
	"sync_attempts" integer DEFAULT 0 NOT NULL,
	"last_sync_error" text,
	"next_retry_at" timestamp,
	"external_admin_id" integer,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"customer_name" varchar(100) NOT NULL,
	"customer_phone" varchar(50) NOT NULL,
	"customer_email" varchar(200),
	"treatment_id" integer,
	"treatment_name" varchar(255),
	"reserved_date" date NOT NULL,
	"reserved_time" time,
	"memo" text,
	"status" "reservation_status" DEFAULT 'pending' NOT NULL,
	"admin_memo" text,
	"sync_status" "sync_status" DEFAULT 'pending' NOT NULL,
	"sync_attempts" integer DEFAULT 0 NOT NULL,
	"last_sync_error" text,
	"next_retry_at" timestamp,
	"external_admin_id" integer,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"admin_member_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" "admin_role" DEFAULT 'editor' NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"section" varchar(64) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"slug" varchar(190) NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"content" text,
	"thumb_url" text,
	"meta_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"start_at" timestamp,
	"end_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"admin_customer_id" integer,
	"admin_member_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"menu_type" varchar(20) NOT NULL,
	"label" varchar(100) NOT NULL,
	"url" varchar(500),
	"icon" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "site_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"section_key" varchar(32) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"custom_domain" varchar(253),
	"template_id" varchar(64) DEFAULT 'default',
	"status" "site_status" DEFAULT 'draft' NOT NULL,
	"site_type" "site_type" DEFAULT 'standalone' NOT NULL,
	"admin_customer_id" integer,
	"admin_member_id" integer,
	"admin_organization_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "used_sso_tokens" (
	"jti" varchar(64) PRIMARY KEY NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_messages" ADD CONSTRAINT "maintenance_messages_maintenance_request_id_maintenance_requests_id_fk" FOREIGN KEY ("maintenance_request_id") REFERENCES "public"."maintenance_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_admins" ADD CONSTRAINT "site_admins_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_configs" ADD CONSTRAINT "site_configs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_contents" ADD CONSTRAINT "site_contents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_credentials" ADD CONSTRAINT "site_credentials_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_menu_items" ADD CONSTRAINT "site_menu_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_sections" ADD CONSTRAINT "site_sections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenance_messages_request_idx" ON "maintenance_messages" USING btree ("maintenance_request_id");--> statement-breakpoint
CREATE INDEX "maintenance_site_idx" ON "maintenance_requests" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "maintenance_sync_idx" ON "maintenance_requests" USING btree ("sync_status","next_retry_at");--> statement-breakpoint
CREATE INDEX "reservations_site_idx" ON "reservations" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "reservations_sync_idx" ON "reservations" USING btree ("sync_status","next_retry_at");--> statement-breakpoint
CREATE UNIQUE INDEX "site_configs_site_section_idx" ON "site_configs" USING btree ("site_id","section");--> statement-breakpoint
CREATE UNIQUE INDEX "site_contents_unique_idx" ON "site_contents" USING btree ("site_id","type","slug");--> statement-breakpoint
CREATE INDEX "site_contents_type_idx" ON "site_contents" USING btree ("site_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "site_credentials_site_email_idx" ON "site_credentials" USING btree ("site_id","email");