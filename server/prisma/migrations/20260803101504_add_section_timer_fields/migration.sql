-- AlterTable
ALTER TABLE "l10_meetings" ADD COLUMN     "current_section_accumulated_seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "current_section_id" TEXT,
ADD COLUMN     "current_section_started_at" TIMESTAMP(3);
