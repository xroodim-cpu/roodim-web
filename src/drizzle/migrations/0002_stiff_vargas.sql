CREATE TABLE "banner_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"area_id" varchar(100) NOT NULL,
	"area_name" varchar(255) NOT NULL,
	"area_desc" text,
	"display_type" varchar(50) DEFAULT 'slide',
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banner_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_id" integer NOT NULL,
	"num" integer NOT NULL,
	"title" varchar(255),
	"img_url" text,
	"video_url" text,
	"link_url" text,
	"link_target" varchar(20) DEFAULT '_self',
	"text_content" text,
	"html_content" text,
	"display_type" varchar(50),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_skin_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"skin_id" integer NOT NULL,
	"order_id" integer,
	"purchased_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roodim_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"external_id" integer,
	"action" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"title" varchar(255),
	"description" text,
	"phone" varchar(20),
	"email" varchar(255),
	"address" varchar(500),
	"business_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"services_provided" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_info_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "site_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" integer,
	"category" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_skin_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"skin_id" integer NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"content" text,
	"file_size" integer DEFAULT 0,
	"is_entry" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_skins" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"thumbnail_url" varchar(500),
	"preview_url" varchar(500),
	"version" varchar(20) DEFAULT '1.0.0',
	"category" varchar(50),
	"is_default" boolean DEFAULT false,
	"is_free" boolean DEFAULT true,
	"creator_id" integer,
	"file_count" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'draft',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "web_skins_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "workboard_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"workboard_id" integer NOT NULL,
	"site_id" uuid NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"owner_id" integer,
	"organization_id" integer,
	"visibility" varchar(20) DEFAULT 'private' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workboards_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "skin_id" integer;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "skin_applied_at" timestamp;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "skin_version" varchar(20);--> statement-breakpoint
ALTER TABLE "banner_areas" ADD CONSTRAINT "banner_areas_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banner_items" ADD CONSTRAINT "banner_items_area_id_banner_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."banner_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_skin_purchases" ADD CONSTRAINT "org_skin_purchases_skin_id_web_skins_id_fk" FOREIGN KEY ("skin_id") REFERENCES "public"."web_skins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roodim_sync_logs" ADD CONSTRAINT "roodim_sync_logs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_info" ADD CONSTRAINT "site_info_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_services" ADD CONSTRAINT "site_services_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_skin_files" ADD CONSTRAINT "web_skin_files_skin_id_web_skins_id_fk" FOREIGN KEY ("skin_id") REFERENCES "public"."web_skins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workboard_members" ADD CONSTRAINT "workboard_members_workboard_id_workboards_id_fk" FOREIGN KEY ("workboard_id") REFERENCES "public"."workboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workboard_members" ADD CONSTRAINT "workboard_members_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "banner_areas_site_area_idx" ON "banner_areas" USING btree ("site_id","area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_skin_purchases_org_skin_idx" ON "org_skin_purchases" USING btree ("organization_id","skin_id");--> statement-breakpoint
CREATE INDEX "roodim_sync_logs_site_idx" ON "roodim_sync_logs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "roodim_sync_logs_type_idx" ON "roodim_sync_logs" USING btree ("entity_type","status");--> statement-breakpoint
CREATE INDEX "site_services_site_idx" ON "site_services" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "web_skin_files_skin_filename_idx" ON "web_skin_files" USING btree ("skin_id","filename");--> statement-breakpoint
CREATE UNIQUE INDEX "workboard_members_wb_site_idx" ON "workboard_members" USING btree ("workboard_id","site_id");