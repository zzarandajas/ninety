# Sprint 7 — Pulido multitenant y hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los 4 puntos de "Pulido multitenant y hardening" del roadmap (IMPLEMENTATION_PLAN.md §5, Sprint 7) con el alcance decidido en la sección de abajo, más el hallazgo de la revisión de Sprint 5 (`eslint-plugin-react-hooks` ausente).

**Architecture:** Migración Prisma que añade `createdByUserId`/`updatedByUserId` (+ `createdAt`/`updatedAt` donde falten) a las 6 tablas de negocio que no tenían ya un equivalente (`Rock`, `Issue`, `Seat`, `ScorecardMetric`, `L10Meeting`, `Todo`), inyectados siempre desde `request.user.userId` en la capa de ruta — nunca desde el body del cliente, mismo patrón que `ScorecardEntryRepository.upsert`/`VTORepository.update` ya establecido. RLS de Postgres se deja **preparado pero sin activar** (ver decisión de diseño). Backup vía script `pg_dump` + servicio dedicado en `docker-compose.yml`. `eslint-plugin-react-hooks` convierte la revisión manual de Rules of Hooks (ya usada en cada sprint desde el bug de Sprint 2) en un gate automático de lint.

**Tech Stack:** Prisma (migración nueva), Fastify + Zod (sin cambios de librería), `eslint-plugin-react-hooks` (dependencia nueva del frontend, la única de este sprint), `pg_dump`/`pg_restore` (ya vienen en la imagen oficial de `postgres`, sin instalar nada nuevo).

## Decisiones de diseño (resueltas de forma autónoma o con el usuario, documentadas para que quede trazado)

1. **Alcance de auditoría — qué tablas.** Las 6 tablas de negocio que un usuario crea/edita directamente y que aún no tenían ningún campo de auditoría equivalente: `Rock`, `Issue`, `Seat`, `ScorecardMetric`, `L10Meeting`, `Todo`. Se excluyen deliberadamente: `Milestone` y `L10AgendaItemLog` (sub-registros de `Rock`/`L10Meeting`, no "tablas clave" por sí mismas — YAGNI), `ScorecardEntry` (ya tiene `enteredByUserId`+`enteredAt`, equivalente funcional), `VTODocument` (ya tiene `updatedByUserId`+`updatedAt`), `TenantMembership`/`Tenant`/`User` (no son registros de negocio editables por el usuario final del mismo modo). En las 6 tablas incluidas, ambos campos son `String?` (nullable) — igual que `VTODocument.updatedByUserId` — para no romper filas ya existentes sembradas antes de esta migración.
2. **RLS — preparado, no activado.** Confirmado explícitamente con el usuario (no autónomo, se preguntó por el riesgo real): activar RLS de verdad exige (a) que el backend fije `app.current_tenant` en cada conexión antes de cada query — lo que obliga a que las ~12 clases de repositorio dejen de usar el `PrismaClient` global directo y pasen por un wrapper transaccional (`prisma.$transaction([setConfig, query])`, que sí garantiza misma conexión en modo array-batch); y (b) `FORCE ROW LEVEL SECURITY` o un rol de Postgres distinto del owner de las tablas, porque si no, la política se ignora en silencio para el rol que ya usa la app. Mal activado, el resultado es o bien ninguna protección real con falsa sensación de seguridad, o bien la app entera devolviendo 0 filas en todo. Este sprint entrega la migración SQL completa y el wrapper `forTenant()` de Prisma como artefactos documentados y listos para aplicar (Task 9), sin tocar ninguna clase de repositorio existente ni ejecutar la migración SQL de RLS contra la base de datos real. Activarlo de verdad queda para un sprint futuro dedicado, con acceso a un Postgres real para verificar end-to-end antes de desplegar.
3. **Backups — script + servicio, sin prueba de restauración en vivo.** Se implementa el mecanismo completo (script `pg_dump` parametrizado + servicio `backup` en `docker-compose.yml` corriendo con cron interno) y se documenta el procedimiento exacto de restauración con `pg_restore`. La prueba de restauración REAL contra una base de datos con datos (crear un backup, tirar la BD, restaurar, verificar) requiere el VPS real desplegado — quedará pendiente del usuario, mismo patrón que la verificación manual de aislamiento multitenant que arrastran todos los sprints anteriores.
4. **Tenant switcher — ya cubierto, sin tarea.** `front/src/components/TenantSwitcher.tsx` (construido en Sprint 0) ya resuelve el caso completo: `Select` con las opciones de `tenants` del store, oculto si el usuario pertenece a menos de 2 tenants (`if (tenants.length < 2) return null`). No hace falta ninguna tarea nueva — se confirma y se tacha del roadmap.

## Global Constraints

- **Multitenancy:** ninguna query de negocio usa `prisma.<modelo>.*` fuera de su repositorio tenant-aware. Los 6 repositorios tocados en este sprint ya cumplen esto — las tareas de este sprint solo añaden un parámetro más a métodos ya existentes, sin romper el patrón.
- **`createdByUserId`/`updatedByUserId` se rellenan SIEMPRE desde `request.user.userId`** en la capa de ruta, nunca desde el body del cliente — mismo patrón que `ScorecardEntryRepository.upsert(..., enteredByUserId)` (`server/src/repositories/ScorecardEntryRepository.ts:20-32`) y `VTORepository.update(data, updatedByUserId)` (`server/src/repositories/VTORepository.ts`, Sprint 6). Los schemas Zod de creación/actualización de cada ruta NO declaran estos dos campos — Zod los descarta automáticamente si el cliente los manda (comportamiento "strip" por defecto, ya verificado en la revisión de Sprint 6 Task 2).
- **`updatedAt` se gestiona solo con `@updatedAt` de Prisma** — no se toca a mano en ningún repositorio, Prisma lo pone en cada `update`/`updateMany` automáticamente.
- **Migración Prisma:** generar con `npm run migrate:dev --prefix server -- --name audit_fields` contra tu Postgres LOCAL — nunca contra `docker-compose.yml` de producción (ver CLAUDE.md §3). El archivo de migración generado se commitea tal cual (aunque en este proyecto "commitear" lo hace el usuario, no un agente — ver más abajo).
- **NINGÚN agente ejecuta `git commit`** en este sprint — el usuario comitea todo. Cada implementer deja sus cambios en el working tree (puede hacer `git add` si quiere, nunca `git commit`). Esta regla ya se aplicó a partir de la Task 10 de Sprint 6 tras detectar una violación — se mantiene para todo Sprint 7 desde el primer task.
- **Estilo:** comillas simples, punto y coma, 2 espacios de indentación. Sin comentarios explicativos superfluos.
- **Sin dependencias nuevas** salvo `eslint-plugin-react-hooks` (Task 8, explícitamente justificada por el roadmap tras el bug de Sprint 2).
- **Tests:** cada cambio de comportamiento lleva su test nuevo. Los tests EXISTENTES de rutas de este proyecto (`rocks.test.ts`, `issues.test.ts`, etc.) no hacen aserciones exactas de `toHaveBeenCalledWith` sobre los datos pasados a `prisma.<modelo>.create`/`updateMany` — solo verifican el código de estado HTTP y el body de respuesta — así que añadir `createdByUserId`/`updatedByUserId` a esas llamadas NO debería romper ningún test existente. Cada tarea de este sprint AÑADE tests nuevos que sí verifican explícitamente el flujo de auditoría; no modifica los tests existentes salvo que al correrlos se demuestre lo contrario (en cuyo caso, investigar la causa antes de tocarlos, nunca ajustar un test para que "pase como sea").

---

### Task 1: Migración Prisma — campos de auditoría en 6 tablas + seed.ts

**Files:**
- Modify: `server/prisma/schema.prisma` (modelos `User`, `Rock`, `Issue`, `Seat`, `ScorecardMetric`, `L10Meeting`, `Todo`)
- Modify: `server/prisma/seed.ts`
- Create: migración generada por Prisma en `server/prisma/migrations/<timestamp>_audit_fields/`

**Nota de ejecución:** esta tarea la ejecuta el controller directamente (sin subagente), igual que la migración `sortOrder` de Sprint 4 — generar una migración real requiere correr `npx prisma migrate dev` contra el Postgres local del controller, algo que un subagente aislado no puede verificar de forma fiable y que ya causó una vez un bloqueo de archivo del motor de Prisma en Windows (Sprint 4) que solo el controller pudo diagnosticar y resolver con el usuario.

**Interfaces:**
- Produces: los 6 modelos con `createdByUserId String?`, `updatedByUserId String?`, `createdAt`/`updatedAt` donde falten. Consumido por Tasks 2-7.

- [ ] **Step 1: Añade las 12 relaciones nuevas al modelo `User`**

En `server/prisma/schema.prisma`, dentro del modelo `User` (después de la línea `updatedVtoDocuments     VTODocument[]      @relation("VTODocumentUpdatedBy")`), añade:

```prisma
  createdRocks            Rock[]             @relation("RockCreatedBy")
  updatedRocks            Rock[]             @relation("RockUpdatedBy")
  createdIssues           Issue[]            @relation("IssueCreatedBy")
  updatedIssues           Issue[]            @relation("IssueUpdatedBy")
  createdSeats            Seat[]             @relation("SeatCreatedBy")
  updatedSeats            Seat[]             @relation("SeatUpdatedBy")
  createdMetrics          ScorecardMetric[]  @relation("ScorecardMetricCreatedBy")
  updatedMetrics          ScorecardMetric[]  @relation("ScorecardMetricUpdatedBy")
  createdMeetings         L10Meeting[]       @relation("L10MeetingCreatedBy")
  updatedMeetings         L10Meeting[]       @relation("L10MeetingUpdatedBy")
  createdTodos            Todo[]             @relation("TodoCreatedBy")
  updatedTodos            Todo[]             @relation("TodoUpdatedBy")
```

- [ ] **Step 2: Modifica el modelo `Rock`**

Reemplaza el modelo `Rock` completo por:

```prisma
model Rock {
  id              String     @id @default(uuid())
  tenantId        String     @map("tenant_id")
  title           String
  description     String?
  ownerUserId     String     @map("owner_user_id")
  quarter         String // "2026-Q3"
  isCompanyRock   Boolean    @default(false) @map("is_company_rock")
  status          RockStatus @default(on_track)
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")
  createdByUserId String?    @map("created_by_user_id")
  updatedByUserId String?    @map("updated_by_user_id")
  dueDate         DateTime   @map("due_date")

  tenant     Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  owner      User        @relation("RockOwner", fields: [ownerUserId], references: [id])
  createdBy  User?       @relation("RockCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy  User?       @relation("RockUpdatedBy", fields: [updatedByUserId], references: [id])
  milestones Milestone[]

  @@unique([id, tenantId])
  @@index([tenantId, quarter])
  @@map("rocks")
}
```

- [ ] **Step 3: Modifica el modelo `Issue`**

Reemplaza el modelo `Issue` completo por:

```prisma
model Issue {
  id              String        @id @default(uuid())
  tenantId        String        @map("tenant_id")
  title           String
  description     String?
  raisedByUserId  String        @map("raised_by_user_id")
  status          IssueStatus   @default(open)
  priority        IssuePriority @default(medium)
  sortOrder       Int           @default(0) @map("sort_order")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")
  createdByUserId String?       @map("created_by_user_id")
  updatedByUserId String?       @map("updated_by_user_id")
  resolvedAt      DateTime?     @map("resolved_at")
  resolutionNotes String?       @map("resolution_notes")

  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  raisedBy  User   @relation("IssueRaisedBy", fields: [raisedByUserId], references: [id])
  createdBy User?  @relation("IssueCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy User?  @relation("IssueUpdatedBy", fields: [updatedByUserId], references: [id])

  @@index([tenantId, status])
  @@map("issues")
}
```

- [ ] **Step 4: Modifica el modelo `Seat`**

Reemplaza el modelo `Seat` completo por:

```prisma
model Seat {
  id                       String   @id @default(uuid())
  tenantId                 String   @map("tenant_id")
  name                     String
  parentSeatId             String?  @map("parent_seat_id")
  rolesAndResponsibilities Json     @default("[]") @map("roles_and_responsibilities")
  createdAt                DateTime @default(now()) @map("created_at")
  updatedAt                DateTime @updatedAt @map("updated_at")
  createdByUserId          String?  @map("created_by_user_id")
  updatedByUserId          String?  @map("updated_by_user_id")

  tenant       Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parentSeat   Seat?              @relation("SeatHierarchy", fields: [parentSeatId], references: [id])
  childSeats   Seat[]             @relation("SeatHierarchy")
  occupants    TenantMembership[]
  createdBy    User?              @relation("SeatCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy    User?              @relation("SeatUpdatedBy", fields: [updatedByUserId], references: [id])

  @@unique([id, tenantId])
  @@index([tenantId])
  @@map("seats")
}
```

- [ ] **Step 5: Modifica el modelo `ScorecardMetric`**

Reemplaza el modelo `ScorecardMetric` completo por:

```prisma
model ScorecardMetric {
  id              String           @id @default(uuid())
  tenantId        String           @map("tenant_id")
  name            String
  ownerUserId     String           @map("owner_user_id")
  goalValue       Decimal          @map("goal_value")
  comparison      MetricComparison @default(gte)
  frequency       MetricFrequency  @default(weekly)
  unit            String           @default("#")
  isActive        Boolean          @default(true) @map("is_active")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")
  createdByUserId String?          @map("created_by_user_id")
  updatedByUserId String?          @map("updated_by_user_id")

  tenant    Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  owner     User             @relation("ScorecardMetricOwner", fields: [ownerUserId], references: [id])
  createdBy User?            @relation("ScorecardMetricCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy User?            @relation("ScorecardMetricUpdatedBy", fields: [updatedByUserId], references: [id])
  entries   ScorecardEntry[]

  @@unique([id, tenantId])
  @@index([tenantId])
  @@map("scorecard_metrics")
}
```

- [ ] **Step 6: Modifica el modelo `L10Meeting`**

Reemplaza el modelo `L10Meeting` completo por:

```prisma
model L10Meeting {
  id                String        @id @default(uuid())
  tenantId          String        @map("tenant_id")
  meetingDate       DateTime      @map("meeting_date")
  facilitatorUserId String        @map("facilitator_user_id")
  status            MeetingStatus @default(scheduled)
  segueNotes        String?       @map("segue_notes")
  headlines         String?
  concludeNotes     String?       @map("conclude_notes")
  overallRating     Int?          @map("overall_rating")
  createdAt         DateTime      @default(now()) @map("created_at")
  updatedAt         DateTime      @updatedAt @map("updated_at")
  createdByUserId   String?       @map("created_by_user_id")
  updatedByUserId   String?       @map("updated_by_user_id")

  tenant      Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  facilitator User               @relation("L10MeetingFacilitator", fields: [facilitatorUserId], references: [id])
  createdBy   User?              @relation("L10MeetingCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy   User?              @relation("L10MeetingUpdatedBy", fields: [updatedByUserId], references: [id])
  agendaLogs  L10AgendaItemLog[]
  todos       Todo[]

  @@unique([id, tenantId])
  @@index([tenantId, meetingDate])
  @@map("l10_meetings")
}
```

- [ ] **Step 7: Modifica el modelo `Todo`**

Reemplaza el modelo `Todo` completo por:

```prisma
model Todo {
  id                   String     @id @default(uuid())
  tenantId             String     @map("tenant_id")
  title                String
  ownerUserId          String     @map("owner_user_id")
  dueDate              DateTime?  @map("due_date")
  status               TodoStatus @default(open)
  originatingMeetingId String?    @map("originating_meeting_id")
  createdAt            DateTime   @default(now()) @map("created_at")
  updatedAt            DateTime   @updatedAt @map("updated_at")
  createdByUserId      String?    @map("created_by_user_id")
  updatedByUserId      String?    @map("updated_by_user_id")

  tenant             Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  owner              User        @relation("TodoOwner", fields: [ownerUserId], references: [id])
  createdBy          User?       @relation("TodoCreatedBy", fields: [createdByUserId], references: [id])
  updatedBy          User?       @relation("TodoUpdatedBy", fields: [updatedByUserId], references: [id])
  originatingMeeting L10Meeting? @relation(fields: [originatingMeetingId, tenantId], references: [id, tenantId])

  @@index([tenantId, status])
  @@map("todos")
}
```

- [ ] **Step 8: Genera la migración**

Run (desde `server/`, contra tu Postgres LOCAL — nunca contra el compose de producción):
```bash
npm run migrate:dev --prefix server -- --name audit_fields
```
Expected: Prisma detecta los campos nuevos (todos nullable u opcionales con default, así que no debería pedir un valor por defecto para filas existentes) y genera la migración sin preguntar nada destructivo. Si Prisma avisa de posible pérdida de datos en algo que NO sea estos campos nuevos, para y revisa antes de confirmar — no debería pasar aquí.

- [ ] **Step 9: Regenera el cliente de Prisma**

Run: `npm run --prefix server prisma generate` (o el script equivalente que ya use este proyecto — revisa `server/package.json`; si `migrate:dev` ya regenera el cliente automáticamente, este paso es redundante y puedes saltarlo).

- [ ] **Step 10: Actualiza `seed.ts` para poblar los campos de auditoría en los datos de ejemplo**

En `server/prisma/seed.ts`, añade `createdByUserId: owner.id, updatedByUserId: owner.id` a cada bloque de creación de las 6 tablas afectadas que el seed ya crea (no crea `Todo`, así que no hay bloque de `Todo` que tocar):

Reemplaza:
```typescript
    const seat = await prisma.seat.create({
      data: {
        tenantId: tenant.id,
        name: 'CEO/Integrator',
        rolesAndResponsibilities: ['Visión', 'Rentabilidad', 'Liderazgo del equipo'],
      },
    });

    await prisma.seat.createMany({
      data: [
        {
          tenantId: tenant.id,
          parentSeatId: seat.id,
          name: 'Ventas',
          rolesAndResponsibilities: ['Pipeline', 'Cierre de clientes nuevos'],
        },
        {
          tenantId: tenant.id,
          parentSeatId: seat.id,
          name: 'Operaciones',
          rolesAndResponsibilities: ['Entrega de proyectos', 'Satisfacción de cliente'],
        },
      ],
    });

    await prisma.rock.createMany({
      data: [
        {
          tenantId: tenant.id,
          title: 'Lanzar módulo de Scorecard',
          ownerUserId: owner.id,
          quarter: '2026-Q3',
          isCompanyRock: true,
          status: 'on_track',
          dueDate: new Date('2026-09-30'),
        },
        {
          tenantId: tenant.id,
          title: 'Cerrar 3 nuevos clientes',
          ownerUserId: owner.id,
          quarter: '2026-Q3',
          isCompanyRock: false,
          status: 'off_track',
          dueDate: new Date('2026-09-30'),
        },
      ],
    });

    const metric = await prisma.scorecardMetric.create({
      data: {
        tenantId: tenant.id,
        name: 'Nº leads cualificados/semana',
        ownerUserId: owner.id,
        goalValue: 10,
        comparison: 'gte',
        frequency: 'weekly',
        unit: '#',
      },
    });
```
por:
```typescript
    const seat = await prisma.seat.create({
      data: {
        tenantId: tenant.id,
        name: 'CEO/Integrator',
        rolesAndResponsibilities: ['Visión', 'Rentabilidad', 'Liderazgo del equipo'],
        createdByUserId: owner.id,
        updatedByUserId: owner.id,
      },
    });

    await prisma.seat.createMany({
      data: [
        {
          tenantId: tenant.id,
          parentSeatId: seat.id,
          name: 'Ventas',
          rolesAndResponsibilities: ['Pipeline', 'Cierre de clientes nuevos'],
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
        {
          tenantId: tenant.id,
          parentSeatId: seat.id,
          name: 'Operaciones',
          rolesAndResponsibilities: ['Entrega de proyectos', 'Satisfacción de cliente'],
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
      ],
    });

    await prisma.rock.createMany({
      data: [
        {
          tenantId: tenant.id,
          title: 'Lanzar módulo de Scorecard',
          ownerUserId: owner.id,
          quarter: '2026-Q3',
          isCompanyRock: true,
          status: 'on_track',
          dueDate: new Date('2026-09-30'),
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
        {
          tenantId: tenant.id,
          title: 'Cerrar 3 nuevos clientes',
          ownerUserId: owner.id,
          quarter: '2026-Q3',
          isCompanyRock: false,
          status: 'off_track',
          dueDate: new Date('2026-09-30'),
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
      ],
    });

    const metric = await prisma.scorecardMetric.create({
      data: {
        tenantId: tenant.id,
        name: 'Nº leads cualificados/semana',
        ownerUserId: owner.id,
        goalValue: 10,
        comparison: 'gte',
        frequency: 'weekly',
        unit: '#',
        createdByUserId: owner.id,
        updatedByUserId: owner.id,
      },
    });
```

Y reemplaza:
```typescript
    await prisma.issue.createMany({
      data: [
        {
          tenantId: tenant.id,
          title: 'Proceso de onboarding de clientes no está documentado',
          raisedByUserId: owner.id,
          status: 'open',
          priority: 'high',
        },
        {
          tenantId: tenant.id,
          title: 'Revisar coste de hosting mensual',
          raisedByUserId: owner.id,
          status: 'discussing',
          priority: 'medium',
        },
      ],
    });

    await prisma.l10Meeting.create({
      data: {
        tenantId: tenant.id,
        meetingDate: new Date('2026-07-27'),
        facilitatorUserId: owner.id,
        status: 'completed',
        segueNotes: 'Buen ambiente, sin novedades personales relevantes.',
        headlines: 'Cliente nuevo firmado esta semana.',
        overallRating: 8,
      },
    });
```
por:
```typescript
    await prisma.issue.createMany({
      data: [
        {
          tenantId: tenant.id,
          title: 'Proceso de onboarding de clientes no está documentado',
          raisedByUserId: owner.id,
          status: 'open',
          priority: 'high',
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
        {
          tenantId: tenant.id,
          title: 'Revisar coste de hosting mensual',
          raisedByUserId: owner.id,
          status: 'discussing',
          priority: 'medium',
          createdByUserId: owner.id,
          updatedByUserId: owner.id,
        },
      ],
    });

    await prisma.l10Meeting.create({
      data: {
        tenantId: tenant.id,
        meetingDate: new Date('2026-07-27'),
        facilitatorUserId: owner.id,
        status: 'completed',
        segueNotes: 'Buen ambiente, sin novedades personales relevantes.',
        headlines: 'Cliente nuevo firmado esta semana.',
        overallRating: 8,
        createdByUserId: owner.id,
        updatedByUserId: owner.id,
      },
    });
```

- [ ] **Step 11: Corre el seed contra tu base local y verifica que no revienta**

Run: `npm run seed --prefix server` (o el script equivalente ya existente).
Expected: corre sin errores, es idempotente (ya lo era antes de este cambio).

- [ ] **Step 12: Corre la suite completa de backend para confirmar que nada se rompió**

Run: `npm test --prefix server -- --run`
Expected: todos los tests existentes siguen en verde (los campos nuevos son opcionales, así que los mocks de tests existentes que no los incluyen siguen siendo válidos).

- [ ] **Step 13: NO comitear**

Deja el schema, la migración generada y `seed.ts` en el working tree. No `git commit`.

---

### Task 2: Auditoría en `RockRepository` + `routes/rocks.ts`

**Files:**
- Modify: `server/src/repositories/RockRepository.ts`
- Modify: `server/src/repositories/RockRepository.test.ts`
- Modify: `server/src/routes/rocks.ts`
- Modify: `server/src/routes/rocks.test.ts`

**Interfaces:**
- Consumes: los campos `createdByUserId`/`updatedByUserId` del modelo `Rock` (Task 1, ya en el schema/cliente Prisma).
- Produces: `RockRepository.create(data, createdByUserId)`, `RockRepository.update(id, data, updatedByUserId)` — firma nueva, rompe la firma anterior de 1/2 argumentos.

- [ ] **Step 1: Añade el test que falla (repositorio)**

Añade al final de `server/src/repositories/RockRepository.test.ts` (antes del `});` de cierre del `describe`):

```typescript
  it('create sets createdByUserId and updatedByUserId to the same value', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.create).mockResolvedValue(baseRock as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    await repo.create(
      {
        title: 'Lanzar módulo de Scorecard',
        ownerUserId: 'user-1',
        quarter: '2026-Q3',
        isCompanyRock: true,
        dueDate: new Date('2026-09-30'),
      },
      'user-1'
    );

    expect(prisma.rock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdByUserId: 'user-1', updatedByUserId: 'user-1' }),
      include: { milestones: true },
    });
  });

  it('update sets updatedByUserId without touching createdByUserId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.rock.findFirst).mockResolvedValue({ ...baseRock, status: 'done' } as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    await repo.update('rock-1', { status: 'done' }, 'user-2');

    expect(prisma.rock.updateMany).toHaveBeenCalledWith({
      where: { id: 'rock-1', tenantId: 'tenant-1' },
      data: { status: 'done', updatedByUserId: 'user-2' },
    });
  });
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npm test --prefix server -- RockRepository.test.ts`
Expected: FAIL — `repo.create`/`repo.update` aún no aceptan el segundo/tercer argumento, o el `data` pasado a Prisma no incluye `createdByUserId`/`updatedByUserId`.

- [ ] **Step 3: Implementa el cambio**

En `server/src/repositories/RockRepository.ts`, reemplaza:
```typescript
  create(data: CreateRockInput): Promise<Rock> {
    return prisma.rock.create({ data: { ...data, tenantId: this.tenantId }, include: { milestones: true } });
  }

  async update(id: string, data: UpdateRockInput): Promise<Rock | null> {
    const result = await prisma.rock.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```
por:
```typescript
  create(data: CreateRockInput, createdByUserId: string): Promise<Rock> {
    return prisma.rock.create({
      data: { ...data, tenantId: this.tenantId, createdByUserId, updatedByUserId: createdByUserId },
      include: { milestones: true },
    });
  }

  async update(id: string, data: UpdateRockInput, updatedByUserId: string): Promise<Rock | null> {
    const result = await prisma.rock.updateMany({
      where: { id, tenantId: this.tenantId },
      data: { ...data, updatedByUserId },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```

- [ ] **Step 4: Arregla las llamadas existentes que usan la firma antigua**

Al añadir un argumento obligatorio a `create`/`update`, el archivo deja de compilar hasta que
actualices las llamadas ya existentes en `RockRepository.test.ts` que usaban la firma de 2/1
argumentos. Localiza estos dos tests (ya existían antes de esta tarea, no los creaste tú) y
edítalos exactamente así:

Reemplaza:
```typescript
  it('update returns null when no row matched tenant+id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 0 });

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.update('missing', { status: 'done' });

    expect(prisma.rock.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing', tenantId: 'tenant-1' },
      data: { status: 'done' },
    });
    expect(result).toBeNull();
  });
```
por:
```typescript
  it('update returns null when no row matched tenant+id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 0 });

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.update('missing', { status: 'done' }, 'user-1');

    expect(prisma.rock.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing', tenantId: 'tenant-1' },
      data: { status: 'done', updatedByUserId: 'user-1' },
    });
    expect(result).toBeNull();
  });
```

Y reemplaza:
```typescript
  it('update returns the fresh row when a row matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.rock.findFirst).mockResolvedValue({ ...baseRock, status: 'done' } as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.update('rock-1', { status: 'done' });

    expect(result).toEqual({ ...baseRock, status: 'done' });
  });
```
por:
```typescript
  it('update returns the fresh row when a row matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.rock.findFirst).mockResolvedValue({ ...baseRock, status: 'done' } as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.update('rock-1', { status: 'done' }, 'user-1');

    expect(result).toEqual({ ...baseRock, status: 'done' });
  });
```

Y reemplaza (el test de `create` ya existente, que usa `expect.objectContaining` — solo hace falta
añadir el segundo argumento a la llamada, la aserción ya tolera el campo nuevo tal cual está):
```typescript
    await repo.create({
      title: 'Lanzar módulo de Scorecard',
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: true,
      dueDate: new Date('2026-09-30'),
    });
```
por:
```typescript
    await repo.create(
      {
        title: 'Lanzar módulo de Scorecard',
        ownerUserId: 'user-1',
        quarter: '2026-Q3',
        isCompanyRock: true,
        dueDate: new Date('2026-09-30'),
      },
      'user-1'
    );
```

- [ ] **Step 5: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- RockRepository.test.ts`
Expected: PASS, todos los tests (los previos, ya arreglados, + los 2 nuevos del Step 1).

- [ ] **Step 6: Actualiza la ruta**

En `server/src/routes/rocks.ts`, reemplaza:
```typescript
  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createRockSchema.parse(request.body);
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.create(body);
    return reply.code(201).send(rock);
  });
```
por:
```typescript
  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createRockSchema.parse(request.body);
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.create(body, request.user.userId);
    return reply.code(201).send(rock);
  });
```
Y reemplaza:
```typescript
  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRockSchema.parse(request.body);
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.update(id, body);
    if (!rock) return reply.code(404).send({ error: 'Rock not found' });
    return rock;
  });
```
por:
```typescript
  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRockSchema.parse(request.body);
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.update(id, body, request.user.userId);
    if (!rock) return reply.code(404).send({ error: 'Rock not found' });
    return rock;
  });
```

- [ ] **Step 7: Añade el test que falla (ruta)**

Añade a `server/src/routes/rocks.test.ts`, después del test `'POST /rocks creates a rock and returns 201'`:

```typescript
  it('POST /rocks sets createdByUserId/updatedByUserId from the JWT, not from the body', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.create).mockResolvedValue(baseRock as never);

    const { app, headers } = await authedApp();
    await app.inject({
      method: 'POST',
      url: '/rocks',
      headers,
      payload: {
        title: 'Lanzar módulo de Scorecard',
        ownerUserId: 'user-1',
        quarter: '2026-Q3',
        isCompanyRock: true,
        dueDate: '2026-09-30',
        createdByUserId: 'attacker-id',
      },
    });

    expect(prisma.rock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdByUserId: 'user-1', updatedByUserId: 'user-1' }),
      })
    );
    await app.close();
  });
```

- [ ] **Step 8: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- rocks.test.ts`
Expected: PASS, todos los tests (los previos + el nuevo). El test confirma además que `createdByUserId: 'attacker-id'` en el body NO llega a Prisma — Zod lo descarta por no estar declarado en `createRockSchema`.

- [ ] **Step 9: Corre typecheck**

Run: `npm run typecheck --prefix server`
Expected: 0 errores.

- [ ] **Step 10: NO comitear** (deja los cambios en el working tree)

---

### Task 3: Auditoría en `IssueRepository` + `routes/issues.ts`

**Files:**
- Modify: `server/src/repositories/IssueRepository.ts`
- Modify: `server/src/repositories/IssueRepository.test.ts`
- Modify: `server/src/routes/issues.ts`
- Modify: `server/src/routes/issues.test.ts`

**Interfaces:**
- Consumes: los campos `createdByUserId`/`updatedByUserId` del modelo `Issue` (Task 1).
- Produces: `IssueRepository.create(data, createdByUserId)`, `IssueRepository.update(id, data, updatedByUserId)` — firma nueva. `IssueRepository.reorder(orderedIds)` NO cambia — reordenar por drag-and-drop es un cambio de posición, no de contenido; se excluye deliberadamente del alcance de auditoría de esta tarea (YAGNI).

- [ ] **Step 1: Actualiza el factory `makeIssue()` para incluir los campos nuevos**

En `server/src/repositories/IssueRepository.test.ts`, reemplaza:
```typescript
function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    tenantId: TENANT_A,
    title: 'Slow onboarding',
    description: null,
    raisedByUserId: 'user-1',
    status: 'open',
    priority: 'medium',
    sortOrder: 0,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    resolvedAt: null,
    resolutionNotes: null,
    ...overrides,
  };
}
```
por:
```typescript
function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    tenantId: TENANT_A,
    title: 'Slow onboarding',
    description: null,
    raisedByUserId: 'user-1',
    status: 'open',
    priority: 'medium',
    sortOrder: 0,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    createdByUserId: null,
    updatedByUserId: null,
    resolvedAt: null,
    resolutionNotes: null,
    ...overrides,
  };
}
```
(el modelo `Issue` de `@prisma/client` gana `updatedAt`/`createdByUserId`/`updatedByUserId` como propiedades no-opcionales tras la migración de Task 1 — sin este cambio, `makeIssue(): Issue` deja de compilar.)

- [ ] **Step 2: Arregla las 2 llamadas a `repo.create(...)` ya existentes**

Reemplaza:
```typescript
  describe('create', () => {
    it('assigns sortOrder = max(sortOrder for tenant) + 1', async () => {
      vi.mocked(prisma.issue.aggregate).mockResolvedValue({ _max: { sortOrder: 4 } } as never);
      vi.mocked(prisma.issue.create).mockResolvedValue(makeIssue({ sortOrder: 5 }));
      const repo = new IssueRepository(TENANT_A);

      await repo.create({ title: 'New issue', raisedByUserId: 'user-1', priority: 'high' });

      expect(prisma.issue.aggregate).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A },
        _max: { sortOrder: true },
      });
      expect(prisma.issue.create).toHaveBeenCalledWith({
        data: { title: 'New issue', raisedByUserId: 'user-1', priority: 'high', tenantId: TENANT_A, sortOrder: 5 },
      });
    });

    it('assigns sortOrder 0 when the tenant has no issues yet', async () => {
      vi.mocked(prisma.issue.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as never);
      vi.mocked(prisma.issue.create).mockResolvedValue(makeIssue({ sortOrder: 0 }));
      const repo = new IssueRepository(TENANT_A);

      await repo.create({ title: 'First issue', raisedByUserId: 'user-1', priority: 'low' });

      expect(prisma.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortOrder: 0 }) })
      );
    });
  });
```
por:
```typescript
  describe('create', () => {
    it('assigns sortOrder = max(sortOrder for tenant) + 1', async () => {
      vi.mocked(prisma.issue.aggregate).mockResolvedValue({ _max: { sortOrder: 4 } } as never);
      vi.mocked(prisma.issue.create).mockResolvedValue(makeIssue({ sortOrder: 5 }));
      const repo = new IssueRepository(TENANT_A);

      await repo.create({ title: 'New issue', raisedByUserId: 'user-1', priority: 'high' }, 'user-1');

      expect(prisma.issue.aggregate).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A },
        _max: { sortOrder: true },
      });
      expect(prisma.issue.create).toHaveBeenCalledWith({
        data: {
          title: 'New issue',
          raisedByUserId: 'user-1',
          priority: 'high',
          tenantId: TENANT_A,
          sortOrder: 5,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      });
    });

    it('assigns sortOrder 0 when the tenant has no issues yet', async () => {
      vi.mocked(prisma.issue.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as never);
      vi.mocked(prisma.issue.create).mockResolvedValue(makeIssue({ sortOrder: 0 }));
      const repo = new IssueRepository(TENANT_A);

      await repo.create({ title: 'First issue', raisedByUserId: 'user-1', priority: 'low' }, 'user-1');

      expect(prisma.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortOrder: 0 }) })
      );
    });
  });
```

- [ ] **Step 3: Arregla las 6 llamadas a `repo.update(...)` ya existentes**

En el bloque `describe('update', ...)`, cada llamada a `repo.update('issue-1', {...})` o `repo.update('missing', {...})` pasa a llevar un tercer argumento `'user-1'`. Ninguna de estas 6 aserciones necesita cambiar su contenido (comprueban `call.data.<campo>` individualmente o el valor de retorno, nunca el objeto `data` completo) — solo añade el tercer argumento a cada llamada:

```typescript
      const result = await repo.update('missing', { title: 'x' });
```
→
```typescript
      const result = await repo.update('missing', { title: 'x' }, 'user-1');
```

```typescript
      await repo.update('issue-1', { status: 'solved' });
```
→
```typescript
      await repo.update('issue-1', { status: 'solved' }, 'user-1');
```

```typescript
      await repo.update('issue-1', { status: 'dropped' });
```
→
```typescript
      await repo.update('issue-1', { status: 'dropped' }, 'user-1');
```

```typescript
      await repo.update('issue-1', { status: 'open' });
```
→
```typescript
      await repo.update('issue-1', { status: 'open' }, 'user-1');
```

```typescript
      await repo.update('issue-1', { title: 'Renamed' });
```
→
```typescript
      await repo.update('issue-1', { title: 'Renamed' }, 'user-1');
```

```typescript
      await repo.update('issue-1', { status: 'solved', title: 'Renamed while already solved' });
```
→
```typescript
      await repo.update('issue-1', { status: 'solved', title: 'Renamed while already solved' }, 'user-1');
```

```typescript
      const result = await repo.update('missing', { status: 'solved' });
```
→
```typescript
      const result = await repo.update('missing', { status: 'solved' }, 'user-1');
```

- [ ] **Step 4: Añade el test que falla (auditoría explícita)**

Añade dentro de `describe('update', ...)`, después del último test existente:
```typescript
    it('sets updatedByUserId on every update, alongside any resolvedAt logic', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue());
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { title: 'Renamed' }, 'user-2');

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.data.updatedByUserId).toBe('user-2');
    });
```
Y dentro de `describe('create', ...)`, después del último test existente:
```typescript
    it('sets createdByUserId and updatedByUserId to the same value', async () => {
      vi.mocked(prisma.issue.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as never);
      vi.mocked(prisma.issue.create).mockResolvedValue(makeIssue());
      const repo = new IssueRepository(TENANT_A);

      await repo.create({ title: 'New issue', raisedByUserId: 'user-1', priority: 'high' }, 'user-3');

      expect(prisma.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdByUserId: 'user-3', updatedByUserId: 'user-3' }),
        })
      );
    });
```

- [ ] **Step 5: Corre el test para verificar que falla**

Run: `npm test --prefix server -- IssueRepository.test.ts`
Expected: FAIL (los 2 tests nuevos del Step 4 fallan porque `IssueRepository` aún no acepta el argumento extra ni escribe los campos).

- [ ] **Step 6: Implementa el cambio**

En `server/src/repositories/IssueRepository.ts`, reemplaza:
```typescript
  async create(data: CreateIssueInput): Promise<Issue> {
    const last = await prisma.issue.aggregate({
      where: { tenantId: this.tenantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (last._max.sortOrder ?? -1) + 1;
    return prisma.issue.create({ data: { ...data, tenantId: this.tenantId, sortOrder } });
  }

  async update(id: string, data: UpdateIssueInput): Promise<Issue | null> {
    const patch: Prisma.IssueUncheckedUpdateManyInput = { ...data };
    if (data.status !== undefined) {
      const current = await this.findById(id);
      if (!current) return null;
      if (data.status !== current.status) {
        patch.resolvedAt = data.status === 'solved' || data.status === 'dropped' ? new Date() : null;
      }
    }
    const result = await prisma.issue.updateMany({ where: { id, tenantId: this.tenantId }, data: patch });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```
por:
```typescript
  async create(data: CreateIssueInput, createdByUserId: string): Promise<Issue> {
    const last = await prisma.issue.aggregate({
      where: { tenantId: this.tenantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (last._max.sortOrder ?? -1) + 1;
    return prisma.issue.create({
      data: { ...data, tenantId: this.tenantId, sortOrder, createdByUserId, updatedByUserId: createdByUserId },
    });
  }

  async update(id: string, data: UpdateIssueInput, updatedByUserId: string): Promise<Issue | null> {
    const patch: Prisma.IssueUncheckedUpdateManyInput = { ...data, updatedByUserId };
    if (data.status !== undefined) {
      const current = await this.findById(id);
      if (!current) return null;
      if (data.status !== current.status) {
        patch.resolvedAt = data.status === 'solved' || data.status === 'dropped' ? new Date() : null;
      }
    }
    const result = await prisma.issue.updateMany({ where: { id, tenantId: this.tenantId }, data: patch });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```

- [ ] **Step 7: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- IssueRepository.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 8: Actualiza la ruta**

En `server/src/routes/issues.ts`, reemplaza:
```typescript
  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createIssueSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    const issue = await repo.create(body);
    return reply.code(201).send(issue);
  });
```
por:
```typescript
  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createIssueSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    const issue = await repo.create(body, request.user.userId);
    return reply.code(201).send(issue);
  });
```
Y reemplaza:
```typescript
  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateIssueSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    const issue = await repo.update(id, body);
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });
    return issue;
  });
```
por:
```typescript
  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateIssueSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    const issue = await repo.update(id, body, request.user.userId);
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });
    return issue;
  });
```
No toques el handler `PATCH /reorder` — sigue llamando a `repo.reorder(orderedIds)` sin cambios (ver Interfaces arriba).

**Nota importante sobre `issues.test.ts` — NO sigue el patrón de `rocks.test.ts`.** Este archivo
mockea la clase `IssueRepository` entera (no `prisma` directo) y mockea `requireTenant` con un
preHandler mínimo que solo fija `request.tenantId` — **nunca fija `request.user`**, porque el
`app.authenticate` real (que rellena `request.user` desde el JWT) queda completamente baypaseado.
Si la ruta pasa a leer `request.user.userId` sin arreglar esto, TODOS los tests de `POST`/`PATCH`
de este archivo revientan con `TypeError: Cannot read properties of undefined (reading 'userId')`
antes de llegar a ninguna aserción. Hay que arreglar el mock primero.

- [ ] **Step 9: Arregla el mock de `requireTenant` para que también fije `request.user`**

En `server/src/routes/issues.test.ts`, reemplaza:
```typescript
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string }) => {
      request.tenantId = 'tenant-a';
    },
  ],
}));
```
por:
```typescript
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string; user?: { userId: string } }) => {
      request.user = { userId: 'user-1' };
      request.tenantId = 'tenant-a';
    },
  ],
}));
```
(Si el mock actual no tiene exactamente esta forma en el archivo real, aplica el mismo cambio
conceptual: el preHandler mockeado debe fijar tanto `request.user = { userId: 'user-1' }` como
`request.tenantId = 'tenant-a'`, en ese orden o el que sea, antes de que la ruta se ejecute.)

- [ ] **Step 10: Arregla las 2 aserciones exactas que ya existen y se romperán**

Reemplaza:
```typescript
  it('POST /issues creates an issue and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/issues',
      payload: { title: 'Slow onboarding', raisedByUserId: 'user-1', priority: 'medium' },
    });
    expect(res.statusCode).toBe(201);
    expect(repoMock.create).toHaveBeenCalledWith({
      title: 'Slow onboarding',
      raisedByUserId: 'user-1',
      priority: 'medium',
    });
  });
```
por:
```typescript
  it('POST /issues creates an issue and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/issues',
      payload: { title: 'Slow onboarding', raisedByUserId: 'user-1', priority: 'medium' },
    });
    expect(res.statusCode).toBe(201);
    expect(repoMock.create).toHaveBeenCalledWith(
      { title: 'Slow onboarding', raisedByUserId: 'user-1', priority: 'medium' },
      'user-1'
    );
  });
```
Y reemplaza:
```typescript
  it('PATCH /issues/:id updates and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/issues/issue-1', payload: { status: 'discussing' } });
    expect(res.statusCode).toBe(200);
    expect(repoMock.update).toHaveBeenCalledWith('issue-1', { status: 'discussing' });
  });
```
por:
```typescript
  it('PATCH /issues/:id updates and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/issues/issue-1', payload: { status: 'discussing' } });
    expect(res.statusCode).toBe(200);
    expect(repoMock.update).toHaveBeenCalledWith('issue-1', { status: 'discussing' }, 'user-1');
  });
```

- [ ] **Step 11: Añade el test que falla (auditoría explícita, anti-tampering)**

Añade a `server/src/routes/issues.test.ts`, después del test `'POST /issues defaults priority to medium when omitted'`:
```typescript
  it('POST /issues sets createdByUserId from the JWT, ignoring any value in the body', async () => {
    await app.inject({
      method: 'POST',
      url: '/issues',
      payload: { title: 'x', raisedByUserId: 'user-1', priority: 'medium', createdByUserId: 'attacker-id' },
    });
    expect(repoMock.create).toHaveBeenCalledWith(
      { title: 'x', raisedByUserId: 'user-1', priority: 'medium' },
      'user-1'
    );
  });
```

- [ ] **Step 12: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- issues.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 13: Corre typecheck**

Run: `npm run typecheck --prefix server`
Expected: 0 errores.

- [ ] **Step 14: NO comitear**

---

### Task 4: Auditoría en `SeatRepository` + `routes/seats.ts`

**Files:**
- Modify: `server/src/repositories/SeatRepository.ts`
- Modify: `server/src/repositories/SeatRepository.test.ts`
- Modify: `server/src/routes/seats.ts`

**Interfaces:**
- Consumes: los campos `createdByUserId`/`updatedByUserId` del modelo `Seat` (Task 1).
- Produces: `SeatRepository.create(input, createdByUserId)`, `SeatRepository.update(id, input, updatedByUserId)` — firma nueva.

**Nota:** `routes/seats.test.ts` usa el mismo patrón `authedApp`/JWT real que `rocks.test.ts` (mockea
`prisma` directo, no la clase repositorio) y ninguna de sus aserciones de `POST`/`PATCH` comprueba
el `data` exacto pasado a `prisma.seat.create`/`.update` — no hace falta tocar `routes/seats.test.ts`
en esta tarea.

- [ ] **Step 1: Arregla las 4 llamadas a `repo.create`/`repo.update` ya existentes en `SeatRepository.test.ts`**

Reemplaza:
```typescript
    await expect(repo.create({ name: 'Ventas', parentSeatId: 'seat-from-cionet' })).rejects.toMatchObject({
      statusCode: 404,
    });
```
por:
```typescript
    await expect(repo.create({ name: 'Ventas', parentSeatId: 'seat-from-cionet' }, 'user-1')).rejects.toMatchObject({
      statusCode: 404,
    });
```

Reemplaza:
```typescript
  it('create scopes the new row to the repository tenantId regardless of input', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.seat.create).mockResolvedValue({ id: 'seat-1' } as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    await new SeatRepository('tasvalor').create({ name: 'CEO' });

    expect(prisma.seat.create).toHaveBeenCalledWith({
      data: { tenantId: 'tasvalor', name: 'CEO', parentSeatId: null, rolesAndResponsibilities: [] },
    });
  });
```
por:
```typescript
  it('create scopes the new row to the repository tenantId regardless of input', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.seat.create).mockResolvedValue({ id: 'seat-1' } as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    await new SeatRepository('tasvalor').create({ name: 'CEO' }, 'user-1');

    expect(prisma.seat.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tasvalor',
        name: 'CEO',
        parentSeatId: null,
        rolesAndResponsibilities: [],
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      },
    });
  });
```

Reemplaza:
```typescript
    await expect(repo.update('seat-1', { parentSeatId: 'seat-2' })).rejects.toMatchObject({ statusCode: 409 });
```
por:
```typescript
    await expect(repo.update('seat-1', { parentSeatId: 'seat-2' }, 'user-1')).rejects.toMatchObject({
      statusCode: 409,
    });
```

Reemplaza:
```typescript
    await expect(new SeatRepository('tasvalor').update('seat-from-cionet', { name: 'x' })).rejects.toMatchObject({
      statusCode: 404,
    });
```
por:
```typescript
    await expect(
      new SeatRepository('tasvalor').update('seat-from-cionet', { name: 'x' }, 'user-1')
    ).rejects.toMatchObject({
      statusCode: 404,
    });
```

- [ ] **Step 2: Añade el test que falla (auditoría en `update`)**

Añade a `server/src/repositories/SeatRepository.test.ts`, antes del `});` de cierre del `describe`:
```typescript
  it('update sets updatedByUserId on the row', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.seat.findFirst).mockResolvedValue({ id: 'seat-1', tenantId: 'tasvalor', parentSeatId: null });
    vi.mocked(prisma.seat.update).mockResolvedValue({ id: 'seat-1', name: 'Renombrado' } as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    await new SeatRepository('tasvalor').update('seat-1', { name: 'Renombrado' }, 'user-2');

    expect(prisma.seat.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: 'seat-1', tenantId: 'tasvalor' } },
      data: { name: 'Renombrado', updatedByUserId: 'user-2' },
    });
  });
```

- [ ] **Step 3: Corre el test para verificar que falla**

Run: `npm test --prefix server -- SeatRepository.test.ts`
Expected: FAIL (el test nuevo del Step 2 falla; los del Step 1 fallan en compilación hasta el Step 4).

- [ ] **Step 4: Implementa el cambio**

En `server/src/repositories/SeatRepository.ts`, reemplaza:
```typescript
  async create(input: SeatInput) {
    await this.assertParentInTenantAndAcyclic(null, input.parentSeatId);

    return prisma.seat.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        parentSeatId: input.parentSeatId ?? null,
        rolesAndResponsibilities: input.rolesAndResponsibilities ?? [],
      },
    });
  }

  async update(id: string, input: Partial<SeatInput>) {
    await this.findOrThrow(id);

    if ('parentSeatId' in input) {
      await this.assertParentInTenantAndAcyclic(id, input.parentSeatId);
    }

    return prisma.seat.update({
      where: { id_tenantId: { id, tenantId: this.tenantId } },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...('parentSeatId' in input && { parentSeatId: input.parentSeatId ?? null }),
        ...(input.rolesAndResponsibilities !== undefined && {
          rolesAndResponsibilities: input.rolesAndResponsibilities,
        }),
      },
    });
  }
```
por:
```typescript
  async create(input: SeatInput, createdByUserId: string) {
    await this.assertParentInTenantAndAcyclic(null, input.parentSeatId);

    return prisma.seat.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        parentSeatId: input.parentSeatId ?? null,
        rolesAndResponsibilities: input.rolesAndResponsibilities ?? [],
        createdByUserId,
        updatedByUserId: createdByUserId,
      },
    });
  }

  async update(id: string, input: Partial<SeatInput>, updatedByUserId: string) {
    await this.findOrThrow(id);

    if ('parentSeatId' in input) {
      await this.assertParentInTenantAndAcyclic(id, input.parentSeatId);
    }

    return prisma.seat.update({
      where: { id_tenantId: { id, tenantId: this.tenantId } },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...('parentSeatId' in input && { parentSeatId: input.parentSeatId ?? null }),
        ...(input.rolesAndResponsibilities !== undefined && {
          rolesAndResponsibilities: input.rolesAndResponsibilities,
        }),
        updatedByUserId,
      },
    });
  }
```

- [ ] **Step 5: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- SeatRepository.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 6: Actualiza la ruta**

En `server/src/routes/seats.ts`, reemplaza:
```typescript
      const body = seatInputSchema.parse(request.body);
      const repo = new SeatRepository(request.tenantId!);
      const seat = await repo.create(body);
      return reply.code(201).send(seat);
```
por:
```typescript
      const body = seatInputSchema.parse(request.body);
      const repo = new SeatRepository(request.tenantId!);
      const seat = await repo.create(body, request.user.userId);
      return reply.code(201).send(seat);
```
Y reemplaza:
```typescript
      const { id } = seatIdParamsSchema.parse(request.params);
      const body = seatUpdateSchema.parse(request.body);
      const repo = new SeatRepository(request.tenantId!);
      return repo.update(id, body);
```
por:
```typescript
      const { id } = seatIdParamsSchema.parse(request.params);
      const body = seatUpdateSchema.parse(request.body);
      const repo = new SeatRepository(request.tenantId!);
      return repo.update(id, body, request.user.userId);
```

- [ ] **Step 7: Corre la suite de rutas de seats para confirmar que nada se rompió**

Run: `npm test --prefix server -- seats.test.ts`
Expected: PASS, todos los tests (ver nota al inicio de la tarea — no debería hacer falta tocar este archivo).

- [ ] **Step 8: Corre typecheck**

Run: `npm run typecheck --prefix server`
Expected: 0 errores.

- [ ] **Step 9: NO comitear**

---

### Task 5: Auditoría en `ScorecardMetricRepository` + `routes/scorecard.ts`

**Files:**
- Modify: `server/src/repositories/ScorecardMetricRepository.ts`
- Modify: `server/src/repositories/ScorecardMetricRepository.test.ts`
- Modify: `server/src/routes/scorecard.ts`

**Interfaces:**
- Consumes: los campos `createdByUserId`/`updatedByUserId` del modelo `ScorecardMetric` (Task 1).
- Produces: `ScorecardMetricRepository.create(data, createdByUserId)`, `ScorecardMetricRepository.update(id, data, updatedByUserId)` — firma nueva. `ScorecardEntryRepository.upsert` NO cambia (ya tiene `enteredByUserId`, fuera de alcance de esta tarea).

**Nota:** `routes/scorecard.test.ts` usa el patrón `authedApp`/JWT real y ninguna de sus aserciones
de `POST/PATCH /metrics` comprueba el `data` exacto pasado a Prisma — no hace falta tocarlo.

- [ ] **Step 1: Arregla las 3 llamadas a `repo.create`/`repo.update` ya existentes**

Reemplaza:
```typescript
    const result = await repo.create({
      name: 'Nº leads cualificados/semana',
      ownerUserId: 'user-1',
      goalValue: 10,
      comparison: 'gte',
      frequency: 'weekly',
      unit: '#',
    });
```
por:
```typescript
    const result = await repo.create(
      {
        name: 'Nº leads cualificados/semana',
        ownerUserId: 'user-1',
        goalValue: 10,
        comparison: 'gte',
        frequency: 'weekly',
        unit: '#',
      },
      'user-1'
    );
```

Reemplaza:
```typescript
  it('update returns null when no row matched tenant+id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.updateMany).mockResolvedValue({ count: 0 });

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const result = await repo.update('missing', { isActive: false });

    expect(prisma.scorecardMetric.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing', tenantId: 'tenant-1' },
      data: { isActive: false },
    });
    expect(result).toBeNull();
  });
```
por:
```typescript
  it('update returns null when no row matched tenant+id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.updateMany).mockResolvedValue({ count: 0 });

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const result = await repo.update('missing', { isActive: false }, 'user-1');

    expect(prisma.scorecardMetric.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing', tenantId: 'tenant-1' },
      data: { isActive: false, updatedByUserId: 'user-1' },
    });
    expect(result).toBeNull();
  });
```

Reemplaza:
```typescript
    const result = await repo.update('metric-1', { isActive: false });
```
por:
```typescript
    const result = await repo.update('metric-1', { isActive: false }, 'user-1');
```

- [ ] **Step 2: Corre el test para verificar que falla**

Run: `npm test --prefix server -- ScorecardMetricRepository.test.ts`
Expected: FAIL en compilación/aserción hasta el Step 3 (`create`/`update` aún no aceptan el argumento nuevo).

- [ ] **Step 3: Implementa el cambio**

En `server/src/repositories/ScorecardMetricRepository.ts`, reemplaza:
```typescript
  async create(data: CreateMetricInput): Promise<ScorecardMetricView> {
    const metric = await prisma.scorecardMetric.create({ data: { ...data, tenantId: this.tenantId } });
    return toView(metric);
  }

  async update(id: string, data: UpdateMetricInput): Promise<ScorecardMetricView | null> {
    const result = await prisma.scorecardMetric.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```
por:
```typescript
  async create(data: CreateMetricInput, createdByUserId: string): Promise<ScorecardMetricView> {
    const metric = await prisma.scorecardMetric.create({
      data: { ...data, tenantId: this.tenantId, createdByUserId, updatedByUserId: createdByUserId },
    });
    return toView(metric);
  }

  async update(id: string, data: UpdateMetricInput, updatedByUserId: string): Promise<ScorecardMetricView | null> {
    const result = await prisma.scorecardMetric.updateMany({
      where: { id, tenantId: this.tenantId },
      data: { ...data, updatedByUserId },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```

- [ ] **Step 4: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- ScorecardMetricRepository.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 5: Actualiza la ruta**

En `server/src/routes/scorecard.ts`, reemplaza:
```typescript
  app.post('/metrics', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createMetricSchema.parse(request.body);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await repo.create(body);
    return reply.code(201).send(metric);
  });
```
por:
```typescript
  app.post('/metrics', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createMetricSchema.parse(request.body);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await repo.create(body, request.user.userId);
    return reply.code(201).send(metric);
  });
```
Y reemplaza:
```typescript
  app.patch('/metrics/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateMetricSchema.parse(request.body);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await repo.update(id, body);
    if (!metric) return reply.code(404).send({ error: 'Metric not found' });
    return metric;
  });
```
por:
```typescript
  app.patch('/metrics/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateMetricSchema.parse(request.body);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await repo.update(id, body, request.user.userId);
    if (!metric) return reply.code(404).send({ error: 'Metric not found' });
    return metric;
  });
```

- [ ] **Step 6: Corre la suite de rutas de scorecard para confirmar que nada se rompió**

Run: `npm test --prefix server -- scorecard.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 7: Corre typecheck**

Run: `npm run typecheck --prefix server`
Expected: 0 errores.

- [ ] **Step 8: NO comitear**

---

### Task 6: Auditoría en `L10MeetingRepository` + `routes/l10.ts`

**Files:**
- Modify: `server/src/repositories/L10MeetingRepository.ts`
- Modify: `server/src/repositories/L10MeetingRepository.test.ts`
- Modify: `server/src/routes/l10.ts`
- Modify: `server/src/routes/l10.test.ts`

**Interfaces:**
- Consumes: los campos `createdByUserId`/`updatedByUserId` del modelo `L10Meeting` (Task 1).
- Produces: `L10MeetingRepository.create(data, createdByUserId)`, `L10MeetingRepository.update(id, data, updatedByUserId)` — firma nueva. El handler `POST /:id/close` también pasa a llamar `update(...)` con el argumento nuevo. `L10AgendaItemLogRepository` NO cambia (`L10AgendaItemLog` está fuera del alcance de auditoría de este sprint — ver Decisión de diseño #1).

**Nota importante sobre `l10.test.ts` — mismo problema que `issues.test.ts` (Task 3).** Mockea
`L10MeetingRepository`/`L10AgendaItemLogRepository` enteras y mockea `requireTenant` con un
preHandler que solo fija `request.tenantId`, nunca `request.user`. Hay que arreglar el mock igual
que en Task 3 antes de que la ruta lea `request.user.userId`.

- [ ] **Step 1: Actualiza el factory `makeMeeting()` para incluir los campos nuevos**

En `server/src/repositories/L10MeetingRepository.test.ts`, reemplaza:
```typescript
function makeMeeting(overrides: Partial<L10Meeting> = {}): L10Meeting {
  return {
    id: 'meeting-1',
    tenantId: TENANT_A,
    meetingDate: new Date('2026-08-03T00:00:00.000Z'),
    facilitatorUserId: 'user-1',
    status: 'scheduled',
    segueNotes: null,
    headlines: null,
    concludeNotes: null,
    overallRating: null,
    ...overrides,
  };
}
```
por:
```typescript
function makeMeeting(overrides: Partial<L10Meeting> = {}): L10Meeting {
  return {
    id: 'meeting-1',
    tenantId: TENANT_A,
    meetingDate: new Date('2026-08-03T00:00:00.000Z'),
    facilitatorUserId: 'user-1',
    status: 'scheduled',
    segueNotes: null,
    headlines: null,
    concludeNotes: null,
    overallRating: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    createdByUserId: null,
    updatedByUserId: null,
    ...overrides,
  };
}
```

- [ ] **Step 2: Arregla las 3 llamadas a `repo.create`/`repo.update` ya existentes**

Reemplaza:
```typescript
  describe('create', () => {
    it('injects tenantId and defaults status to scheduled', async () => {
      vi.mocked(prisma.l10Meeting.create).mockResolvedValue(makeMeeting());
      const repo = new L10MeetingRepository(TENANT_A);
      const meetingDate = new Date('2026-08-03T00:00:00.000Z');

      await repo.create({ meetingDate, facilitatorUserId: 'user-1' });

      expect(prisma.l10Meeting.create).toHaveBeenCalledWith({
        data: { meetingDate, facilitatorUserId: 'user-1', tenantId: TENANT_A, status: 'scheduled' },
      });
    });
  });

  describe('update', () => {
    it('returns null when no row matches id+tenantId', async () => {
      vi.mocked(prisma.l10Meeting.updateMany).mockResolvedValue({ count: 0 });
      const repo = new L10MeetingRepository(TENANT_A);

      expect(await repo.update('missing', { segueNotes: 'x' })).toBeNull();
    });

    it('updates the matching row scoped to tenantId, including close-style fields', async () => {
      vi.mocked(prisma.l10Meeting.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.l10Meeting.findFirst).mockResolvedValue(makeMeeting({ status: 'completed', overallRating: 8 }));
      const repo = new L10MeetingRepository(TENANT_A);

      await repo.update('meeting-1', { status: 'completed', overallRating: 8, concludeNotes: 'Buena reunión' });

      expect(prisma.l10Meeting.updateMany).toHaveBeenCalledWith({
        where: { id: 'meeting-1', tenantId: TENANT_A },
        data: { status: 'completed', overallRating: 8, concludeNotes: 'Buena reunión' },
      });
    });
  });
```
por:
```typescript
  describe('create', () => {
    it('injects tenantId and defaults status to scheduled', async () => {
      vi.mocked(prisma.l10Meeting.create).mockResolvedValue(makeMeeting());
      const repo = new L10MeetingRepository(TENANT_A);
      const meetingDate = new Date('2026-08-03T00:00:00.000Z');

      await repo.create({ meetingDate, facilitatorUserId: 'user-1' }, 'user-1');

      expect(prisma.l10Meeting.create).toHaveBeenCalledWith({
        data: {
          meetingDate,
          facilitatorUserId: 'user-1',
          tenantId: TENANT_A,
          status: 'scheduled',
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      });
    });
  });

  describe('update', () => {
    it('returns null when no row matches id+tenantId', async () => {
      vi.mocked(prisma.l10Meeting.updateMany).mockResolvedValue({ count: 0 });
      const repo = new L10MeetingRepository(TENANT_A);

      expect(await repo.update('missing', { segueNotes: 'x' }, 'user-1')).toBeNull();
    });

    it('updates the matching row scoped to tenantId, including close-style fields', async () => {
      vi.mocked(prisma.l10Meeting.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.l10Meeting.findFirst).mockResolvedValue(makeMeeting({ status: 'completed', overallRating: 8 }));
      const repo = new L10MeetingRepository(TENANT_A);

      await repo.update(
        'meeting-1',
        { status: 'completed', overallRating: 8, concludeNotes: 'Buena reunión' },
        'user-1'
      );

      expect(prisma.l10Meeting.updateMany).toHaveBeenCalledWith({
        where: { id: 'meeting-1', tenantId: TENANT_A },
        data: { status: 'completed', overallRating: 8, concludeNotes: 'Buena reunión', updatedByUserId: 'user-1' },
      });
    });
  });
```

- [ ] **Step 3: Corre el test para verificar que falla**

Run: `npm test --prefix server -- L10MeetingRepository.test.ts`
Expected: FAIL hasta el Step 4.

- [ ] **Step 4: Implementa el cambio**

En `server/src/repositories/L10MeetingRepository.ts`, reemplaza:
```typescript
  create(data: CreateMeetingInput): Promise<L10Meeting> {
    return prisma.l10Meeting.create({ data: { ...data, tenantId: this.tenantId, status: 'scheduled' } });
  }

  async update(id: string, data: UpdateMeetingInput): Promise<L10Meeting | null> {
    const result = await prisma.l10Meeting.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```
por:
```typescript
  create(data: CreateMeetingInput, createdByUserId: string): Promise<L10Meeting> {
    return prisma.l10Meeting.create({
      data: { ...data, tenantId: this.tenantId, status: 'scheduled', createdByUserId, updatedByUserId: createdByUserId },
    });
  }

  async update(id: string, data: UpdateMeetingInput, updatedByUserId: string): Promise<L10Meeting | null> {
    const result = await prisma.l10Meeting.updateMany({
      where: { id, tenantId: this.tenantId },
      data: { ...data, updatedByUserId },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```

- [ ] **Step 5: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- L10MeetingRepository.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 6: Actualiza la ruta**

En `server/src/routes/l10.ts`, reemplaza:
```typescript
  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createMeetingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.create(body);
    return reply.code(201).send(meeting);
  });
```
por:
```typescript
  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createMeetingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.create(body, request.user.userId);
    return reply.code(201).send(meeting);
  });
```
Reemplaza:
```typescript
  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateMeetingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.update(id, body);
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    return meeting;
  });
```
por:
```typescript
  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateMeetingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.update(id, body, request.user.userId);
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    return meeting;
  });
```
Y reemplaza:
```typescript
  app.post('/:id/close', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = closeMeetingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.update(id, {
      status: 'completed',
      overallRating: body.overallRating,
      concludeNotes: body.concludeNotes,
    });
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    return meeting;
  });
```
por:
```typescript
  app.post('/:id/close', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = closeMeetingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.update(
      id,
      {
        status: 'completed',
        overallRating: body.overallRating,
        concludeNotes: body.concludeNotes,
      },
      request.user.userId
    );
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    return meeting;
  });
```

- [ ] **Step 7: Arregla el mock de `requireTenant` en `l10.test.ts`**

Reemplaza:
```typescript
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string }) => {
      request.tenantId = 'tenant-a';
    },
  ],
}));
```
por:
```typescript
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string; user?: { userId: string } }) => {
      request.user = { userId: 'user-1' };
      request.tenantId = 'tenant-a';
    },
  ],
}));
```

- [ ] **Step 8: Arregla las 2 aserciones exactas que ya existen en `l10.test.ts` y se romperán**

Reemplaza:
```typescript
  it('PATCH /l10/:id updates notes and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/l10/meeting-1', payload: { segueNotes: 'Todo bien' } });
    expect(res.statusCode).toBe(200);
    expect(meetingRepoMock.update).toHaveBeenCalledWith('meeting-1', { segueNotes: 'Todo bien' });
  });
```
por:
```typescript
  it('PATCH /l10/:id updates notes and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/l10/meeting-1', payload: { segueNotes: 'Todo bien' } });
    expect(res.statusCode).toBe(200);
    expect(meetingRepoMock.update).toHaveBeenCalledWith('meeting-1', { segueNotes: 'Todo bien' }, 'user-1');
  });
```
Y reemplaza:
```typescript
  it('POST /l10/:id/close sets status=completed and passes rating+notes to update', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/l10/meeting-1/close',
      payload: { overallRating: 8, concludeNotes: 'Buena reunión' },
    });
    expect(res.statusCode).toBe(200);
    expect(meetingRepoMock.update).toHaveBeenCalledWith('meeting-1', {
      status: 'completed',
      overallRating: 8,
      concludeNotes: 'Buena reunión',
    });
  });
```
por:
```typescript
  it('POST /l10/:id/close sets status=completed and passes rating+notes to update', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/l10/meeting-1/close',
      payload: { overallRating: 8, concludeNotes: 'Buena reunión' },
    });
    expect(res.statusCode).toBe(200);
    expect(meetingRepoMock.update).toHaveBeenCalledWith(
      'meeting-1',
      { status: 'completed', overallRating: 8, concludeNotes: 'Buena reunión' },
      'user-1'
    );
  });
```
También revisa el test `'POST /l10 creates a meeting and returns 201'` — usa `expect.objectContaining`,
así que no necesita cambios de contenido, pero confirma que sigue pasando tras el Step 6.

- [ ] **Step 9: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- l10.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 10: Corre typecheck**

Run: `npm run typecheck --prefix server`
Expected: 0 errores.

- [ ] **Step 11: NO comitear**

---

### Task 7: Auditoría en `TodoRepository` + `routes/todos.ts`

**Files:**
- Modify: `server/src/repositories/TodoRepository.ts`
- Modify: `server/src/repositories/TodoRepository.test.ts`
- Modify: `server/src/routes/todos.ts`
- Modify: `server/src/routes/todos.test.ts`

**Interfaces:**
- Consumes: los campos `createdByUserId`/`updatedByUserId` del modelo `Todo` (Task 1).
- Produces: `TodoRepository.create(data, createdByUserId)`, `TodoRepository.update(id, data, updatedByUserId)` — firma nueva.

**Nota importante sobre `todos.test.ts` — mismo problema que `issues.test.ts`/`l10.test.ts` (Tasks
3 y 6).** Mockea `TodoRepository` entera y mockea `requireTenant` sin fijar `request.user`. Arregla
el mock igual que en las tareas anteriores.

- [ ] **Step 1: Actualiza el factory `makeTodo()` para incluir los campos nuevos**

En `server/src/repositories/TodoRepository.test.ts`, reemplaza:
```typescript
function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    tenantId: TENANT_A,
    title: 'Enviar propuesta a cliente X',
    ownerUserId: 'user-1',
    dueDate: null,
    status: 'open',
    originatingMeetingId: null,
    ...overrides,
  };
}
```
por:
```typescript
function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    tenantId: TENANT_A,
    title: 'Enviar propuesta a cliente X',
    ownerUserId: 'user-1',
    dueDate: null,
    status: 'open',
    originatingMeetingId: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    createdByUserId: null,
    updatedByUserId: null,
    ...overrides,
  };
}
```

- [ ] **Step 2: Arregla las 4 llamadas a `repo.create`/`repo.update` ya existentes**

Reemplaza:
```typescript
  describe('create', () => {
    it('injects tenantId', async () => {
      vi.mocked(prisma.todo.create).mockResolvedValue(makeTodo());
      const repo = new TodoRepository(TENANT_A);

      await repo.create({ title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1' });

      expect(prisma.todo.create).toHaveBeenCalledWith({
        data: { title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1', tenantId: TENANT_A },
      });
    });

    it('passes through dueDate and originatingMeetingId when provided', async () => {
      vi.mocked(prisma.todo.create).mockResolvedValue(makeTodo());
      const repo = new TodoRepository(TENANT_A);
      const dueDate = new Date('2026-08-01T00:00:00.000Z');

      await repo.create({ title: 'x', ownerUserId: 'user-1', dueDate, originatingMeetingId: 'meeting-1' });

      expect(prisma.todo.create).toHaveBeenCalledWith({
        data: { title: 'x', ownerUserId: 'user-1', dueDate, originatingMeetingId: 'meeting-1', tenantId: TENANT_A },
      });
    });
  });

  describe('update', () => {
    it('returns null when no row matches id+tenantId', async () => {
      vi.mocked(prisma.todo.updateMany).mockResolvedValue({ count: 0 });
      const repo = new TodoRepository(TENANT_A);

      const result = await repo.update('missing', { status: 'done' });

      expect(result).toBeNull();
    });

    it('updates the matching row scoped to tenantId', async () => {
      vi.mocked(prisma.todo.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.todo.findFirst).mockResolvedValue(makeTodo({ status: 'done' }));
      const repo = new TodoRepository(TENANT_A);

      await repo.update('todo-1', { status: 'done' });

      expect(prisma.todo.updateMany).toHaveBeenCalledWith({
        where: { id: 'todo-1', tenantId: TENANT_A },
        data: { status: 'done' },
      });
    });
  });
```
por:
```typescript
  describe('create', () => {
    it('injects tenantId', async () => {
      vi.mocked(prisma.todo.create).mockResolvedValue(makeTodo());
      const repo = new TodoRepository(TENANT_A);

      await repo.create({ title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1' }, 'user-1');

      expect(prisma.todo.create).toHaveBeenCalledWith({
        data: {
          title: 'Enviar propuesta a cliente X',
          ownerUserId: 'user-1',
          tenantId: TENANT_A,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      });
    });

    it('passes through dueDate and originatingMeetingId when provided', async () => {
      vi.mocked(prisma.todo.create).mockResolvedValue(makeTodo());
      const repo = new TodoRepository(TENANT_A);
      const dueDate = new Date('2026-08-01T00:00:00.000Z');

      await repo.create(
        { title: 'x', ownerUserId: 'user-1', dueDate, originatingMeetingId: 'meeting-1' },
        'user-1'
      );

      expect(prisma.todo.create).toHaveBeenCalledWith({
        data: {
          title: 'x',
          ownerUserId: 'user-1',
          dueDate,
          originatingMeetingId: 'meeting-1',
          tenantId: TENANT_A,
          createdByUserId: 'user-1',
          updatedByUserId: 'user-1',
        },
      });
    });
  });

  describe('update', () => {
    it('returns null when no row matches id+tenantId', async () => {
      vi.mocked(prisma.todo.updateMany).mockResolvedValue({ count: 0 });
      const repo = new TodoRepository(TENANT_A);

      const result = await repo.update('missing', { status: 'done' }, 'user-1');

      expect(result).toBeNull();
    });

    it('updates the matching row scoped to tenantId', async () => {
      vi.mocked(prisma.todo.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.todo.findFirst).mockResolvedValue(makeTodo({ status: 'done' }));
      const repo = new TodoRepository(TENANT_A);

      await repo.update('todo-1', { status: 'done' }, 'user-1');

      expect(prisma.todo.updateMany).toHaveBeenCalledWith({
        where: { id: 'todo-1', tenantId: TENANT_A },
        data: { status: 'done', updatedByUserId: 'user-1' },
      });
    });
  });
```

- [ ] **Step 3: Corre el test para verificar que falla**

Run: `npm test --prefix server -- TodoRepository.test.ts`
Expected: FAIL hasta el Step 4.

- [ ] **Step 4: Implementa el cambio**

En `server/src/repositories/TodoRepository.ts`, reemplaza:
```typescript
  create(data: CreateTodoInput): Promise<Todo> {
    return prisma.todo.create({ data: { ...data, tenantId: this.tenantId } });
  }

  async update(id: string, data: UpdateTodoInput): Promise<Todo | null> {
    const result = await prisma.todo.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```
por:
```typescript
  create(data: CreateTodoInput, createdByUserId: string): Promise<Todo> {
    return prisma.todo.create({
      data: { ...data, tenantId: this.tenantId, createdByUserId, updatedByUserId: createdByUserId },
    });
  }

  async update(id: string, data: UpdateTodoInput, updatedByUserId: string): Promise<Todo | null> {
    const result = await prisma.todo.updateMany({
      where: { id, tenantId: this.tenantId },
      data: { ...data, updatedByUserId },
    });
    if (result.count === 0) return null;
    return this.findById(id);
  }
```

- [ ] **Step 5: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- TodoRepository.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 6: Actualiza la ruta**

En `server/src/routes/todos.ts`, reemplaza:
```typescript
  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createTodoSchema.parse(request.body);
    const repo = new TodoRepository(request.tenantId as string);
    const todo = await repo.create(body);
    return reply.code(201).send(todo);
  });
```
por:
```typescript
  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createTodoSchema.parse(request.body);
    const repo = new TodoRepository(request.tenantId as string);
    const todo = await repo.create(body, request.user.userId);
    return reply.code(201).send(todo);
  });
```
Y reemplaza:
```typescript
  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTodoSchema.parse(request.body);
    const repo = new TodoRepository(request.tenantId as string);
    const todo = await repo.update(id, body);
    if (!todo) return reply.code(404).send({ error: 'Todo not found' });
    return todo;
  });
```
por:
```typescript
  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTodoSchema.parse(request.body);
    const repo = new TodoRepository(request.tenantId as string);
    const todo = await repo.update(id, body, request.user.userId);
    if (!todo) return reply.code(404).send({ error: 'Todo not found' });
    return todo;
  });
```

- [ ] **Step 7: Arregla el mock de `requireTenant` en `todos.test.ts`**

Reemplaza:
```typescript
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string }) => {
      request.tenantId = 'tenant-a';
    },
  ],
}));
```
por:
```typescript
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string; user?: { userId: string } }) => {
      request.user = { userId: 'user-1' };
      request.tenantId = 'tenant-a';
    },
  ],
}));
```

- [ ] **Step 8: Arregla las 2 aserciones exactas que ya existen en `todos.test.ts` y se romperán**

Reemplaza:
```typescript
  it('POST /todos creates a todo and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: { title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1' },
    });
    expect(res.statusCode).toBe(201);
    expect(repoMock.create).toHaveBeenCalledWith({ title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1' });
  });
```
por:
```typescript
  it('POST /todos creates a todo and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: { title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1' },
    });
    expect(res.statusCode).toBe(201);
    expect(repoMock.create).toHaveBeenCalledWith(
      { title: 'Enviar propuesta a cliente X', ownerUserId: 'user-1' },
      'user-1'
    );
  });
```
Y reemplaza:
```typescript
  it('PATCH /todos/:id updates and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/todos/todo-1', payload: { status: 'done' } });
    expect(res.statusCode).toBe(200);
    expect(repoMock.update).toHaveBeenCalledWith('todo-1', { status: 'done' });
  });
```
por:
```typescript
  it('PATCH /todos/:id updates and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/todos/todo-1', payload: { status: 'done' } });
    expect(res.statusCode).toBe(200);
    expect(repoMock.update).toHaveBeenCalledWith('todo-1', { status: 'done' }, 'user-1');
  });
```
El test `'POST /todos accepts an optional originatingMeetingId'` usa `expect.objectContaining`,
no necesita cambios de contenido — confirma que sigue pasando tras el Step 6.

- [ ] **Step 9: Corre el test para verificar que pasa**

Run: `npm test --prefix server -- todos.test.ts`
Expected: PASS, todos los tests.

- [ ] **Step 10: Corre typecheck**

Run: `npm run typecheck --prefix server`
Expected: 0 errores.

- [ ] **Step 11 (Task 7): NO comitear**

---

### Task 8: `eslint-plugin-react-hooks`

**Files:**
- Modify: `front/package.json` (dependencia nueva)
- Modify: `front/eslint.config.js`

**Interfaces:** ninguna — tarea autocontenida, no la consume ninguna otra tarea de este plan.

**Contexto:** hallazgo de la revisión final de Sprint 5 (Task 10): `front/eslint.config.js` no
tiene ningún plugin de React en absoluto (ni `eslint-plugin-react`, ni `eslint-plugin-react-hooks`),
así que la regla de "Rules of Hooks" (hooks siempre incondicionales, nunca detrás de un early
return) depende solo de la revisión manual — y este proyecto ya envió una regresión Critical de
exactamente esa clase de bug en Sprint 2. Esta tarea añade `eslint-plugin-react-hooks`, que sí
convierte esa comprobación en un gate automático de `npm run lint`.

- [ ] **Step 1: Instala la dependencia**

Run (desde la raíz del repo):
```bash
npm install --prefix front eslint-plugin-react-hooks@^5 --save-dev
```
Expected: se añade a `front/package.json` (`devDependencies`) y `front/package-lock.json` se
actualiza.

- [ ] **Step 2: Activa el plugin en `eslint.config.js`**

En `front/eslint.config.js`, reemplaza:
```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  }
);
```
por:
```javascript
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs['recommended-latest'],
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  }
);
```

- [ ] **Step 3: Corre lint sobre todo el frontend**

Run: `npm run lint --prefix front`

Expected: dos escenarios posibles —
1. **0 errores nuevos** (además del error preexistente ya conocido de `vite.config.ts`, triple-slash-reference, ajeno a este plugin) — el código de los 6 sprints anteriores ya respetaba Rules of Hooks en la práctica, el plugin solo lo confirma. Continúa al Step 4.
2. **Aparecen errores `react-hooks/rules-of-hooks` o `react-hooks/exhaustive-deps` reales** — investiga cada uno antes de tocar nada: lee el componente señalado, entiende si es una violación genuina (hook condicional/en loop — bug real, hay que arreglar el componente) o un falso positivo del plugin con las dependencias del proyecto (menos probable, pero si pasa, documenta el caso exacto en `hardening.README.md`, Task 11, en vez de silenciar la regla con un `eslint-disable` sin más). No hagas `eslint-disable` a la ligera — el objetivo entero de esta tarea es que estas reglas SÍ bloqueen.

- [ ] **Step 4: Corre la suite completa de frontend para confirmar que nada se rompió**

Run: `npm test --prefix front -- --run`
Expected: mismos resultados que antes de esta tarea (el plugin de lint no afecta el comportamiento en tiempo de ejecución, solo el análisis estático).

- [ ] **Step 5: NO comitear**

---

### Task 9: Artefactos de RLS (preparados, sin activar)

**Files:**
- Create: `server/prisma/rls/enable-rls.sql` (migración SQL de referencia, NO se ejecuta contra ninguna base de datos en esta tarea)
- Create: `server/src/lib/tenantPrisma.ts` (wrapper de Prisma listo para usar, NO se conecta desde ningún repositorio existente en esta tarea)
- Create: `server/src/lib/tenantPrisma.test.ts`

**Interfaces:**
- Produces: `forTenant(tenantId: string)` — factory que envuelve el `PrismaClient` compartido para
  fijar `app.current_tenant` antes de cada query. NINGÚN repositorio existente lo importa ni lo usa
  todavía — ver Decisión de diseño #2 del plan. Queda como artefacto listo para una activación
  futura, deliberada y con acceso a un Postgres real.

- [ ] **Step 1: Escribe la migración SQL de referencia**

Crea `server/prisma/rls/enable-rls.sql` (fuera de `server/prisma/migrations/` a propósito — así
Prisma Migrate no la detecta ni la aplica automáticamente en ningún `migrate dev`/`migrate deploy`
futuro; aplicarla es un paso manual y deliberado):

```sql
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

ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON seats
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE rocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rocks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rocks
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON milestones
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE scorecard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_metrics FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON scorecard_metrics
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE scorecard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON scorecard_entries
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE l10_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_meetings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON l10_meetings
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE l10_agenda_item_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_agenda_item_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON l10_agenda_item_logs
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON issues
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON todos
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE vto_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vto_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vto_documents
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_memberships
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 'tenants' y 'users' quedan fuera a propósito: 'tenants' es la tabla raíz (no tiene
-- tenant_id propio) y 'users' es global (un usuario pertenece a 0+ tenants vía
-- tenant_memberships, la fila de 'users' en sí no es de un tenant concreto).

-- Verificación tras aplicar (ejecutar como el rol que usa la app, sin fijar
-- app.current_tenant, para confirmar que efectivamente devuelve 0 filas):
--   SELECT count(*) FROM rocks; -- debe dar 0 sin app.current_tenant fijado
--   SELECT set_config('app.current_tenant', '<uuid-real-de-un-tenant>', false);
--   SELECT count(*) FROM rocks; -- debe dar >0 si ese tenant tiene rocks
```

- [ ] **Step 2: Escribe el wrapper `forTenant()` de Prisma**

Crea `server/src/lib/tenantPrisma.ts`:
```typescript
import { prisma } from './prisma.js';

/**
 * Cliente de Prisma con RLS: fija `app.current_tenant` en la misma conexión que la query
 * siguiente (mismo patrón que el cookbook oficial de Prisma para RLS — un `$transaction`
 * en modo array garantiza que ambas queries del array se ejecutan en la misma conexión).
 *
 * NO USAR TODAVÍA — ningún repositorio importa esto. Ver
 * docs/superpowers/plans/2026-08-01-sprint7-hardening.md, "Decisiones de diseño", punto 2,
 * y server/prisma/rls/enable-rls.sql antes de conectarlo a un repositorio real.
 */
export function forTenant(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}
```

- [ ] **Step 3: Escribe un test que confirme que el wrapper fija la variable de sesión antes de la query**

Crea `server/src/lib/tenantPrisma.test.ts`:
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./prisma.js', () => ({
  prisma: {
    $extends: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

describe('forTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps every operation in a $transaction that sets app.current_tenant first', async () => {
    const { prisma } = await import('./prisma.js');
    let capturedAllOperations: ((ctx: { args: unknown; query: (args: unknown) => unknown }) => unknown) | undefined;
    vi.mocked(prisma.$extends).mockImplementation((config: unknown) => {
      capturedAllOperations = (
        config as { query: { $allModels: { $allOperations: typeof capturedAllOperations } } }
      ).query.$allModels.$allOperations;
      return prisma as never;
    });
    vi.mocked(prisma.$transaction).mockResolvedValue([undefined, { id: 'rock-1' }]);

    const { forTenant } = await import('./tenantPrisma.js');
    forTenant('tenant-1');

    expect(capturedAllOperations).toBeDefined();
    const fakeQuery = vi.fn().mockReturnValue('the-query-promise');
    const result = await capturedAllOperations!({ args: { where: { id: 'rock-1' } }, query: fakeQuery });

    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.anything(),
      'the-query-promise',
    ]);
    expect(fakeQuery).toHaveBeenCalledWith({ where: { id: 'rock-1' } });
    expect(result).toEqual({ id: 'rock-1' });
  });
});
```

- [ ] **Step 4: Corre el test**

Run: `npm test --prefix server -- tenantPrisma.test.ts`
Expected: PASS. Este test verifica la MECÁNICA del wrapper (que envuelve en `$transaction`, que
fija la variable antes, que delega a la query real) — no verifica RLS de verdad, eso requiere un
Postgres real con las políticas del Step 1 ya aplicadas, fuera del alcance de esta tarea.

- [ ] **Step 5: Corre typecheck**

Run: `npm run typecheck --prefix server`
Expected: 0 errores.

- [ ] **Step 6: NO comitear ni conectar este código a ningún repositorio existente**

Esta tarea termina aquí — `forTenant()` y `enable-rls.sql` quedan como artefactos documentados,
sin activar. No modifiques `RockRepository.ts` ni ningún otro repositorio para usar `forTenant()`.

---

### Task 10: Script de backup + servicio en `docker-compose.yml`

**Files:**
- Create: `scripts/backup-db.sh`
- Modify: `docker-compose.yml`

**Interfaces:** ninguna — tarea autocontenida.

- [ ] **Step 1: Escribe el script de backup**

Crea `scripts/backup-db.sh`:
```bash
#!/usr/bin/env sh
# Vuelca la base de datos de producción a un archivo comprimido con fecha en el nombre.
# Uso: ./backup-db.sh [directorio-destino]  (por defecto: /backups, el volumen del servicio backup)
set -eu

DEST_DIR="${1:-/backups}"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST_FILE="${DEST_DIR}/eos-tool-${TIMESTAMP}.sql.gz"

mkdir -p "${DEST_DIR}"

pg_dump "${DATABASE_URL}" | gzip > "${DEST_FILE}"

echo "Backup escrito en ${DEST_FILE}"

# Retención: borra backups de más de 14 días para no llenar el volumen sin límite.
find "${DEST_DIR}" -name 'eos-tool-*.sql.gz' -mtime +14 -delete
```

- [ ] **Step 2: Dale permisos de ejecución**

Run: `chmod +x scripts/backup-db.sh`

- [ ] **Step 3: Añade el servicio `backup` a `docker-compose.yml`**

Lee primero `docker-compose.yml` completo para copiar el estilo exacto (nombres de servicios,
indentación, cómo se referencia `DATABASE_URL`/la red interna) ya usado por los servicios
`postgres`/`migrate`/`server` — no inventes una convención nueva. Añade un servicio nuevo `backup`
que:
- Usa la imagen oficial `postgres:<misma-versión-mayor-que-el-servicio-postgres-existente>` (así
  `pg_dump` es compatible con la versión del servidor — revisa la versión exacta que ya usa el
  servicio `postgres` de este archivo y reutilízala, no asumas una versión).
- Monta `./scripts/backup-db.sh:/backup-db.sh:ro` y un volumen nombrado nuevo `backup_data:/backups`.
- Recibe `DATABASE_URL` apuntando al servicio `postgres` interno (mismo patrón que ya usa `migrate`/
  `server` en este archivo).
- `depends_on: postgres: condition: service_healthy` (o el equivalente que ya use `migrate` en este
  archivo — cópialo).
- `entrypoint`: un cron simple dentro del contenedor que corre `/backup-db.sh` una vez al día. La
  imagen oficial de `postgres` no trae `cron` instalado — la forma más simple sin añadir un paquete
  nuevo a la imagen es un `entrypoint` en shell con un bucle `while true; do /backup-db.sh; sleep 86400; done`,
  documentado con un comentario explicando que es deliberadamente simple (no un cron real) y que
  hace el primer backup inmediatamente al arrancar el contenedor, no a medianoche.
- Añade `backup_data:` a la sección `volumes:` de nivel superior del archivo, junto a los volúmenes
  ya existentes (revisa cómo se llaman los volúmenes de `postgres`/`server` ya definidos y sigue el
  mismo estilo de nombres).

No toques ningún otro servicio existente del archivo.

- [ ] **Step 4: Verifica que el compose sigue siendo válido**

Run: `docker compose -f docker-compose.yml config` (si Docker está disponible en el entorno; si no
lo está, revisa manualmente el YAML resultante con mucho cuidado — indentación de 2 espacios
consistente con el resto del archivo, sin duplicar claves de nivel superior).
Expected: sin errores de parseo, el servicio `backup` aparece en la salida.

- [ ] **Step 5: NO comitear**

---

### Task 11: `hardening.README.md`

**Files:**
- Create: `server/src/routes/hardening.README.md` (no es un módulo de rutas — se ubica junto a los
  demás README de módulo por convención del proyecto, aunque esta "funcionalidad" vive repartida
  entre schema, scripts y docker-compose, no en un `routes/*.ts` propio)

- [ ] **Step 1: Escribe el README**

```markdown
# Hardening (Sprint 7)

## Qué hace

Cuatro mejoras de aislamiento multitenant y operación, sin nueva superficie de API:

### 1. Auditoría (`createdByUserId`/`updatedByUserId`)

`Rock`, `Issue`, `Seat`, `ScorecardMetric`, `L10Meeting` y `Todo` llevan ahora `createdByUserId`,
`updatedByUserId`, `createdAt` y `updatedAt` (nullable, no rompen filas ya existentes). Se rellenan
siempre desde `request.user.userId` en la capa de ruta, nunca desde el body del cliente — los
schemas Zod de creación/actualización no los declaran, así que Zod los descarta si el cliente
intenta mandarlos.

Tablas excluidas deliberadamente (ver `docs/superpowers/plans/2026-08-01-sprint7-hardening.md`,
"Decisiones de diseño"): `Milestone`/`L10AgendaItemLog` (sub-registros, no tablas clave),
`ScorecardEntry` (ya tenía `enteredByUserId`/`enteredAt`), `VTODocument` (ya tenía
`updatedByUserId`/`updatedAt`).

### 2. Row-Level Security — preparado, sin activar

`server/prisma/rls/enable-rls.sql` (política `tenant_isolation` + `FORCE ROW LEVEL SECURITY` por
tabla de negocio) y `server/src/lib/tenantPrisma.ts` (`forTenant(tenantId)`, wrapper de Prisma que
fija `app.current_tenant` vía `$transaction` en modo array antes de cada query) están escritos y
testeados a nivel de mecánica, pero **ningún repositorio los usa todavía** y el SQL no se ha
ejecutado contra ninguna base de datos. Activarlo de verdad requiere: (1) conectar `forTenant()` en
las ~12 clases de repositorio (sustituir el `prisma` importado por `forTenant(this.tenantId)` en
cada una), y (2) aplicar `enable-rls.sql` manualmente contra la base de datos real, verificando
después con las queries de comprobación que trae el propio archivo (sección final, comentada) que
el rol que usa `DATABASE_URL` efectivamente ve 0 filas sin `app.current_tenant` fijado. Se decidió
no automatizar esto en Sprint 7 porque un fallo de configuración (falta el `FORCE`, o la variable de
sesión no se propaga bien) puede tumbar la app entera o dar una falsa sensación de seguridad — se
prefirió dejarlo listo para activar con calma, con acceso a un Postgres real, en vez de activarlo a
ciegas.

### 3. Backups

`scripts/backup-db.sh` hace `pg_dump | gzip` con fecha en el nombre y borra backups de más de 14
días. El servicio `backup` en `docker-compose.yml` lo corre una vez al día dentro de un volumen
`backup_data` dedicado. Restaurar un backup:
```bash
gunzip -c /backups/eos-tool-<timestamp>.sql.gz | psql "$DATABASE_URL"
```
**Pendiente del usuario:** la prueba real de restauración (crear un backup con datos reales, tirar
la BD, restaurar, verificar que la app funciona igual) requiere el VPS desplegado — no se ha hecho
en este sprint, mismo patrón que la verificación manual de aislamiento multitenant que arrastran
todos los sprints anteriores.

### 4. Tenant switcher

Ya estaba completo desde Sprint 0 (`front/src/components/TenantSwitcher.tsx`) — se confirmó en
este sprint que cubre el caso de un usuario en 2+ tenants sin necesitar ningún cambio.

### 5. `eslint-plugin-react-hooks`

Activado en `front/eslint.config.js` — `npm run lint --prefix front` ahora falla si algún
componente viola las Rules of Hooks (hooks condicionales, en loops, o después de un `return`
temprano), en vez de depender solo de la revisión manual como en los Sprints 1-6.

## Cómo probarlo manualmente

```bash
# Confirmar que el body del cliente no puede suplantar el usuario de auditoría:
curl -X POST http://localhost/api/rocks \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: <tenantId>" \
  -H "Content-Type: application/json" \
  -d '{"title":"x","ownerUserId":"<userId>","quarter":"2026-Q3","isCompanyRock":false,"dueDate":"2026-09-30","createdByUserId":"otro-usuario"}'
# El rock creado debe tener createdByUserId = tu propio userId del JWT, no "otro-usuario".
```
```

- [ ] **Step 2: NO comitear**

---

### Task 12: Verificación final

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Typecheck, lint y tests completos**

Run: `npm run typecheck && npm run lint && npm test`
Expected: sin errores nuevos (el único error de lint preexistente, `vite.config.ts`
triple-slash-reference, sigue ahí, ajeno a este sprint). Todos los tests en verde.

- [ ] **Step 2: Corre el seed contra tu base local una vez más, de principio a fin**

Run: (borra tu base local de desarrollo y recréala si quieres una comprobación limpia, o confía en
la idempotencia ya probada del seed) `npm run migrate:deploy --prefix server && npm run seed --prefix server`
Expected: sin errores. Confirma manualmente en un cliente de Postgres (o Prisma Studio:
`npx prisma studio --prefix server`) que las filas de `rocks`/`issues`/`seats`/`scorecard_metrics`/
`l10_meetings` sembradas tienen `created_by_user_id`/`updated_by_user_id` rellenos con el id del
usuario owner — no `NULL`.

- [ ] **Step 3: Verificación manual de aislamiento multitenant**

Mismo patrón que todos los sprints anteriores: con las seeds de Tasvalor/Cionet, confirma que un
Rock/Issue/Seat/Metric/Meeting/Todo creado en un tenant no es visible ni editable desde el otro.

- [ ] **Step 4: Revisa el estado final de git**

Run: `git status --porcelain`
Expected: todos los cambios de este sprint presentes (staged o no), CERO commits nuevos creados por
ningún agente durante Sprint 7 — verifica con `git log --oneline -15` que el HEAD sigue siendo el
mismo commit real de antes de empezar Sprint 7 (o, si Sprint 6 aún no se ha comiteado, el mismo que
al cerrar Sprint 6). Si ves algún commit nuevo no autorizado, repórtalo — sería un incumplimiento de
la regla de este sprint.
