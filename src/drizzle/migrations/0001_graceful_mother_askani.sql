CREATE TABLE "site_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_path" varchar(500),
	"file_type" varchar(20) NOT NULL,
	"content" text,
	"blob_url" varchar(1000),
	"file_size" integer DEFAULT 0,
	"is_entry" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_files" ADD CONSTRAINT "site_files_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_files_site_filename_idx" ON "site_files" USING btree ("site_id","filename");