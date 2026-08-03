# EOS Tool — Roadmap Sprints 1-7

> Este documento NO es un plan bite-sized ejecutable por un subagente. Es el
> mapa de todos los sprints restantes, a nivel de tareas, para tener visión de
> conjunto y como fuente al redactar el plan bite-sized de cada sprint justo
> antes de arrancarlo (ver `superpowers:writing-plans`). Cuando un sprint vaya
> a ejecutarse, se genera su propio plan en
> `docs/superpowers/plans/YYYY-MM-DD-sprintN-<nombre>.md` con pasos TDD
> completos — no se ejecuta directamente desde aquí.

**Estado (actualizado 2026-07-31):**
- Sprint 0 (Fundación) — ✅ hecho y verificado end-to-end (login real, migración aplicada, seed corrido).
- Sprint 1 (Accountability Chart) — 🔄 en curso, en otra sesión/orden ya dada, en paralelo sobre el mismo working tree. Este roadmap no lo detalla; se coordina aparte. Añadió `requireTenant(app)` (helper compartido en `middleware/resolveTenantContext.ts`) y `TenantMembership.isActive`, ambos ya adoptados por Sprint 2 y 3.
- Sprint 2 (Rocks) — ✅ hecho: 12 tareas + revisión final de rama completa + su ronda de fixes + 1 fix adicional del controller (bug de Rules of Hooks introducido por esa misma ronda). Backend 66/66 tests, frontend 43/43 tests, typecheck/lint limpios en ambos. Detalle completo en `docs/superpowers/plans/2026-07-30-sprint2-rocks.md` y el ledger `.superpowers/sdd/2026-07-30-sprint2-rocks/progress.md`. Pendiente del usuario: verificación manual en vivo de aislamiento multitenant (Tasvalor vs. Cionet) — no delegable, requiere credenciales reales de la DB de desarrollo.
- Sprint 3 (Scorecard) — ✅ hecho: 10 tareas + revisión final de rama completa (opus) + 1 ronda de fixes consolidada (3 Important: input no controlado que ocultaba valores guardados, incumplimiento del design brief en la grid, métricas desactivadas quedaban inalcanzables; + 1 test de regresión del bug `isActive=false` ya arreglado en Task 3) + re-review escopada en PASS. Recharts confirmado y añadido como dependencia para el mini-gráfico de tendencia. Backend 85/85 tests, frontend 102/102 tests (tras el fix wave), typecheck/lint limpios en ambos. Detalle completo en `docs/superpowers/plans/2026-07-31-sprint3-scorecard.md` y el ledger `.superpowers/sdd/2026-07-31-sprint3-scorecard/progress.md`. Pendiente del usuario: misma verificación manual de aislamiento multitenant que Sprint 2.
- Sprint 4 (Issues/IDS) — ✅ hecho: 9 tareas (incluye una migración Prisma real, `sortOrder Int` en `Issue`, aplicada por el controlador) + revisión final de rama completa (opus) + 1 ronda de fixes consolidada (2 Important: reordenar con un filtro de estado activo corrompía el `sortOrder` global del tenant, la fila placeholder de tabla vacía quedaba marcada como "arrastrándose" permanentemente por un `useSortable({id: undefined})`; + 2 Minor agrupados: `resolvedAt` se re-sellaba en cada guardado aunque no hubiera transición real de estado, más la corrección del README) + re-review escopada en PASS. `@dnd-kit` confirmado e instalado para el drag-to-reorder; sin máquina de estados en las transiciones de `status` (YAGNI, igual que Rocks). Backend 140/140 tests (99.14% stmts), frontend 127/127 tests (94.73% stmts) antes del fix wave, typecheck/lint limpios en ambos. Detalle completo en `docs/superpowers/plans/2026-07-31-sprint4-issues.md` y el ledger `.superpowers/sdd/2026-07-31-sprint4-issues/progress.md`. Pendiente del usuario: misma verificación manual de aislamiento multitenant que Sprints 2-3.
- Sprint 5 (L10 Meetings) — ✅ hecho: 12 tareas (`Todo` estrenó repositorio/rutas propias en este sprint, sin página `/todos` independiente por YAGNI) + revisión final de rama completa (opus) + 1 ronda de fixes consolidada (4 Important: las notas de discusión de agenda eran de solo escritura y nunca se mostraban, la sección To-Do List no permitía completar/editar un to-do pese a que `TodoFormModal` ya lo soportaba, la sección Conclude no recordaba el rating/notas de una reunión ya cerrada y dejaba el botón de cerrar activo, cobertura de `L10LiveMeetingPage.tsx` insuficiente en las secciones con datos reales; + 2 Minor agrupados: ventana de 1 semana en Scorecard ocultaba casi siempre las métricas mensuales, aserción débil en el test de crear reunión) + re-review escopada en PASS. Sesión concurrente de Accountability Chart refactorizó `AppLayout`/`App.tsx` a patrón layout-route (`<Outlet/>`) durante este sprint — verificado por la revisión final como semánticamente correcto, aceptado tal cual. Vista en vivo con las 7 secciones clásicas de la agenda EOS, timer local por sección (`AgendaSection`, sin persistencia), Rock Review/IDS componen `rocksApi`/`issuesApi` ya existentes en vez de duplicar esas vistas. Backend 185/185 tests (99.3% stmts), frontend 155/155 tests tras el fix wave (`L10LiveMeetingPage.tsx` subió de 62.78%/33.33% a 80.9%/57.57% stmts/funcs), typecheck/lint limpios en ambos. Detalle completo en `docs/superpowers/plans/2026-07-31-sprint5-l10.md` y el ledger `.superpowers/sdd/2026-07-31-sprint5-l10/progress.md`. Pendiente del usuario: misma verificación manual de aislamiento multitenant que Sprints 2-4.
- Sprint 6 (V/TO) — ✅ hecho: 13 tareas + revisión final de rama completa (opus) + 1 ronda de fixes consolidada (1 Critical: `VTOPage` no recargaba al cambiar de tenant activo — fuga de datos entre tenants real, la única página del proyecto sin `activeTenantId` en las deps de su refetch; 1 Important: guardar una sección del V/TO borraba en silencio cambios sin guardar en otra pestaña, por un `useEffect` de resync dependiendo de la referencia completa del documento en vez del contenido de su propia sección; + 6 Minor agrupados) + re-review escopada en PASS. Decisiones de diseño propias (documentadas en el plan): el "1-Year Plan" enlaza Rocks reales (`companyRockIds`) en vez de texto libre, vista imprimible por CSS `@media print` del navegador sin librería de PDF nueva. **Corrección de proceso a mitad de sprint:** Tasks 1-9 se comitearon con `git commit` real por error (viola la regla permanente "el usuario comitea siempre"); un implementer reanudado en Task 10 lo detectó y se negó a comitear — desde Task 10 en adelante (y para Sprint 7) ningún agente comitea, todo queda en el working tree/staged para que el usuario decida. Backend 192/192 tests (VTORepository.ts/vto.ts 100% cobertura), frontend 179/179 tests tras el fix wave (components/vto 99.67% stmts/100% funcs), typecheck limpio en ambos, lint limpio salvo 1 error preexistente ajeno (front/vite.config.ts). Detalle completo en `docs/superpowers/plans/2026-07-31-sprint6-vto.md` y el ledger `.superpowers/sdd/2026-07-31-sprint6-vto/progress.md`. Pendiente del usuario: misma verificación manual de aislamiento multitenant que Sprints 2-5, más comitear todo el trabajo de este sprint (está staged, no comiteado) y verificar visualmente la vista de impresión en un navegador real.
- Sprint 7 — 📋 planificado aquí a nivel de tareas; se detalla bite-sized justo antes de arrancar.

---

## 0. Qué ya existe y que todo sprint debe reutilizar (no reinventar)

Esto viene de auditar el código real tras Sprint 0, no son suposiciones:

**Backend** (`server/src/`)
- `lib/prisma.ts` — singleton `PrismaClient`.
- `lib/jwt.ts`, `plugins/jwt.ts` — `app.authenticate` preHandler (decorador Fastify), 401 si falta/inválido el Bearer token.
- `middleware/resolveTenantContext.ts` — preHandler que exige header `X-Tenant-Id`, valida `TenantMembership` fresco en DB, inyecta `request.tenantId` + `request.userRole`. **Todo route de negocio nuevo registra `app.authenticate` + `resolveTenantContext` como preHandlers**, en ese orden.
- `app.ts` tiene un `setErrorHandler` global: `ZodError` → 400 con los mensajes de validación; errores con `statusCode < 500` pasan tal cual; todo lo demás → 500 genérico (nunca se filtran mensajes internos de Prisma al cliente). Los routes nuevos **no necesitan try/catch propio** para errores de validación Zod — basta con `schema.parse(request.body)` y dejar que el error suba.
- El **schema Prisma completo de los 6 módulos MVP ya existe** (`server/prisma/schema.prisma`, migración `20260730181828_init` ya aplicada): `Rock`, `Milestone`, `ScorecardMetric`, `ScorecardEntry`, `L10Meeting`, `L10AgendaItemLog`, `Issue`, `Todo`, `VTODocument`, `Seat`. Ningún sprint 2-7 necesita migración nueva salvo que se descubra un campo que falte — si pasa, `npm run migrate:dev --prefix server -- --name X` (nunca contra el compose de prod, ver CLAUDE.md §3).
- `server/prisma/seed.ts` ya crea datos de ejemplo para Rock, ScorecardMetric/Entry, Issue (y sigue con Todo/L10/VTO más abajo en el archivo) para ambos tenants — no hace falta ampliarlo salvo que un sprint necesite un caso que hoy no está cubierto.
- Patrón de **repositorio tenant-aware** (CLAUDE.md §4) todavía no tiene un ejemplo real en el código (Sprint 0 fue solo auth). **Sprint 2 lo estrena** (`RockRepository`) — todos los sprints siguientes copian ese patrón literalmente: clase con `constructor(private tenantId: string)`, todo método inyecta `tenantId` en el `where`, updates/deletes usan `updateMany`/`deleteMany` con `{ id, tenantId }` en el `where` (evita 404 con excepción Prisma, devuelve `count === 0` → null/false).
- Testing: Vitest, Prisma mockeado con `vi.mock('../lib/prisma.js', () => ({ prisma: { modelo: { findMany: vi.fn(), ... } } }))` — nunca contra DB real en unit tests. Cobertura con `@vitest/coverage-v8`, umbrales en `server/vitest.config.ts` (`lines/functions/statements 80, branches 70`) — **cada sprint que añade `server/src/repositories/**` o cualquier carpeta nueva debe añadirla al array `coverage.include` de ese archivo**, si no la cobertura real queda fuera del reporte sin que ningún test falle.

**Frontend** (`front/src/`)
- `lib/apiClient.ts` — `apiFetch<T>(path, options)`: antepone `/api`, mete `Authorization` + `X-Tenant-Id` desde `useAuthStore`, lanza `ApiError` en `!response.ok`. **Ojo:** hoy asume que toda respuesta tiene body JSON (`response.json()` incondicional) — ningún endpoint hace 204 todavía. El primer sprint que añada un `DELETE` (Sprint 2) tiene que arreglar esto primero, o cualquier `apiFetch` a un 204 revienta.
- `store/authStore.ts` — Zustand + `persist`: `token`, `user`, `tenants`, `activeTenantId`. `apiClient` ya lee de aquí solo, ningún módulo nuevo necesita su propio store de sesión.
- `theme/glassTokens.ts` + `theme/glass.css` — `ConfigProvider` de AntD ya con los tokens glass (`colorBgContainer`, `colorBgElevated`, `colorBorder`, `borderRadius: 16`) y clase `.glass-panel` reutilizable. Ver `docs/DESIGN_BRIEF.md` para qué opacidad usar en cada módulo (ya tiene una sección "Aplicación por módulo" con una entrada por cada uno de los 6 módulos MVP).
- `App.tsx` — rutas con `react-router-dom` (`BrowserRouter`/`Routes`/`Route`), hoy solo `/login`, `/change-password`, `/dashboard`. **Sprint 2 extrae el header/nav de `DashboardPage` a un `AppLayout` compartido** (hoy el header con `TenantSwitcher`+`AvatarUploader`+logout vive hardcodeado dentro de `DashboardPage.tsx`) — todo módulo desde Sprint 2 en adelante monta su página dentro de `AppLayout` y añade su propia entrada al menú de navegación, en vez de reimplementar el header.
- Tests: Vitest + React Testing Library + `@testing-library/user-event`, `front/src/test/setup.ts` ya trae polyfills de `matchMedia` y `URL.createObjectURL` que AntD/inputs de archivo necesitan bajo jsdom. `apiFetch` se mockea con `vi.mock('../lib/apiClient', () => ({ apiFetch: vi.fn(), ApiError: class ... }))` en cada test de página.
- Módulo README: convención confirmada en `server/src/routes/auth.README.md` — cada módulo de negocio (backend) lleva un `<módulo>.README.md` junto al route, explicando endpoints y reglas, no narrando la implementación.

**Reglas de todo sprint (no repetir la decisión cada vez):**
- Nunca `prisma.<modelo>.findMany/create/update/delete` fuera de un repositorio (CLAUDE.md §4) — es bug de seguridad, no estilo.
- Sin ACL granular por rol dentro de un tenant salvo que el propio sprint lo mencione explícitamente (p.ej. Sprint 7 sí toca RLS). Herramienta interna de 2-10 personas por tenant, confían entre sí — no construir permisos que nadie pidió (YAGNI, CLAUDE.md — no añadir lo que no está en scope).
- Todo módulo lleva tests + cobertura + `.md` de funcionalidad — regla del usuario, no negociable.
- Diseño: seguir `docs/DESIGN_BRIEF.md`, usar `ui-ux-pro-max` skill para las vistas si está disponible en el entorno del implementador.
- Nadie hace `git commit` salvo el usuario — los pasos "Commit" de un plan describen lo que hace el controlador entre tareas (snapshot no destructivo vía `git stash create` + `git reset`), no una instrucción para el implementador.

---

## 1. Orden y dependencias entre sprints

```
Sprint 0 (hecho) ──► Sprint 1 (en curso, aparte) ──► Sprint 2 ──► Sprint 3 ──► Sprint 4
                                                         │
                                                         └─► Sprint 5 (usa Rocks+Issues) ──► Sprint 6 ──► Sprint 7
```

- **Sprint 2 (Rocks)** es el primero que puede arrancar ya (no depende de que Sprint 1 termine — Rocks solo necesita un `ownerUserId`, y ya hay un usuario owner seedeado en ambos tenants). Es el que fija el patrón de repositorio + CRUD + frontend que todos los siguientes copian, así que se detalla bite-sized ya (ver `2026-07-30-sprint2-rocks.md`).
- **Sprint 3 (Scorecard)** puede arrancar en paralelo a Sprint 1 igual, pero conviene ir en serie con Sprint 2 para no partir en dos el `AppLayout`/nav que Sprint 2 crea.
- **Sprint 4 (Issues)** — independiente de datos de otros módulos, CRUD simple.
- **Sprint 5 (L10 Meetings)** — referencia Rocks (rock review), Issues (IDS) y Todos por `id` genérico (`L10AgendaItemLog.referenceId`) — mejor después de que Sprint 2 y 4 existan, aunque el modelo ya soporta guardar la referencia sin FK fuerte (es un `String`, no una relación Prisma) así que técnicamente no bloquea.
- **Sprint 6 (V/TO)** — independiente, el modelo `VTODocument` ya está seedeado con datos básicos.
- **Sprint 7 (Hardening)** — depende de que 1-6 existan (RLS, auditoría, backups tocan todas las tablas).

## 2. Sprint 1 — Accountability Chart (en curso aparte, resumen para contexto)

No se detalla aquí porque ya tiene una orden dada en otra sesión. Contexto relevante para cuando se retome o se audite:
- Librería de organigrama decidida: **`@xyflow/react`** (no `antd-org-chart`, IMPLEMENTATION_PLAN.md quedó desactualizado en este punto — actualizarlo cuando Sprint 1 cierre).
- Modelo `Seat` ya existe (`parentSeatId` self-FK, `rolesAndResponsibilities` jsonb, `occupants: TenantMembership[]` vía `seatId` nullable en `TenantMembership`).
- Alcance IMPLEMENTATION_PLAN.md §5: CRUD de Seats (árbol), asignación de usuarios a seats, vista de organigrama, gestión de invitaciones (crear usuario + membership).
- **Nota para Sprint 2:** Sprint 2 necesita listar "miembros del tenant" para el selector de owner de un Rock. Si Sprint 1 ya expone un endpoint de miembros/invitaciones al terminar, Sprint 2's `GET /tenant/members` (ver su plan) puede quedar duplicado — revisar y fusionar en ese momento, no bloquear Sprint 2 esperando.

## 3. Sprint 2 — Rocks

**Detalle bite-sized completo:** `docs/superpowers/plans/2026-07-30-sprint2-rocks.md` (generado junto con este roadmap, listo para ejecutar).

Resumen de tareas (ver el plan para código real):
1. `GET /tenant/members` — desbloquea el selector de owner (mínimo, tenant-scoped).
2. `RockRepository` (+ añadir `src/repositories/**` a cobertura de Vitest).
3. `MilestoneRepository`.
4. `routes/rocks.ts` — CRUD Rock + sub-recurso Milestones, con `app.authenticate` + `resolveTenantContext`.
5. Registrar routes en `app.ts`.
6. Arreglar `apiFetch` para 204 No Content (primer DELETE del proyecto).
7. `rocksApi.ts` + `tenantApi.ts` (frontend, tipados).
8. Extraer `AppLayout` (header compartido) de `DashboardPage`.
9. `RocksBoard` — Kanban por estado (on_track/off_track/done), filtro trimestre+owner, `glass-panel` por tarjeta sobre el gradiente de fondo (`docs/DESIGN_BRIEF.md` §"Rocks").
10. `RockFormModal` — crear/editar Rock + milestones inline (añadir/marcar completado/borrar).
11. `rocks.README.md`.
12. Verificación final (typecheck/lint/test/coverage server+front, chequeo manual de aislamiento Tasvalor/Cionet).

## 4. Sprint 3 — Scorecard ✅ hecho

Detalle bite-sized completo: `docs/superpowers/plans/2026-07-31-sprint3-scorecard.md`.
Ledger: `.superpowers/sdd/2026-07-31-sprint3-scorecard/progress.md`.

Alcance IMPLEMENTATION_PLAN.md §5: CRUD `ScorecardMetric`, grid semanal (filas=métricas, columnas=semanas, celdas editables inline), cálculo automático "goal met/missed" según `comparison`, mini-gráfico de tendencia (últimas 12 semanas).

Desglose de tareas cuando se detalle bite-sized (justo antes de arrancar):
1. `ScorecardMetricRepository` — CRUD, `findAll({ isActive? })`.
2. `ScorecardEntryRepository` — `findAllForMetric(metricId, { fromDate, toDate })`, `upsertForPeriod(metricId, periodStart, actualValue)` (la grid es "editar celda", no crear entradas sueltas — usar el `@@unique([metricId, periodStart])` ya en el schema con `prisma.scorecardEntry.upsert`).
3. `routes/scorecard.ts` — `GET/POST/PATCH/DELETE /scorecard/metrics`, `GET /scorecard/metrics/:id/entries?weeks=12`, `PUT /scorecard/metrics/:id/entries/:periodStart` (upsert de una celda).
4. Función pura `evaluateGoal(actual, goal, comparison): 'met' | 'missed'` (fácil de unit-testear aislada, la usan tanto el backend si hace falta como la grid del frontend).
5. Frontend: `scorecardApi.ts`.
6. `ScorecardGrid` — tabla AntD con celdas editables inline (`InputNumber` on-blur-save), color verde/rojo por `evaluateGoal`, `--glass-bg-elevated` casi opaco en la tabla (DESIGN_BRIEF: "una tabla con blur pesado es ilegible").
7. Mini-gráfico de tendencia últimas 12 semanas — Recharts (nueva dependencia, no está instalada todavía — confirmar con el usuario antes de añadirla si no se ha decidido ya, IMPLEMENTATION_PLAN.md §5 la sugiere pero no está en el `package.json` actual).
8. Nav en `AppLayout` + ruta `/scorecard`.
9. `scorecard.README.md`.

Decisión ya tomada al detallar: Recharts confirmado e instalado (`front/package.json`).

## 5. Sprint 4 — Issues List (IDS) ✅ hecho

Detalle bite-sized completo: `docs/superpowers/plans/2026-07-31-sprint4-issues.md`.
Ledger: `.superpowers/sdd/2026-07-31-sprint4-issues/progress.md`.

Alcance: CRUD `Issue`, lista priorizable (drag to reorder), transición `open → discussing → solved` (y `dropped`).

Desglose:
1. `IssueRepository` — CRUD, `findAll({ status? })` ordenado.
2. Reordenar prioridad: el schema actual **no tiene campo de orden manual** (`priority` es el enum `low/medium/high`, no una posición). Si "drag to reorder" debe ser un orden libre independiente de `priority`, hace falta un campo nuevo (`sortOrder: Int` o similar) → **requiere migración Prisma**, decidir al detallar este sprint si el orden es solo por `priority` (sin campo nuevo, más simple) o un orden manual real.
3. `routes/issues.ts` — CRUD + `PATCH /issues/:id/status` (transición controlada: valida que el nuevo estado sea alcanzable desde el actual, p.ej. no saltar de `open` a `solved` sin pasar por `discussing`... **o no, aclarar el matiz EOS real (IDS permite resolver directo a veces) antes de codificar la máquina de estados** — no inventar una restricción que la metodología no pide).
4. Frontend: lista drag-and-drop (`@dnd-kit/sortable` u otra lib — ninguna instalada hoy, decidir).
5. `issues.README.md`.

Decisiones ya tomadas al detallar: campo de orden manual sí (`sortOrder Int`, migración
`20260731080939_issue_sort_order`); librería de drag-and-drop `@dnd-kit`; sin máquina de estados
en las transiciones (cualquier `status` es válido en cualquier momento, igual que `Rock.status`).

## 6. Sprint 5 — L10 Meetings ✅ hecho

Detalle bite-sized completo: `docs/superpowers/plans/2026-07-31-sprint5-l10.md`.
Ledger: `.superpowers/sdd/2026-07-31-sprint5-l10/progress.md`.

Alcance: crear reunión con agenda pre-cargada, checklist + timer opcional por sección (Segue 5, Scorecard 5, Rocks 5, Headlines 5, To-Do 5, IDS 60, Conclude 5 — 90 min clásicos), al cerrar: rating 1-10 + notas conclude + Todos vinculados quedan enlazados.

Desglose:
1. `L10MeetingRepository` — CRUD, `findAll({ status? })`.
2. `L10AgendaItemLogRepository` — `logItem(meetingId, { itemType, referenceId, notes })`.
3. `routes/l10.ts` — `POST /l10` (crea con agenda pre-cargada), `PATCH /l10/:id` (notas de cada sección, `status`), `POST /l10/:id/agenda-items`, `POST /l10/:id/close` (body `{ overallRating, concludeNotes }`, valida `1 <= overallRating <= 10`).
4. Los Todos creados durante la reunión usan `Todo.originatingMeetingId` (ya existe en el schema) — el endpoint de creación de Todo (¿vive en `routes/l10.ts` o en un `routes/todos.ts` propio? decidir al detallar — un Todo puede crearse también fuera de una reunión, así que probablemente merece su propio `TodoRepository`/`routes/todos.ts` reusado desde la vista L10).
5. Frontend: vista de reunión en vivo — panel activo `--glass-bg-elevated`, secciones colapsadas `--glass-bg-secondary` (DESIGN_BRIEF), timer por sección (`setInterval` + estado local, opcional/pausable, no bloqueante).
6. `l10.README.md`.

Decisión ya tomada al detallar: `Todo` sí estrena repositorio (`TodoRepository`) y rutas
(`routes/todos.ts`) propias en este sprint — sin página `/todos` independiente (YAGNI, único
consumidor real es la vista de reunión en vivo).

## 7. Sprint 6 — V/TO ✅ hecho

Alcance: formulario estructurado por secciones (tabs, no todo en una pantalla), versión solo-lectura exportable/imprimible.

**Decisiones tomadas de forma autónoma (sin bloquear, per directiva del usuario), documentadas con su razonamiento completo en `docs/superpowers/plans/2026-07-31-sprint6-vto.md` sección "Decisiones de diseño":**
- El "1-Year Plan" enlaza **Rocks reales** — `oneYearPlan.companyRockIds: string[]` guarda IDs de `Rock` existentes (`isCompanyRock: true`), resueltos en el frontend vía `rocksApi.list()`. Consistente con el patrón ya establecido en Sprint 5 (L10 reutiliza `rocksApi`/`issuesApi` en vez de duplicar datos).
- Vista imprimible: **CSS `@media print` del navegador, sin librería de PDF nueva.** YAGNI — "Imprimir → Guardar como PDF" del navegador ya cubre el caso de uso sin añadir un proceso pesado (headless Chromium) para una herramienta interna.

Plan bite-sized completo (13 tareas, TDD, código completo sin placeholders): `docs/superpowers/plans/2026-07-31-sprint6-vto.md`.

Desglose:
1. `VTORepository` — `findOrCreate()` (un solo doc por tenant, `@@unique([tenantId])`, vía `upsert`), `update(data, updatedByUserId)`.
2. `routes/vto.ts` — `GET /vto` (auto-crea vacío si no existe), `PUT /vto` (upsert parcial por sección).
3. Frontend: `VTOPage` con `Tabs` por sección — Core Values, Core Focus + 10-Year Target, Marketing Strategy, 3-Year Picture, 1-Year Plan (con selector de Company Rocks reales).
4. `VTOPrintView` — vista solo-lectura + CSS `@media print` que oculta el shell de la app (sider/header) y pasa a fondo blanco sólido.
5. `vto.README.md`.

## 8. Sprint 7 — Pulido multitenant y hardening ✅ hecho

Alcance IMPLEMENTATION_PLAN.md §5: tenant switcher en UI (confirmado ya cubierto desde Sprint 0,
sin tarea nueva), auditoría (`created_by`/`updated_by` en `Rock`/`Issue`/`Seat`/`ScorecardMetric`/
`L10Meeting`/`Todo`), Row-Level Security (§4.3, preparado sin activar — decisión confirmada con el
usuario dado el riesgo de tumbar la app si se activa mal), backups (script + servicio Docker, sin
prueba de restauración en vivo), `eslint-plugin-react-hooks` (hallazgo de Sprint 5).

✅ hecho: 12 tareas + revisión final de rama completa (opus) + 1 ronda de fixes consolidada
(1 Critical: `enable-rls.sql` comparaba `tenant_id` TEXT contra `::uuid` — el operador no existe en
Postgres, el script de RLS preparado no habría funcionado tal cual, y sin `BEGIN`/`COMMIT` podía
dejar las tablas en deny-all a medio aplicar; 4 Important: `seed.ts` con 2 bloques sin campos de
auditoría por un olvido del controller en Task 1, `backup-db.sh` escondía un `pg_dump` fallido tras
el exit code de `gzip` en un pipeline, el servicio `backup` de Docker no podía ejecutar el script
tras un `git clone` real por `core.filemode=false`, y una `triple-slash-reference` preexistente en
`vite.config.ts` hacía que `npm run lint` SIEMPRE fallara — anulando el propósito de activar
`eslint-plugin-react-hooks`) + re-review escopada en PASS. Migración Prisma real aplicada
(`20260801073320_audit_fields`, 6 tablas + 12 relaciones nuevas en `User`). RLS confirmado inerte
(0 referencias desde `repositories/`, verificado incluso contra Postgres real que `relrowsecurity`
sigue en `false`). Backend 200/200 tests, frontend 179/179 tests, typecheck y lint limpios en
ambos (11 warnings `react-hooks/exhaustive-deps` auditados componente a componente como falsos
positivos intencionales). Detalle completo en `docs/superpowers/plans/2026-08-01-sprint7-hardening.md`
y el ledger `.superpowers/sdd/2026-08-01-sprint7-hardening/progress.md`. Pendiente del usuario:
misma verificación manual de aislamiento multitenant que Sprints 2-6, prueba real de restauración
de un backup (requiere VPS desplegado), y decidir cuándo comitear el trabajo acumulado de
Sprints 6-7 (ninguno de los dos está comiteado — política de "el usuario comitea todo" aplicada
desde Sprint 6 Task 10 en adelante).

**Roadmap de Sprints 0-7: completo.** Todos los módulos del MVP (IMPLEMENTATION_PLAN.md §1) están
implementados, testeados y revisados. Quedan como trabajo futuro, fuera de este roadmap: activar
RLS de verdad (requiere Postgres real + conectar `forTenant()` a los repositorios), prueba de
restauración de backup en el VPS, y verificación manual de aislamiento multitenant en todos los
sprints — las tres ya identificadas y documentadas como pendientes del usuario en cada sprint.

**Hallazgo de la revisión de Sprint 5 (Task 10):** `front/eslint.config.js` no tiene
`eslint-plugin-react-hooks` — la regla `rules-of-hooks` no está activada por lint en absoluto,
así que el orden correcto de hooks depende solo de la revisión manual, no de tooling, pese a que
este proyecto ya ha enviado una regresión Critical de exactamente esa clase de bug (Sprint 2) y
ha vuelto a rozarla en cada sprint desde entonces. Añadir `eslint-plugin-react-hooks` +
`"react-hooks/rules-of-hooks": "error"` a `front/eslint.config.js` es una tarea barata y de alto
valor para este sprint — convertiría la comprobación manual actual en un gate automático.

Desglose:
1. Confirmar si `TenantSwitcher` actual cubre el caso "usuario en 2+ tenants" completo (ya construido en Sprint 0) — si sí, tachar este punto, no rehacer trabajo.
2. Auditoría: decidir alcance — ¿`createdByUserId`/`updatedByUserId` en qué tablas exactamente? (`Rock`, `Issue`, `VTODocument` ya tiene `updatedByUserId`; el resto no) → requiere migración Prisma.
3. Activar RLS nativo de Postgres (CLAUDE.md §4.3 / IMPLEMENTATION_PLAN.md §4.3): `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` por tabla de negocio, backend setea `app.current_tenant` al inicio de cada transacción — **esto es defensa en profundidad, no reemplaza el repositorio tenant-aware**, ambas capas se mantienen.
4. Backups: `pg_dump` automatizado (cron en el VPS o contenedor sidecar) + prueba real de restauración documentada.
5. `hardening.README.md`.

**Pendiente a decidir antes de detallar:** alcance exacto de auditoría (qué tablas, qué acciones) y mecanismo de backup (cron del host vs. contenedor dedicado) — ambos dependen de cómo quede el VPS final, mejor decidirlo cuando el resto de módulos ya estén desplegados.

---

## 9. Siguiente paso

Sprint 2 ya tiene plan bite-sized listo (`2026-07-30-sprint2-rocks.md`) — ejecutable ya, en paralelo a Sprint 1. Sprints 3-7 se detallan igual, uno a uno, justo antes de arrancar cada uno (así heredan las decisiones reales que tome Sprint 2/3/4 en vez de asumirlas por adelantado) — actualizar este roadmap si algo cambia de plan.
