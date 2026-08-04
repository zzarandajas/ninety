/*
  Warnings:

  - Added the required column `quarter` to the `issues` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quarter` to the `l10_meetings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quarter` to the `todos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "issues" ADD COLUMN "quarter" TEXT;
UPDATE "issues" SET "quarter" = '2026-Q3' WHERE "quarter" IS NULL;
ALTER TABLE "issues" ALTER COLUMN "quarter" SET NOT NULL;

-- AlterTable
ALTER TABLE "l10_meetings" ADD COLUMN "quarter" TEXT;
UPDATE "l10_meetings" SET "quarter" = '2026-Q3' WHERE "quarter" IS NULL;
ALTER TABLE "l10_meetings" ALTER COLUMN "quarter" SET NOT NULL;

-- AlterTable
ALTER TABLE "todos" ADD COLUMN "quarter" TEXT;
UPDATE "todos" SET "quarter" = '2026-Q3' WHERE "quarter" IS NULL;
ALTER TABLE "todos" ALTER COLUMN "quarter" SET NOT NULL;

-- CreateIndex
CREATE INDEX "issues_tenant_id_quarter_idx" ON "issues"("tenant_id", "quarter");

-- CreateIndex
CREATE INDEX "l10_meetings_tenant_id_quarter_idx" ON "l10_meetings"("tenant_id", "quarter");

-- CreateIndex
CREATE INDEX "todos_tenant_id_quarter_idx" ON "todos"("tenant_id", "quarter");
