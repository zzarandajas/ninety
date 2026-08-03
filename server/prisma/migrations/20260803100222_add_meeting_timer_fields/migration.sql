-- AlterTable
ALTER TABLE "l10_meetings" ADD COLUMN     "timer_accumulated_seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timer_is_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timer_started_at" TIMESTAMP(3);
