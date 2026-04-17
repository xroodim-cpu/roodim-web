ALTER TABLE "workboards" ADD COLUMN "owner_site_id" uuid;
ALTER TABLE "workboard_members" ADD COLUMN "role" varchar(20) DEFAULT 'viewer' NOT NULL;
ALTER TABLE "workboard_members" ADD COLUMN "customer_name" varchar(100);
ALTER TABLE "workboard_members" ADD COLUMN "admin_customer_id" integer;
DO $$ BEGIN
 ALTER TABLE "workboards" ADD CONSTRAINT "workboards_owner_site_id_sites_id_fk" FOREIGN KEY ("owner_site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
