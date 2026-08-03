-- CreateTable
CREATE TABLE "quarters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "theme" TEXT,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quarters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quarters_tenant_id_idx" ON "quarters"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "quarters_tenant_id_label_key" ON "quarters"("tenant_id", "label");

-- AddForeignKey
ALTER TABLE "quarters" ADD CONSTRAINT "quarters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
