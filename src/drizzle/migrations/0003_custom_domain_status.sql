ALTER TABLE "sites" ADD COLUMN "custom_domain_status" varchar(20);--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "custom_domain_verified_at" timestamp;
