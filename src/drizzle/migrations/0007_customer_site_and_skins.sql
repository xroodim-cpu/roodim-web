-- 고객 임대사이트 지원을 위한 스키마 확장
-- 1) site_type enum 에 'customer' 추가 (고객 임대사이트 타입)
-- 2) site_status enum 에 'suspended' 추가 (웹서비스 구독 만료 시 차단)
-- 3) web_skins 에 target_type 컬럼 추가 (member/customer 구분)
-- 4) 기존 스킨 전부 member 로 백필

-- 1) site_type enum 에 'customer' 추가
ALTER TYPE "site_type" ADD VALUE IF NOT EXISTS 'customer';--> statement-breakpoint

-- 2) site_status enum 에 'suspended' 추가
ALTER TYPE "site_status" ADD VALUE IF NOT EXISTS 'suspended';--> statement-breakpoint

-- 3) web_skins 에 target_type 컬럼 추가 (기본 member)
ALTER TABLE "web_skins" ADD COLUMN IF NOT EXISTS "target_type" varchar(20) DEFAULT 'member' NOT NULL;--> statement-breakpoint

-- 4) 기존 web_skins 레코드는 전부 member 로 백필 (default로 자동 처리되지만 명시)
UPDATE "web_skins" SET "target_type" = 'member' WHERE "target_type" IS NULL OR "target_type" = '';
