-- AlterTable
ALTER TABLE "scorecard_metrics" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_metrics_tenant_id_code_key" ON "scorecard_metrics"("tenant_id", "code");

