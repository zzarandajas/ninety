# Plan de Implementación — Herramienta EOS Multitenant ("EOS Tool")

**Uso:** Gestión interna privada de Tasvalor y Cionet (y futuras organizaciones)
**Stack:** Node.js/TypeScript + React/Ant Design + PostgreSQL
**Despliegue:** VPS dedicado nuevo (Docker Compose / Coolify)
**Auth:** JWT propio (email + password)

---

## 1. Objetivo y alcance

Construir una aplicación interna que replique los módulos core de Ninety.io / metodología EOS, para gestionar **al menos dos empresas independientes** (Tasvalor y Cionet) desde una única instancia, con aislamiento estricto de datos entre ellas (multitenant por `tenant_id`).

No es un producto comercial: es una herramienta de gestión privada, sin onboarding público, sin billing, sin necesidad de escalar a miles de tenants (empezamos con 2, diseñado para soportar 5-10 sin fricción).

### Módulos incluidos en el MVP
1. **Rocks** — objetivos trimestrales (empresa e individuales)
2. **Scorecard** — KPIs semanales con histórico
3. **L10 Meetings** — reuniones semanales con agenda estructurada (Segue, Scorecard review, Rock review, Headlines, To-Do list, IDS de Issues, Conclude)
4. **Accountability Chart** — organigrama funcional (seats/roles, no jerarquía de personas)
5. **Issues List** — lista de problemas con IDS (Identify, Discuss, Solve)
6. **V/TO** — Vision/Traction Organizer (documento vivo: core values, core focus, 10-year target, marketing strategy, 3-year picture, 1-year plan)

---

## 2. Modelo de datos (ontología de entidades)

### 2.1 Núcleo multitenant

```
Tenant
  - id (uuid, PK)
  - name                    -- "Tasvalor", "Cionet"
  - slug                    -- "tasvalor", "cionet"
  - timezone
  - fiscal_year_start_month -- para cálculo correcto de trimestres/rocks
  - created_at

User
  - id (uuid, PK)
  - email (unique global)
  - password_hash
  - full_name
  - created_at

TenantMembership                 -- un User puede pertenecer a N tenants (tu caso: Pablo en ambos)
  - id (uuid, PK)
  - user_id (FK -> User)
  - tenant_id (FK -> Tenant)
  - role                    -- 'owner' | 'admin' | 'member'
  - seat_id (FK -> Seat, nullable)  -- vínculo opcional al Accountability Chart
  - UNIQUE(user_id, tenant_id)
```

**Regla de oro de aislamiento:** toda tabla de negocio (Rock, Scorecard, Issue, Meeting, Seat, VTO...) lleva `tenant_id` obligatorio, indexado, y **toda query pasa por una capa de repositorio que inyecta `WHERE tenant_id = :currentTenantId` automáticamente** (ver sección 4.2). Nunca se construye una query de negocio a mano sin ese filtro.

### 2.2 Accountability Chart

```
Seat
  - id, tenant_id
  - name                    -- "Director Comercial", "CTO/CIO"
  - parent_seat_id (nullable, self-FK)  -- para jerarquía funcional
  - roles_and_responsibilities (text[] o jsonb)
  - occupied_by_user_id (FK -> User, nullable)
```

### 2.3 Rocks (objetivos trimestrales)

```
Rock
  - id, tenant_id
  - title
  - description
  - owner_user_id (FK -> User)
  - quarter                 -- "2026-Q3"
  - is_company_rock (bool)  -- vs individual rock
  - status                  -- 'on_track' | 'off_track' | 'done'
  - created_at, due_date

Milestone                   -- opcional: hitos dentro de un rock
  - id, rock_id
  - description
  - due_date
  - completed_at (nullable)
```

### 2.4 Scorecard

```
ScorecardMetric
  - id, tenant_id
  - name                    -- "Nº tasaciones validadas/semana"
  - owner_user_id (FK -> User)
  - goal_value               -- objetivo numérico
  - comparison               -- 'gte' | 'lte' | 'eq'
  - frequency                -- 'weekly' | 'monthly'
  - unit                     -- '#', '%', '€'
  - is_active

ScorecardEntry
  - id, metric_id, tenant_id
  - period_start (date)      -- lunes de la semana
  - actual_value
  - entered_by_user_id
  - entered_at
```

### 2.5 L10 Meetings

```
L10Meeting
  - id, tenant_id
  - meeting_date
  - facilitator_user_id
  - status                  -- 'scheduled' | 'in_progress' | 'completed'
  - segue_notes (text)
  - headlines (text)
  - conclude_notes (text)
  - overall_rating (int, 1-10, nullable)  -- rating EOS clásico al final de la L10

L10AgendaItemLog             -- registro de qué issues/rocks se tocaron esa reunión
  - id, meeting_id
  - item_type                -- 'rock_review' | 'issue' | 'todo'
  - reference_id             -- id del Rock/Issue/Todo referenciado
  - notes
```

### 2.6 Issues (IDS)

```
Issue
  - id, tenant_id
  - title
  - description
  - raised_by_user_id
  - status                  -- 'open' | 'discussing' | 'solved' | 'dropped'
  - priority                -- 'low' | 'medium' | 'high'
  - created_at, resolved_at
  - resolution_notes
```

### 2.7 To-Dos

```
Todo
  - id, tenant_id
  - title
  - owner_user_id
  - due_date
  - status                  -- 'open' | 'done'
  - originating_meeting_id (FK -> L10Meeting, nullable)
```

### 2.8 V/TO

```
VTODocument
  - id, tenant_id
  - core_values (jsonb array)
  - core_focus_purpose
  - core_focus_niche
  - ten_year_target
  - marketing_strategy (jsonb)   -- target market, 3 uniques, proven process, guarantee
  - three_year_picture (jsonb)
  - one_year_plan (jsonb)        -- incluye company rocks del año
  - updated_at, updated_by_user_id
```

---

## 3. Arquitectura técnica

```
┌─────────────────────────────────────────────────┐
│  Frontend: React + Vite + Ant Design + TS        │
│  - Tenant switcher en header (si user en 2+ tenants)
│  - Rutas por módulo: /rocks /scorecard /l10 /issues /vto /chart
└───────────────────┬───────────────────────────────┘
                     │ REST (o tRPC si prefieres full-TS)
┌───────────────────▼───────────────────────────────┐
│  Backend: Node.js + TypeScript + Express/Fastify   │
│  - Middleware auth (JWT) → resuelve user + tenants disponibles
│  - Middleware tenant-context → exige X-Tenant-Id header o param,
│    valida membership, inyecta tenantId en request context
│  - Capa de repositorios (Sequelize/Prisma) con scoping automático
└───────────────────┬───────────────────────────────┘
                     │
┌───────────────────▼───────────────────────────────┐
│  PostgreSQL (Docker)                                │
│  - Todas las tablas de negocio con tenant_id + índice
│  - (Opcional fase 2) Row-Level Security nativo de PG
│    como segunda capa de defensa además de la app
└─────────────────────────────────────────────────────┘
```

### 3.1 Por qué Prisma para este proyecto
Dado que ya usas Sequelize en TheHunter.tech, es válido reutilizarlo, pero para un modelo con tanto scoping por tenant, **Prisma** tiene ventaja: middleware de cliente que puede inyectar `where: { tenantId }` de forma centralizada en cada query, reduciendo el riesgo de fuga de datos entre tenants por un desarrollador olvidando el filtro. Si prefieres mantener consistencia con Sequelize, es perfectamente viable — lo compensamos con un repository pattern estricto (ver 4.2).

**Decisión sugerida:** Prisma, salvo que prefieras mantener Sequelize por consistencia con tu stack existente. Dímelo si quieres que ajuste el plan.

### 3.2 Despliegue
- VPS nuevo, dedicado (según tu respuesta)
- Docker Compose con 3 servicios: `api`, `web`, `postgres` (+ `nginx` o gestionado por Coolify si decides usarlo aquí también)
- Backups automáticos de Postgres (pg_dump diario a almacenamiento externo — puedes reusar patrón de otros proyectos tuyos)
- Variables de entorno separadas por entorno (`.env` no versionado)

---

## 4. Multitenancy: implementación concreta

### 4.1 Autenticación y contexto de tenant
1. Login devuelve JWT con `user_id` + lista de `tenant_id`s a los que pertenece + rol en cada uno.
2. Frontend guarda el tenant activo en estado (ej. Zustand/Context) y lo envía en cada request como header `X-Tenant-Id`.
3. Backend middleware `resolveTenantContext`:
   - Verifica que `X-Tenant-Id` esté presente
   - Verifica que exista un `TenantMembership` válido para ese `user_id` + `tenant_id`
   - Si no existe → 403
   - Si existe → inyecta `req.tenantId` y `req.userRole` en el contexto de la request

### 4.2 Capa de repositorio con scoping obligatorio
Patrón recomendado: **ningún controller llama directamente a Prisma/Sequelize**. Todo pasa por repositorios tenant-aware:

```typescript
// Ejemplo conceptual
class RockRepository {
  constructor(private tenantId: string) {}

  findAll() {
    return prisma.rock.findMany({ where: { tenantId: this.tenantId } });
  }

  create(data: CreateRockDTO) {
    return prisma.rock.create({ data: { ...data, tenantId: this.tenantId } });
  }
}

// En cada request se instancia con el tenant del contexto:
const rockRepo = new RockRepository(req.tenantId);
```

Esto hace estructuralmente imposible que un desarrollador (tú, en 6 meses, con prisa) escriba una query que cruce tenants sin darse cuenta.

### 4.3 Defensa en profundidad (fase 2, opcional pero recomendable)
Activar **Row-Level Security** nativo en Postgres como red de seguridad adicional:
```sql
ALTER TABLE rocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rocks
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```
El backend setea `app.current_tenant` al inicio de cada transacción. Esto protege incluso si algún día hay un bug en la capa de repositorio.

---

## 5. Roadmap por sprints (para ejecución con Claude Code)

### Sprint 0 — FundacIón (infraestructura)
- Repo monorepo (`/api`, `/web`, `docker-compose.yml`)
- Setup Postgres + Prisma schema inicial (Tenant, User, TenantMembership)
- Auth: registro/login con JWT, hash bcrypt
- Middleware `resolveTenantContext`
- Seed script: crear tenants "Tasvalor" y "Cionet" + tu usuario en ambos
- Despliegue base en el VPS (docker compose up funcionando end-to-end)

### Sprint 1 — Accountability Chart + gestión de usuarios
- CRUD de Seats (árbol funcional)
- Asignación de usuarios a seats
- Vista de organigrama en frontend con `@xyflow/react` (canvas interactivo con drag-and-drop para reparentar seats, no un árbol estático de Ant Design)
- Gestión de invitaciones a un tenant (crear usuario + membership)

### Sprint 2 — Rocks
- CRUD de Rocks (empresa + individuales) por trimestre
- Milestones dentro de un Rock
- Vista Kanban/lista con estado (on track / off track / done)
- Filtro por trimestre y por owner

### Sprint 3 — Scorecard
- CRUD de ScorecardMetric
- Grid semanal estilo Ninety (filas = métricas, columnas = semanas, celdas editables inline)
- Cálculo automático de "goal met / missed" con color (verde/rojo) según `comparison`
- Vista de tendencia (mini gráfico, últimas 12 semanas) — aquí encaja bien un chart con Recharts

### Sprint 4 — Issues List (IDS)
- CRUD de Issues
- Vista tipo lista priorizable (drag to reorder por prioridad, como la IDS list de Ninety)
- Transición de estados open → discussing → solved

### Sprint 5 — L10 Meetings
- Crear reunión con agenda pre-cargada (Segue, Scorecard, Rock review, Headlines, To-Do list, IDS, Conclude)
- Durante la reunión: checklist de agenda, timer opcional por sección (Segue 5 min, Scorecard 5 min, Rocks 5 min, Headlines 5 min, To-Do 5 min, IDS 60 min, Conclude 5 min — el reparto clásico de 90 min)
- Al cerrar reunión: rating 1-10, notas de conclude, To-Dos creados quedan vinculados

### Sprint 6 — V/TO
- Formulario estructurado por secciones (editor tipo wizard, no todo en una pantalla)
- Versión "solo lectura" exportable/imprimible (PDF simple para reunión anual)

### Sprint 7 — Pulido multitenant y hardening
- Tenant switcher en UI (dropdown en header si el usuario pertenece a 2+ tenants)
- Auditoría: log de quién cambió qué (created_by / updated_by en tablas clave)
- Activar Row-Level Security (sección 4.3)
- Backups automatizados + prueba de restauración

---

## 6. Consideraciones adicionales

- **No hace falta multi-idioma** ni tema oscuro/claro configurable salvo que lo quieras — mantenerlo simple dado que es uso interno.
- **No hace falta facturación ni planes** — es privado, así que se omite toda la capa de billing que tendría un SaaS real.
- **Notificaciones (n8n):** dijiste que no por ahora. El modelo de datos ya queda preparado para añadirlo después sin refactor grande (ej. un cron que lea `ScorecardMetric` sin entrada esta semana y dispare un webhook a n8n).
- **Roles:** con 'owner' / 'admin' / 'member' cubres el caso de uso típico (tú como owner en ambos tenants, y luego según empresa quién más necesite editar vs solo ver).

---

## 7. Siguiente paso sugerido

Si quieres, el siguiente documento natural sería un **Sprint 0 detallado** (schema Prisma completo, estructura de carpetas exacta, docker-compose.yml) listo para pasarle directamente a Claude Code y empezar a construir. Dime si quieres que lo prepare a continuación, o si antes prefieres ajustar algo de este plan (por ejemplo, confirmar Prisma vs Sequelize).
