-- RLS (Row-Level Security) de Postgres como defensa en profundidad — ver
-- docs/superpowers/plans/2026-08-01-sprint7-hardening.md, "Decisiones de diseño", punto 2.
--
-- NO ejecutar este archivo contra una base de datos en producción sin antes:
--   1. Verificar que server/src/lib/tenantPrisma.ts (forTenant()) ya está integrado en
--      TODOS los repositorios tenant-aware (RockRepository, IssueRepository, SeatRepository,
--      ScorecardMetricRepository, ScorecardEntryRepository, L10MeetingRepository,
--      L10AgendaItemLogRepository, TodoRepository, VTORepository, MilestoneRepository,
--      TenantMemberRepository, TenantMembershipRepository) — si falta uno solo, ese repositorio
--      empieza a devolver 0 filas en todas sus queries de negocio en cuanto se ejecute esto.
--   2. Confirmar qué rol de Postgres usa DATABASE_URL. Si es el mismo rol que hizo
--      `CREATE TABLE` (el owner), las políticas de RLS se IGNORAN por defecto salvo que se
--      use FORCE ROW LEVEL SECURITY (como se hace abajo) — con FORCE sí se aplican incluso
--      al owner, así que technically basta con este script, pero verifícalo con una query
--      real después de aplicar (ver comentario final del archivo).
--
-- Aplicar manualmente con: psql "$DATABASE_URL" -f server/prisma/rls/enable-rls.sql

BEGIN;

ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON seats
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE rocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rocks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rocks
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON milestones
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE scorecard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON scorecard_metrics
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE scorecard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON scorecard_entries
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE l10_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_meetings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON l10_meetings
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE l10_agenda_item_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_agenda_item_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON l10_agenda_item_logs
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON issues
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON todos
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE vto_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vto_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vto_documents
  USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_memberships
  USING (tenant_id = current_setting('app.current_tenant', true));

COMMIT;

-- 'tenants' y 'users' quedan fuera a propósito: 'tenants' es la tabla raíz (no tiene
-- tenant_id propio) y 'users' es global (un usuario pertenece a 0+ tenants vía
-- tenant_memberships, la fila de 'users' en sí no es de un tenant concreto).

-- Verificación tras aplicar (ejecutar como el rol que usa la app, sin fijar
-- app.current_tenant, para confirmar que efectivamente devuelve 0 filas):
--   SELECT count(*) FROM rocks; -- debe dar 0 sin app.current_tenant fijado
--   SELECT set_config('app.current_tenant', '<uuid-real-de-un-tenant>', false);
--   SELECT count(*) FROM rocks; -- debe dar >0 si ese tenant tiene rocks
