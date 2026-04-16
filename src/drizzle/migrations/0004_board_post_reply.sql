ALTER TABLE "board_posts" ADD COLUMN "reply_content" text;--> statement-breakpoint
ALTER TABLE "board_posts" ADD COLUMN "replied_at" timestamp;--> statement-breakpoint
ALTER TABLE "board_posts" ADD COLUMN "replied_by" varchar(100);
