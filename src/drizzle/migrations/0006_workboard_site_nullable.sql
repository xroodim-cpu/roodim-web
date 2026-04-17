-- site_id를 nullable로 변경 (사이트 없는 고객도 초대 가능)
ALTER TABLE "workboard_members" ALTER COLUMN "site_id" DROP NOT NULL;

-- 기존 unique index 삭제 후 admin_customer_id 기반으로 재생성
DROP INDEX IF EXISTS "workboard_members_wb_site_idx";
CREATE UNIQUE INDEX "workboard_members_wb_cust_idx" ON "workboard_members" ("workboard_id", "admin_customer_id");
