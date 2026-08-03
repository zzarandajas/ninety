-- AlterTable
ALTER TABLE "l10_meetings" ALTER COLUMN "overall_rating" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "l10_meeting_ratings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "l10_meeting_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "l10_meeting_ratings_tenant_id_idx" ON "l10_meeting_ratings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "l10_meeting_ratings_meeting_id_user_id_key" ON "l10_meeting_ratings"("meeting_id", "user_id");

-- AddForeignKey
ALTER TABLE "l10_meeting_ratings" ADD CONSTRAINT "l10_meeting_ratings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "l10_meeting_ratings" ADD CONSTRAINT "l10_meeting_ratings_meeting_id_tenant_id_fkey" FOREIGN KEY ("meeting_id", "tenant_id") REFERENCES "l10_meetings"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "l10_meeting_ratings" ADD CONSTRAINT "l10_meeting_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
