-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "accent_color" TEXT DEFAULT '#1890ff',
ADD COLUMN     "bg_color" TEXT DEFAULT '#ffffff',
ADD COLUMN     "isotype_url" TEXT,
ADD COLUMN     "logo_url" TEXT;
