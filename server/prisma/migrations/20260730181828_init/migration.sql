-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "RockStatus" AS ENUM ('on_track', 'off_track', 'done');

-- CreateEnum
CREATE TYPE "MetricComparison" AS ENUM ('gte', 'lte', 'eq');

-- CreateEnum
CREATE TYPE "MetricFrequency" AS ENUM ('weekly', 'monthly');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('scheduled', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "AgendaItemType" AS ENUM ('rock_review', 'issue', 'todo');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'discussing', 'solved', 'dropped');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('open', 'done');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "fiscal_year_start_month" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'member',
    "seat_id" TEXT,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_seat_id" TEXT,
    "roles_and_responsibilities" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rocks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "is_company_rock" BOOLEAN NOT NULL DEFAULT false,
    "status" "RockStatus" NOT NULL DEFAULT 'on_track',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rock_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_metrics" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "goal_value" DECIMAL(65,30) NOT NULL,
    "comparison" "MetricComparison" NOT NULL DEFAULT 'gte',
    "frequency" "MetricFrequency" NOT NULL DEFAULT 'weekly',
    "unit" TEXT NOT NULL DEFAULT '#',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "scorecard_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "metric_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "actual_value" DECIMAL(65,30) NOT NULL,
    "entered_by_user_id" TEXT NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorecard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "l10_meetings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "meeting_date" TIMESTAMP(3) NOT NULL,
    "facilitator_user_id" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'scheduled',
    "segue_notes" TEXT,
    "headlines" TEXT,
    "conclude_notes" TEXT,
    "overall_rating" INTEGER,

    CONSTRAINT "l10_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "l10_agenda_item_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "item_type" "AgendaItemType" NOT NULL,
    "reference_id" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "l10_agenda_item_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "raised_by_user_id" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "priority" "IssuePriority" NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "TodoStatus" NOT NULL DEFAULT 'open',
    "originating_meeting_id" TEXT,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vto_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "core_values" JSONB NOT NULL DEFAULT '[]',
    "core_focus_purpose" TEXT,
    "core_focus_niche" TEXT,
    "ten_year_target" TEXT,
    "marketing_strategy" JSONB NOT NULL DEFAULT '{}',
    "three_year_picture" JSONB NOT NULL DEFAULT '{}',
    "one_year_plan" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" TEXT,

    CONSTRAINT "vto_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tenant_memberships_tenant_id_idx" ON "tenant_memberships"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_user_id_tenant_id_key" ON "tenant_memberships"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "seats_tenant_id_idx" ON "seats"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "seats_id_tenant_id_key" ON "seats"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "rocks_tenant_id_quarter_idx" ON "rocks"("tenant_id", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "rocks_id_tenant_id_key" ON "rocks"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "milestones_tenant_id_idx" ON "milestones"("tenant_id");

-- CreateIndex
CREATE INDEX "milestones_rock_id_idx" ON "milestones"("rock_id");

-- CreateIndex
CREATE INDEX "scorecard_metrics_tenant_id_idx" ON "scorecard_metrics"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_metrics_id_tenant_id_key" ON "scorecard_metrics"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "scorecard_entries_tenant_id_idx" ON "scorecard_entries"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_entries_metric_id_period_start_key" ON "scorecard_entries"("metric_id", "period_start");

-- CreateIndex
CREATE INDEX "l10_meetings_tenant_id_meeting_date_idx" ON "l10_meetings"("tenant_id", "meeting_date");

-- CreateIndex
CREATE UNIQUE INDEX "l10_meetings_id_tenant_id_key" ON "l10_meetings"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "l10_agenda_item_logs_tenant_id_idx" ON "l10_agenda_item_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "l10_agenda_item_logs_meeting_id_idx" ON "l10_agenda_item_logs"("meeting_id");

-- CreateIndex
CREATE INDEX "issues_tenant_id_status_idx" ON "issues"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "todos_tenant_id_status_idx" ON "todos"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vto_documents_tenant_id_key" ON "vto_documents"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_seat_id_tenant_id_fkey" FOREIGN KEY ("seat_id", "tenant_id") REFERENCES "seats"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_parent_seat_id_fkey" FOREIGN KEY ("parent_seat_id") REFERENCES "seats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rocks" ADD CONSTRAINT "rocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rocks" ADD CONSTRAINT "rocks_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_rock_id_tenant_id_fkey" FOREIGN KEY ("rock_id", "tenant_id") REFERENCES "rocks"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_metrics" ADD CONSTRAINT "scorecard_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_metrics" ADD CONSTRAINT "scorecard_metrics_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_entries" ADD CONSTRAINT "scorecard_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_entries" ADD CONSTRAINT "scorecard_entries_metric_id_tenant_id_fkey" FOREIGN KEY ("metric_id", "tenant_id") REFERENCES "scorecard_metrics"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_entries" ADD CONSTRAINT "scorecard_entries_entered_by_user_id_fkey" FOREIGN KEY ("entered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "l10_meetings" ADD CONSTRAINT "l10_meetings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "l10_meetings" ADD CONSTRAINT "l10_meetings_facilitator_user_id_fkey" FOREIGN KEY ("facilitator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "l10_agenda_item_logs" ADD CONSTRAINT "l10_agenda_item_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "l10_agenda_item_logs" ADD CONSTRAINT "l10_agenda_item_logs_meeting_id_tenant_id_fkey" FOREIGN KEY ("meeting_id", "tenant_id") REFERENCES "l10_meetings"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_raised_by_user_id_fkey" FOREIGN KEY ("raised_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_originating_meeting_id_tenant_id_fkey" FOREIGN KEY ("originating_meeting_id", "tenant_id") REFERENCES "l10_meetings"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vto_documents" ADD CONSTRAINT "vto_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vto_documents" ADD CONSTRAINT "vto_documents_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

