# Sprint 3 — Scorecard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de `ScorecardMetric`, grid semanal editable inline (filas = métricas, columnas = últimas 12 semanas) con cálculo automático de "goal met/missed" en verde/rojo, y un mini-gráfico de tendencia por métrica — end-to-end, tenant-aware, con tests y cobertura.

**Architecture:** Backend Fastify: dos repositorios tenant-aware (`ScorecardMetricRepository`, `ScorecardEntryRepository`) siguiendo el patrón ya establecido en Sprint 2 (`constructor(tenantId)`, `updateMany`/`deleteMany` con `{id, tenantId}`, `create`/`upsert` inyectando `tenantId`). Un route file (`routes/scorecard.ts`) con `requireTenant(app)` en cada ruta (patrón consolidado en la revisión final de Sprint 2 — nunca `app.addHook` a mano). Las entradas semanales se editan como upsert de una celda (`PUT /scorecard/entries`), no como create/update separados, aprovechando el `@@unique([metricId, periodStart])` ya en el schema. Los campos `Decimal` de Prisma (`goalValue`, `actualValue`) se convierten a `number` de JS en los repositorios antes de devolver — sin este paso, `JSON.stringify` serializa un `Decimal` de Prisma como string via su `toJSON()`, y el contrato con el frontend quedaría inconsistente (a veces string, a veces number) según el campo. Frontend: `ScorecardGrid` (tabla con celdas editables inline vía `InputNumber` on-blur-save, color verde/rojo según `evaluateGoal`), un sparkline de tendencia por fila (Recharts, primera dependencia de gráficos del proyecto), y `ScorecardMetricFormModal` para crear/editar métricas — todo dentro del `AppLayout` compartido (Sprint 2), añadiendo "Scorecard" al menú de navegación.

**Tech Stack:** Fastify, Prisma, Zod, Vitest (ya existentes) + React, Ant Design, Recharts (**nueva dependencia** — `docs/IMPLEMENTATION_PLAN.md` §5 ya la sugiere para este sprint, no hay alternativa instalada), Vitest + RTL (ya existentes).

## Global Constraints

- Multitenancy golden rule (CLAUDE.md §4): ningún route llama `prisma.<modelo>` directamente — todo pasa por `ScorecardMetricRepository`/`ScorecardEntryRepository`.
- Toda ruta usa `{ preHandler: requireTenant(app) }` (helper en `middleware/resolveTenantContext.ts`) — **no** `app.addHook(...)` a mano; la revisión final de Sprint 2 dejó esto como el único patrón válido en todo el codebase.
- Repositorios: updates/deletes vía `updateMany`/`deleteMany` con `{ id, tenantId }` en el `where`, comprobando `result.count === 0` → `null`/`false`.
- **Conversión de `Decimal`:** todo método de repositorio que devuelve un `ScorecardMetric` o `ScorecardEntry` convierte `goalValue`/`actualValue` de `Decimal` (tipo de `@prisma/client`) a `number` con `.toNumber()` antes de devolver el objeto — nunca se deja un `Decimal` crudo en la respuesta de una ruta.
- Sin ACL por rol — cualquier miembro del tenant puede crear/editar/borrar cualquier métrica o entrada. Mismo criterio que Sprint 2 (herramienta interna de confianza, YAGNI).
- Semana = lunes. `periodStart` siempre es la fecha de un lunes a medianoche UTC — tanto el backend (al hacer upsert) como el frontend (al generar las columnas de la grid) usan la misma función `mondayOf(date)` para no desincronizarse en qué día cuenta como "inicio de semana". El backend no valida que el `periodStart` recibido sea realmente un lunes (confía en que el frontend siempre construye las columnas correctamente) — no se añade esa validación porque no hay otro cliente de esta API todavía (YAGNI).
- Testing: unit tests con Prisma mockeado, sin DB real. `server/vitest.config.ts`'s `coverage.include` ya tiene `src/repositories/**` (añadido en Sprint 2) — no hace falta tocarlo. `front/vite.config.ts`'s `coverage.include` ya tiene `src/lib/**` (añadido en la revisión final de Sprint 2) — no hace falta tocarlo tampoco.
- Documentación: `server/src/routes/scorecard.README.md` al final, mismo formato que `rocks.README.md`.
- Diseño: `docs/DESIGN_BRIEF.md` — "la grid en sí NO lleva blur pesado... usar `--glass-bg-elevated` casi opaco en la tabla, y reservar el efecto glass fuerte para el contenedor/header y las tarjetas de resumen encima" y los tokens `--status-on-track`/`--status-off-track` (ya usados en Sprint 2's `RocksBoard`, reutilizar aquí para las celdas met/missed en vez de inventar colores nuevos).
- Git: nadie hace `git commit` salvo el usuario. Los pasos "Commit" describen lo que hace el controlador (snapshot no destructivo vía `git stash create`+`git reset`), no una instrucción para el implementador.
- Concurrencia: puede haber otra sesión de Claude Code editando `server/` en paralelo (Sprint 1, Accountability Chart, en otro working tree o directamente en este mismo — ver notas de Sprint 2). Cada implementador se mantiene en el alcance exacto de sus ficheros declarados.

---

## Task 1: `ScorecardMetricRepository`

**Files:**
- Create: `server/src/repositories/ScorecardMetricRepository.ts`
- Test: `server/src/repositories/ScorecardMetricRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` (`lib/prisma.ts`).
- Produces: class `ScorecardMetricRepository`, `constructor(private tenantId: string)`:
  - `findAll(filters?: { isActive?: boolean }): Promise<ScorecardMetricView[]>` — `ScorecardMetricView` = el modelo `ScorecardMetric` de Prisma pero con `goalValue: number` en vez de `Decimal`.
  - `findById(id: string): Promise<ScorecardMetricView | null>`
  - `create(data: CreateMetricInput): Promise<ScorecardMetricView>` — `CreateMetricInput = { name: string; ownerUserId: string; goalValue: number; comparison: MetricComparison; frequency: MetricFrequency; unit: string; isActive?: boolean }`
  - `update(id: string, data: Partial<CreateMetricInput>): Promise<ScorecardMetricView | null>`
  - `delete(id: string): Promise<boolean>`
  Usado por Task 4 (`routes/scorecard.ts`).

- [ ] **Step 1: Write the failing test — `server/src/repositories/ScorecardMetricRepository.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    scorecardMetric: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const baseMetricRaw = {
  id: 'metric-1',
  tenantId: 'tenant-1',
  name: 'Nº leads cualificados/semana',
  ownerUserId: 'user-1',
  goalValue: new Decimal(10),
  comparison: 'gte',
  frequency: 'weekly',
  unit: '#',
  isActive: true,
};

describe('ScorecardMetricRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAll scopes by tenantId, applies isActive filter, and converts goalValue to number', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.findMany).mockResolvedValue([baseMetricRaw] as never);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const result = await repo.findAll({ isActive: true });

    expect(prisma.scorecardMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', isActive: true } })
    );
    expect(result).toEqual([{ ...baseMetricRaw, goalValue: 10 }]);
  });

  it('findAll with no filters only scopes by tenantId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.findMany).mockResolvedValue([] as never);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    await repo.findAll();

    expect(prisma.scorecardMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } })
    );
  });

  it('findById scopes by tenantId, converts goalValue, returns null when not found', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.findFirst).mockResolvedValueOnce(baseMetricRaw as never).mockResolvedValueOnce(null);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const found = await repo.findById('metric-1');
    const missing = await repo.findById('missing');

    expect(prisma.scorecardMetric.findFirst).toHaveBeenCalledWith({
      where: { id: 'metric-1', tenantId: 'tenant-1' },
    });
    expect(found).toEqual({ ...baseMetricRaw, goalValue: 10 });
    expect(missing).toBeNull();
  });

  it('create injects tenantId and converts the returned goalValue', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.create).mockResolvedValue(baseMetricRaw as never);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const result = await repo.create({
      name: 'Nº leads cualificados/semana',
      ownerUserId: 'user-1',
      goalValue: 10,
      comparison: 'gte',
      frequency: 'weekly',
      unit: '#',
    });

    expect(prisma.scorecardMetric.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', name: 'Nº leads cualificados/semana', goalValue: 10 }),
    });
    expect(result.goalValue).toBe(10);
  });

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

  it('update returns the fresh converted row when a row matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.scorecardMetric.findFirst).mockResolvedValue({ ...baseMetricRaw, isActive: false } as never);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const result = await repo.update('metric-1', { isActive: false });

    expect(result).toEqual({ ...baseMetricRaw, goalValue: 10, isActive: false });
  });

  it('delete scopes by tenantId and reports whether a row was removed', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.deleteMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const removed = await repo.delete('metric-1');
    const notRemoved = await repo.delete('missing');

    expect(prisma.scorecardMetric.deleteMany).toHaveBeenCalledWith({ where: { id: 'metric-1', tenantId: 'tenant-1' } });
    expect(removed).toBe(true);
    expect(notRemoved).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix server -- ScorecardMetricRepository.test`
Expected: FAIL — `Cannot find module './ScorecardMetricRepository.js'`.

- [ ] **Step 3: Implement `server/src/repositories/ScorecardMetricRepository.ts`**

```ts
import type { MetricComparison, MetricFrequency, ScorecardMetric } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type ScorecardMetricView = Omit<ScorecardMetric, 'goalValue'> & { goalValue: number };

export interface ScorecardMetricFilters {
  isActive?: boolean;
}

export interface CreateMetricInput {
  name: string;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
  isActive?: boolean;
}

export type UpdateMetricInput = Partial<CreateMetricInput>;

function toView(metric: ScorecardMetric): ScorecardMetricView {
  return { ...metric, goalValue: metric.goalValue.toNumber() };
}

export class ScorecardMetricRepository {
  constructor(private tenantId: string) {}

  async findAll(filters: ScorecardMetricFilters = {}): Promise<ScorecardMetricView[]> {
    const metrics = await prisma.scorecardMetric.findMany({
      where: {
        tenantId: this.tenantId,
        ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return metrics.map(toView);
  }

  async findById(id: string): Promise<ScorecardMetricView | null> {
    const metric = await prisma.scorecardMetric.findFirst({ where: { id, tenantId: this.tenantId } });
    return metric && toView(metric);
  }

  async create(data: CreateMetricInput): Promise<ScorecardMetricView> {
    const metric = await prisma.scorecardMetric.create({ data: { ...data, tenantId: this.tenantId } });
    return toView(metric);
  }

  async update(id: string, data: UpdateMetricInput): Promise<ScorecardMetricView | null> {
    const result = await prisma.scorecardMetric.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.scorecardMetric.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix server -- ScorecardMetricRepository.test`
Expected: PASS, 7 tests green.

- [ ] **Step 5: Verify typecheck and lint**

Run: `npm run typecheck --prefix server && npm run lint --prefix server`
Expected: both exit code 0 (ignore any pre-existing errors from a concurrent session's unrelated files, if present — note them, don't fix them).

- [ ] **Step 6: Commit**

```bash
git add server/src/repositories/ScorecardMetricRepository.ts server/src/repositories/ScorecardMetricRepository.test.ts
git commit -m "feat(server): add tenant-aware ScorecardMetricRepository"
```

---

## Task 2: `ScorecardEntryRepository`

**Files:**
- Create: `server/src/repositories/ScorecardEntryRepository.ts`
- Test: `server/src/repositories/ScorecardEntryRepository.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: class `ScorecardEntryRepository`, `constructor(private tenantId: string)`:
  - `findAllSince(periodStart: Date): Promise<ScorecardEntryView[]>` — todas las entradas del tenant con `periodStart >= ` el valor dado (usado para pintar la grid de las últimas N semanas, sin importar a qué métrica pertenecen — el frontend hace el cruce por `metricId`+`periodStart`). `ScorecardEntryView` = `ScorecardEntry` con `actualValue: number` en vez de `Decimal`.
  - `upsert(metricId: string, periodStart: Date, actualValue: number, enteredByUserId: string): Promise<ScorecardEntryView>` — usa `prisma.scorecardEntry.upsert` sobre `@@unique([metricId, periodStart])`. **No valida aquí que `metricId` pertenezca al tenant** — esa validación vive en el route (Task 4), igual que `MilestoneRepository.create` no valida `rockId` (ver Sprint 2 Task 3) porque el FK compuesto de Prisma (`ScorecardEntry.metric` usa `[metricId, tenantId] -> [id, tenantId]`) lo rechazaría a nivel de DB de todas formas si el route no lo hiciera antes con un 404 limpio.
  Usado por Task 4 (`routes/scorecard.ts`).

- [ ] **Step 1: Write the failing test — `server/src/repositories/ScorecardEntryRepository.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    scorecardEntry: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const baseEntryRaw = {
  id: 'entry-1',
  tenantId: 'tenant-1',
  metricId: 'metric-1',
  periodStart: new Date('2026-07-13'),
  actualValue: new Decimal(12),
  enteredByUserId: 'user-1',
  enteredAt: new Date('2026-07-13T10:00:00.000Z'),
};

describe('ScorecardEntryRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAllSince scopes by tenantId and periodStart >=, converts actualValue to number', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardEntry.findMany).mockResolvedValue([baseEntryRaw] as never);

    const { ScorecardEntryRepository } = await import('./ScorecardEntryRepository.js');
    const repo = new ScorecardEntryRepository('tenant-1');
    const result = await repo.findAllSince(new Date('2026-05-01'));

    expect(prisma.scorecardEntry.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', periodStart: { gte: new Date('2026-05-01') } },
    });
    expect(result).toEqual([{ ...baseEntryRaw, actualValue: 12 }]);
  });

  it('upsert scopes the where by the compound unique key and injects tenantId on create', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardEntry.upsert).mockResolvedValue(baseEntryRaw as never);

    const { ScorecardEntryRepository } = await import('./ScorecardEntryRepository.js');
    const repo = new ScorecardEntryRepository('tenant-1');
    const result = await repo.upsert('metric-1', new Date('2026-07-13'), 12, 'user-1');

    expect(prisma.scorecardEntry.upsert).toHaveBeenCalledWith({
      where: { metricId_periodStart: { metricId: 'metric-1', periodStart: new Date('2026-07-13') } },
      create: {
        tenantId: 'tenant-1',
        metricId: 'metric-1',
        periodStart: new Date('2026-07-13'),
        actualValue: 12,
        enteredByUserId: 'user-1',
      },
      update: { actualValue: 12, enteredByUserId: 'user-1' },
    });
    expect(result.actualValue).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix server -- ScorecardEntryRepository.test`
Expected: FAIL — `Cannot find module './ScorecardEntryRepository.js'`.

- [ ] **Step 3: Implement `server/src/repositories/ScorecardEntryRepository.ts`**

```ts
import type { ScorecardEntry } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type ScorecardEntryView = Omit<ScorecardEntry, 'actualValue'> & { actualValue: number };

function toView(entry: ScorecardEntry): ScorecardEntryView {
  return { ...entry, actualValue: entry.actualValue.toNumber() };
}

export class ScorecardEntryRepository {
  constructor(private tenantId: string) {}

  async findAllSince(periodStart: Date): Promise<ScorecardEntryView[]> {
    const entries = await prisma.scorecardEntry.findMany({
      where: { tenantId: this.tenantId, periodStart: { gte: periodStart } },
    });
    return entries.map(toView);
  }

  async upsert(
    metricId: string,
    periodStart: Date,
    actualValue: number,
    enteredByUserId: string
  ): Promise<ScorecardEntryView> {
    const entry = await prisma.scorecardEntry.upsert({
      where: { metricId_periodStart: { metricId, periodStart } },
      create: { tenantId: this.tenantId, metricId, periodStart, actualValue, enteredByUserId },
      update: { actualValue, enteredByUserId },
    });
    return toView(entry);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix server -- ScorecardEntryRepository.test`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Verify typecheck and lint**

Run: `npm run typecheck --prefix server && npm run lint --prefix server`
Expected: both exit code 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/repositories/ScorecardEntryRepository.ts server/src/repositories/ScorecardEntryRepository.test.ts
git commit -m "feat(server): add tenant-aware ScorecardEntryRepository"
```

---

## Task 3: `routes/scorecard.ts` — Metric CRUD + entry upsert + entries listing

**Files:**
- Create: `server/src/routes/scorecard.ts`
- Modify: `server/src/app.ts` (registrar `scorecardRoutes` bajo `/scorecard`)
- Test: `server/src/routes/scorecard.test.ts`

**Interfaces:**
- Consumes: `ScorecardMetricRepository` (Task 1), `ScorecardEntryRepository` (Task 2), `requireTenant` (`middleware/resolveTenantContext.ts`).
- Produces:
  - `GET /scorecard/metrics?isActive=true|false` → 200 `ScorecardMetricView[]`
  - `POST /scorecard/metrics` (body `{ name, ownerUserId, goalValue, comparison, frequency, unit, isActive? }`) → 201 `ScorecardMetricView`
  - `PATCH /scorecard/metrics/:id` → 200 `ScorecardMetricView` | 404
  - `DELETE /scorecard/metrics/:id` → 204 | 404
  - `GET /scorecard/entries?weeks=12` → 200 `ScorecardEntryView[]` — todas las entradas del tenant desde hace `weeks` semanas (lunes de esa semana) hasta hoy. `weeks` es opcional, default 12.
  - `PUT /scorecard/entries` (body `{ metricId, periodStart, actualValue }`) → 200 `ScorecardEntryView` | 404 si `metricId` no existe en el tenant. `enteredByUserId` se toma de `request.user.userId`, no del body.
  Todas usan `{ preHandler: requireTenant(app) }`.

- [ ] **Step 1: Write the failing test — `server/src/routes/scorecard.test.ts`**

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: { findUnique: vi.fn() },
    scorecardMetric: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    scorecardEntry: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const membership = { id: 'mem-1', userId: 'user-1', tenantId: 'tenant-1', role: 'owner', seatId: null };

const baseMetricRaw = {
  id: 'metric-1',
  tenantId: 'tenant-1',
  name: 'Nº leads cualificados/semana',
  ownerUserId: 'user-1',
  goalValue: new Decimal(10),
  comparison: 'gte',
  frequency: 'weekly',
  unit: '#',
  isActive: true,
};

async function authedApp() {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const token = app.jwt.sign({ userId: 'user-1' });
  return { app, headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' } };
}

describe('scorecard routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /scorecard/metrics requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/scorecard/metrics' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /scorecard/metrics returns the tenant metric list with goalValue as a plain number', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.findMany).mockResolvedValue([baseMetricRaw] as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/scorecard/metrics', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0].goalValue).toBe(10);
    await app.close();
  });

  it('POST /scorecard/metrics validates the body with Zod (400 on invalid comparison)', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/scorecard/metrics',
      headers,
      payload: { name: 'X', ownerUserId: 'user-1', goalValue: 10, comparison: 'not-valid', frequency: 'weekly', unit: '#' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /scorecard/metrics creates a metric and returns 201', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.create).mockResolvedValue(baseMetricRaw as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/scorecard/metrics',
      headers,
      payload: {
        name: 'Nº leads cualificados/semana',
        ownerUserId: 'user-1',
        goalValue: 10,
        comparison: 'gte',
        frequency: 'weekly',
        unit: '#',
      },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('PATCH /scorecard/metrics/:id returns 404 when not found in tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.updateMany).mockResolvedValue({ count: 0 });

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/scorecard/metrics/missing',
      headers,
      payload: { isActive: false },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('DELETE /scorecard/metrics/:id returns 204 on success', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.deleteMany).mockResolvedValue({ count: 1 });

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'DELETE', url: '/scorecard/metrics/metric-1', headers });

    expect(response.statusCode).toBe(204);
    await app.close();
  });

  it('GET /scorecard/entries defaults to 12 weeks and returns plain-number actualValue', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardEntry.findMany).mockResolvedValue([
      {
        id: 'entry-1',
        tenantId: 'tenant-1',
        metricId: 'metric-1',
        periodStart: new Date('2026-07-13'),
        actualValue: new Decimal(12),
        enteredByUserId: 'user-1',
        enteredAt: new Date('2026-07-13T10:00:00.000Z'),
      },
    ] as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/scorecard/entries', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0].actualValue).toBe(12);
    const callArg = vi.mocked(prisma.scorecardEntry.findMany).mock.calls[0][0] as { where: { periodStart: { gte: Date } } };
    expect(callArg.where.periodStart.gte).toBeInstanceOf(Date);
    await app.close();
  });

  it('PUT /scorecard/entries returns 404 when the metric does not exist in the tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.findFirst).mockResolvedValue(null);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/scorecard/entries',
      headers,
      payload: { metricId: 'missing', periodStart: '2026-07-13', actualValue: 12 },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('PUT /scorecard/entries upserts using the authenticated user as enteredByUserId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.findFirst).mockResolvedValue(baseMetricRaw as never);
    vi.mocked(prisma.scorecardEntry.upsert).mockResolvedValue({
      id: 'entry-1',
      tenantId: 'tenant-1',
      metricId: 'metric-1',
      periodStart: new Date('2026-07-13'),
      actualValue: new Decimal(12),
      enteredByUserId: 'user-1',
      enteredAt: new Date('2026-07-13T10:00:00.000Z'),
    } as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/scorecard/entries',
      headers,
      payload: { metricId: 'metric-1', periodStart: '2026-07-13', actualValue: 12 },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.scorecardEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ enteredByUserId: 'user-1', actualValue: 12 }),
      })
    );
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix server -- routes/scorecard.test`
Expected: FAIL — route `/scorecard/metrics` not found (404), module `routes/scorecard.ts` doesn't exist yet.

- [ ] **Step 3: Implement `server/src/routes/scorecard.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { ScorecardEntryRepository } from '../repositories/ScorecardEntryRepository.js';
import { ScorecardMetricRepository } from '../repositories/ScorecardMetricRepository.js';

const comparisonSchema = z.enum(['gte', 'lte', 'eq']);
const frequencySchema = z.enum(['weekly', 'monthly']);

const createMetricSchema = z.object({
  name: z.string().min(1),
  ownerUserId: z.string().min(1),
  goalValue: z.number(),
  comparison: comparisonSchema,
  frequency: frequencySchema,
  unit: z.string().min(1),
  isActive: z.boolean().default(true),
});

const updateMetricSchema = z.object({
  name: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
  goalValue: z.number().optional(),
  comparison: comparisonSchema.optional(),
  frequency: frequencySchema.optional(),
  unit: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const listMetricsQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
});

const listEntriesQuerySchema = z.object({
  weeks: z.coerce.number().int().positive().default(12),
});

const upsertEntrySchema = z.object({
  metricId: z.string().min(1),
  periodStart: z.coerce.date(),
  actualValue: z.number(),
});

function weeksAgo(weeks: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - weeks * 7);
  return date;
}

export default async function scorecardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/metrics', { preHandler: requireTenant(app) }, async (request) => {
    const query = listMetricsQuerySchema.parse(request.query);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    return repo.findAll(query);
  });

  app.post('/metrics', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createMetricSchema.parse(request.body);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await repo.create(body);
    return reply.code(201).send(metric);
  });

  app.patch('/metrics/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateMetricSchema.parse(request.body);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await repo.update(id, body);
    if (!metric) return reply.code(404).send({ error: 'Metric not found' });
    return metric;
  });

  app.delete('/metrics/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const deleted = await repo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Metric not found' });
    return reply.code(204).send();
  });

  app.get('/entries', { preHandler: requireTenant(app) }, async (request) => {
    const { weeks } = listEntriesQuerySchema.parse(request.query);
    const repo = new ScorecardEntryRepository(request.tenantId as string);
    return repo.findAllSince(weeksAgo(weeks));
  });

  app.put('/entries', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = upsertEntrySchema.parse(request.body);

    const metricRepo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await metricRepo.findById(body.metricId);
    if (!metric) return reply.code(404).send({ error: 'Metric not found' });

    const entryRepo = new ScorecardEntryRepository(request.tenantId as string);
    const entry = await entryRepo.upsert(body.metricId, body.periodStart, body.actualValue, request.user.userId);
    return entry;
  });
}
```

- [ ] **Step 4: Register the routes in `server/src/app.ts`**

```ts
import scorecardRoutes from './routes/scorecard.js';
// ...
  await app.register(scorecardRoutes, { prefix: '/scorecard' });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --prefix server -- routes/scorecard.test`
Expected: PASS, 9 tests green.

- [ ] **Step 6: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test:coverage --prefix server`
Expected: all exit code 0 for Sprint 3's own files; ignore pre-existing coverage gaps in any concurrent session's files.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/scorecard.ts server/src/routes/scorecard.test.ts server/src/app.ts
git commit -m "feat(server): add Scorecard metric CRUD + entry upsert routes"
```

---

## Task 4: Frontend — `quarters.ts` sibling `weeks.ts` + `scorecardApi.ts` + `evaluateGoal`

**Files:**
- Create: `front/src/lib/weeks.ts`
- Create: `front/src/lib/scorecardApi.ts`
- Create: `front/src/lib/evaluateGoal.ts`
- Test: `front/src/lib/weeks.test.ts`
- Test: `front/src/lib/scorecardApi.test.ts`
- Test: `front/src/lib/evaluateGoal.test.ts`

**Interfaces:**
- Consumes: `apiFetch` (`lib/apiClient.ts`).
- Produces:
  - `mondayOf(date: Date): Date` and `lastNMondays(n: number): Date[]` (ascending order, oldest first) from `lib/weeks.ts` — usadas por Task 5 (`ScorecardGrid`) para generar las columnas y por el backend's own logic conceptually mirrored (backend computes its own weeks-ago cutoff independently in Task 3 — this frontend util doesn't need to match it byte-for-byte, it only needs to independently produce "the last N Mondays" for column headers, and correctly cross-reference against whatever `periodStart` values the backend actually returns).
  - `evaluateGoal(actual: number | null, goal: number, comparison: 'gte' | 'lte' | 'eq'): 'met' | 'missed' | 'no-data'` from `lib/evaluateGoal.ts` — `null` actual (no entry yet for that week) → `'no-data'`.
  - `scorecardApi.listMetrics(filters?: { isActive?: boolean }): Promise<ScorecardMetric[]>`, `.createMetric(payload): Promise<ScorecardMetric>`, `.updateMetric(id, payload): Promise<ScorecardMetric>`, `.deleteMetric(id): Promise<void>`, `.listEntries(weeks?: number): Promise<ScorecardEntry[]>`, `.upsertEntry(metricId, periodStart, actualValue): Promise<ScorecardEntry>` from `lib/scorecardApi.ts`. Types `ScorecardMetric`/`ScorecardEntry` exported from the same file.
  Usadas por Task 5 (`ScorecardGrid`), Task 7 (`ScorecardMetricFormModal`).

- [ ] **Step 1: Write the failing test — `front/src/lib/weeks.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { lastNMondays, mondayOf } from './weeks';

describe('mondayOf', () => {
  it('returns the same date when given a Monday', () => {
    // 2026-07-13 is a Monday
    const result = mondayOf(new Date('2026-07-13T15:30:00.000Z'));
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(6);
    expect(result.getUTCDate()).toBe(13);
  });

  it('rolls a Thursday back to that week\'s Monday', () => {
    const result = mondayOf(new Date('2026-07-16T00:00:00.000Z'));
    expect(result.getUTCDate()).toBe(13);
  });

  it('rolls a Sunday back to that week\'s Monday (not the next one)', () => {
    const result = mondayOf(new Date('2026-07-19T00:00:00.000Z'));
    expect(result.getUTCDate()).toBe(13);
  });
});

describe('lastNMondays', () => {
  it('returns n Mondays in ascending order, ending with the current week\'s Monday', () => {
    const result = lastNMondays(3, new Date('2026-07-16T00:00:00.000Z'));
    expect(result).toHaveLength(3);
    expect(result[0].getUTCDate()).toBe(29); // June 29, 2026
    expect(result[1].getUTCDate()).toBe(6); // July 6, 2026
    expect(result[2].getUTCDate()).toBe(13); // July 13, 2026 (current week)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- weeks.test`
Expected: FAIL — `Cannot find module './weeks'`.

- [ ] **Step 3: Implement `front/src/lib/weeks.ts`**

```ts
export function mondayOf(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
}

export function lastNMondays(n: number, from: Date = new Date()): Date[] {
  const currentMonday = mondayOf(from);
  const mondays: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(currentMonday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    mondays.push(d);
  }
  return mondays;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix front -- weeks.test`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Write the failing test — `front/src/lib/evaluateGoal.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateGoal } from './evaluateGoal';

describe('evaluateGoal', () => {
  it('returns no-data when actual is null', () => {
    expect(evaluateGoal(null, 10, 'gte')).toBe('no-data');
  });

  it('gte: met when actual >= goal, missed otherwise', () => {
    expect(evaluateGoal(12, 10, 'gte')).toBe('met');
    expect(evaluateGoal(10, 10, 'gte')).toBe('met');
    expect(evaluateGoal(8, 10, 'gte')).toBe('missed');
  });

  it('lte: met when actual <= goal, missed otherwise', () => {
    expect(evaluateGoal(8, 10, 'lte')).toBe('met');
    expect(evaluateGoal(10, 10, 'lte')).toBe('met');
    expect(evaluateGoal(12, 10, 'lte')).toBe('missed');
  });

  it('eq: met only when actual === goal', () => {
    expect(evaluateGoal(10, 10, 'eq')).toBe('met');
    expect(evaluateGoal(9, 10, 'eq')).toBe('missed');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test --prefix front -- evaluateGoal.test`
Expected: FAIL — `Cannot find module './evaluateGoal'`.

- [ ] **Step 7: Implement `front/src/lib/evaluateGoal.ts`**

```ts
export type GoalResult = 'met' | 'missed' | 'no-data';

export function evaluateGoal(actual: number | null, goal: number, comparison: 'gte' | 'lte' | 'eq'): GoalResult {
  if (actual === null) return 'no-data';
  if (comparison === 'gte') return actual >= goal ? 'met' : 'missed';
  if (comparison === 'lte') return actual <= goal ? 'met' : 'missed';
  return actual === goal ? 'met' : 'missed';
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test --prefix front -- evaluateGoal.test`
Expected: PASS, 4 tests green.

- [ ] **Step 9: Write the failing test — `front/src/lib/scorecardApi.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('scorecardApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listMetrics builds the query string only from provided filters', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.listMetrics({ isActive: true });

    expect(apiFetch).toHaveBeenCalledWith('/scorecard/metrics?isActive=true');
  });

  it('listMetrics with no filters calls the bare endpoint', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.listMetrics();

    expect(apiFetch).toHaveBeenCalledWith('/scorecard/metrics');
  });

  it('listEntries includes the weeks query param when provided', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.listEntries(12);

    expect(apiFetch).toHaveBeenCalledWith('/scorecard/entries?weeks=12');
  });

  it('upsertEntry PUTs the payload as JSON with an ISO periodStart', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'entry-1' });

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.upsertEntry('metric-1', new Date('2026-07-13T00:00:00.000Z'), 12);

    expect(apiFetch).toHaveBeenCalledWith(
      '/scorecard/entries',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ metricId: 'metric-1', periodStart: '2026-07-13T00:00:00.000Z', actualValue: 12 }),
      })
    );
  });

  it('deleteMetric DELETEs the metric', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue(undefined);

    const { scorecardApi } = await import('./scorecardApi');
    await scorecardApi.deleteMetric('metric-1');

    expect(apiFetch).toHaveBeenCalledWith('/scorecard/metrics/metric-1', expect.objectContaining({ method: 'DELETE' }));
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm run test --prefix front -- scorecardApi.test`
Expected: FAIL — `Cannot find module './scorecardApi'`.

- [ ] **Step 11: Implement `front/src/lib/scorecardApi.ts`**

```ts
import { apiFetch } from './apiClient';

export type MetricComparison = 'gte' | 'lte' | 'eq';
export type MetricFrequency = 'weekly' | 'monthly';

export interface ScorecardMetric {
  id: string;
  tenantId: string;
  name: string;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
  isActive: boolean;
}

export interface ScorecardEntry {
  id: string;
  tenantId: string;
  metricId: string;
  periodStart: string;
  actualValue: number;
  enteredByUserId: string;
  enteredAt: string;
}

export interface CreateMetricPayload {
  name: string;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
  isActive?: boolean;
}

export type UpdateMetricPayload = Partial<CreateMetricPayload>;

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const scorecardApi = {
  listMetrics: (filters: { isActive?: boolean } = {}) =>
    apiFetch<ScorecardMetric[]>(`/scorecard/metrics${buildQuery(filters)}`),

  createMetric: (payload: CreateMetricPayload) =>
    apiFetch<ScorecardMetric>('/scorecard/metrics', { method: 'POST', body: JSON.stringify(payload) }),

  updateMetric: (id: string, payload: UpdateMetricPayload) =>
    apiFetch<ScorecardMetric>(`/scorecard/metrics/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteMetric: (id: string) => apiFetch<void>(`/scorecard/metrics/${id}`, { method: 'DELETE' }),

  listEntries: (weeks?: number) => apiFetch<ScorecardEntry[]>(`/scorecard/entries${buildQuery({ weeks })}`),

  upsertEntry: (metricId: string, periodStart: Date, actualValue: number) =>
    apiFetch<ScorecardEntry>('/scorecard/entries', {
      method: 'PUT',
      body: JSON.stringify({ metricId, periodStart: periodStart.toISOString(), actualValue }),
    }),
};
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm run test --prefix front -- scorecardApi.test`
Expected: PASS, 5 tests green.

- [ ] **Step 13: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all exit code 0.

- [ ] **Step 14: Commit**

```bash
git add front/src/lib/weeks.ts front/src/lib/weeks.test.ts front/src/lib/evaluateGoal.ts front/src/lib/evaluateGoal.test.ts front/src/lib/scorecardApi.ts front/src/lib/scorecardApi.test.ts
git commit -m "feat(front): add weeks/evaluateGoal utils and scorecardApi client"
```

---

## Task 5: Install Recharts + `ScorecardGrid` (table with inline-editable cells, met/missed coloring)

**Files:**
- Modify: `front/package.json` (add `recharts` dependency)
- Create: `front/src/pages/ScorecardPage.tsx`
- Test: `front/src/pages/ScorecardPage.test.tsx`

**Interfaces:**
- Consumes: `scorecardApi` (Task 4), `evaluateGoal` (Task 4), `lastNMondays` (Task 4), `AppLayout` (Sprint 2), `tenantApi` (Sprint 2, for the metric owner picker — used indirectly via Task 7's modal, not this task).
- Produces: page component `ScorecardPage`, mounted later at `/scorecard` (Task 8). Renders a table: rows = active metrics, columns = `lastNMondays(12)` (formatted `DD/MM`), each cell an `InputNumber` that saves on blur via `scorecardApi.upsertEntry`, colored via `evaluateGoal` (green background = met, red = missed, neutral = no-data) using the existing `--status-on-track`/`--status-off-track` CSS variables (Sprint 2 precedent, not new colors). Guards (`!token`, `mustChangePassword`) same as `RocksBoard` (Sprint 2's final-review fix made this the required pattern for every page — see Global Constraints).

- [ ] **Step 1: Install `recharts`**

Run: `npm install recharts --prefix front`
Expected: adds `recharts` to `front/package.json` dependencies, exit code 0. (Trend chart itself is Task 6 — this step just gets the dependency in place so Task 6 doesn't need its own install step.)

- [ ] **Step 2: Write the failing test — `front/src/pages/ScorecardPage.test.tsx`**

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { ScorecardPage } from './ScorecardPage';

vi.mock('../lib/scorecardApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/scorecardApi')>('../lib/scorecardApi');
  return {
    ...actual,
    scorecardApi: {
      listMetrics: vi.fn(),
      listEntries: vi.fn(),
      upsertEntry: vi.fn(),
      createMetric: vi.fn(),
      updateMetric: vi.fn(),
      deleteMetric: vi.fn(),
    },
  };
});

const metrics = [
  {
    id: 'metric-1',
    tenantId: 'tenant-1',
    name: 'Nº leads cualificados/semana',
    ownerUserId: 'user-1',
    goalValue: 10,
    comparison: 'gte' as const,
    frequency: 'weekly' as const,
    unit: '#',
    isActive: true,
  },
];

describe('ScorecardPage', () => {
  beforeEach(async () => {
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.listMetrics).mockResolvedValue(metrics as never);
    vi.mocked(scorecardApi.listEntries).mockResolvedValue([]);
  });

  it('renders one row per active metric with the last 12 week columns', async () => {
    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Nº leads cualificados/semana')).toBeInTheDocument());
    expect(screen.getAllByRole('spinbutton')).toHaveLength(12);
  });

  it('saves a cell value on blur and refetches entries', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.upsertEntry).mockResolvedValue({
      id: 'entry-1',
      tenantId: 'tenant-1',
      metricId: 'metric-1',
      periodStart: '2026-07-13T00:00:00.000Z',
      actualValue: 12,
      enteredByUserId: 'user-1',
      enteredAt: '2026-07-13T10:00:00.000Z',
    } as never);

    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Nº leads cualificados/semana')).toBeInTheDocument());

    const cells = screen.getAllByRole('spinbutton');
    await userEvent.type(cells[cells.length - 1], '12');
    await userEvent.tab();

    await waitFor(() => expect(scorecardApi.upsertEntry).toHaveBeenCalledWith('metric-1', expect.any(Date), 12));
  });

  it('redirects to /login when there is no token', () => {
    useAuthStore.setState({ token: null });
    render(
      <MemoryRouter initialEntries={['/scorecard']}>
        <ScorecardPage />
      </MemoryRouter>
    );
    expect(screen.queryByText(/scorecard/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test --prefix front -- ScorecardPage.test`
Expected: FAIL — `Cannot find module './ScorecardPage'`.

- [ ] **Step 4: Implement `front/src/pages/ScorecardPage.tsx`**

```tsx
import { InputNumber, message, Table, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { evaluateGoal } from '../lib/evaluateGoal';
import { scorecardApi, type ScorecardEntry, type ScorecardMetric } from '../lib/scorecardApi';
import { lastNMondays } from '../lib/weeks';
import { useAuthStore } from '../store/authStore';

const STATUS_BG: Record<string, string> = {
  met: 'var(--status-on-track)',
  missed: 'var(--status-off-track)',
  'no-data': 'transparent',
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function ScorecardPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const [metrics, setMetrics] = useState<ScorecardMetric[]>([]);
  const [entries, setEntries] = useState<ScorecardEntry[]>([]);

  const weeks = useMemo(() => lastNMondays(12), []);

  useEffect(() => {
    scorecardApi
      .listMetrics({ isActive: true })
      .then(setMetrics)
      .catch((e) => message.error(errorMessage(e)));
    scorecardApi
      .listEntries(12)
      .then(setEntries)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId]);

  function entryFor(metricId: string, week: Date): ScorecardEntry | undefined {
    const iso = week.toISOString();
    return entries.find((entry) => entry.metricId === metricId && entry.periodStart === iso);
  }

  async function saveCell(metricId: string, week: Date, value: number | null) {
    if (value === null) return;
    try {
      const saved = await scorecardApi.upsertEntry(metricId, week, value);
      setEntries((prev) => [...prev.filter((e) => !(e.metricId === metricId && e.periodStart === saved.periodStart)), saved]);
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  if (!token) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;

  const columns = [
    { title: 'Métrica', dataIndex: 'name', key: 'name', fixed: 'left' as const, width: 220 },
    ...weeks.map((week) => ({
      title: week.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      key: week.toISOString(),
      width: 90,
      render: (_: unknown, metric: ScorecardMetric) => {
        const entry = entryFor(metric.id, week);
        const status = evaluateGoal(entry?.actualValue ?? null, metric.goalValue, metric.comparison);
        return (
          <InputNumber
            defaultValue={entry?.actualValue}
            style={{ width: '100%', background: STATUS_BG[status] }}
            onBlur={(e) => {
              const raw = e.target.value;
              const parsed = raw === '' ? null : Number(raw);
              saveCell(metric.id, week, parsed);
            }}
          />
        );
      },
    })),
  ];

  return (
    <AppLayout title="Scorecard">
      <Typography.Title level={4}>Scorecard</Typography.Title>
      <Table
        className="glass-panel"
        dataSource={metrics}
        columns={columns}
        rowKey="id"
        pagination={false}
        scroll={{ x: true }}
      />
    </AppLayout>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --prefix front -- ScorecardPage.test`
Expected: PASS, 3 tests green.

- [ ] **Step 6: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all exit code 0.

- [ ] **Step 7: Commit**

```bash
git add front/package.json front/package-lock.json front/src/pages/ScorecardPage.tsx front/src/pages/ScorecardPage.test.tsx
git commit -m "feat(front): add ScorecardPage grid with inline-editable cells"
```

---

## Task 6: Trend sparkline (Recharts) per metric row

**Files:**
- Modify: `front/src/pages/ScorecardPage.tsx`
- Modify: `front/src/pages/ScorecardPage.test.tsx`

**Interfaces:**
- Consumes: `recharts` (`LineChart`, `Line`, `ResponsiveContainer` from `recharts`), the same `entries`/`weeks` state already in `ScorecardPage`.
- Produces: an extra fixed-right "Tendencia" column in the `ScorecardPage` table, rendering a small `ResponsiveContainer`-wrapped `LineChart` (no axes, no grid, no tooltip — a true sparkline) plotting each metric's `actualValue` across the 12 weeks (gaps where no entry exists are skipped, not zero-filled).

- [ ] **Step 1: Write the failing test (extend `ScorecardPage.test.tsx`)**

Add this test to the existing `describe('ScorecardPage', ...)` block:

```tsx
  it('renders a trend sparkline column for each metric', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.listEntries).mockResolvedValue([
      {
        id: 'entry-1',
        tenantId: 'tenant-1',
        metricId: 'metric-1',
        periodStart: '2026-07-13T00:00:00.000Z',
        actualValue: 12,
        enteredByUserId: 'user-1',
        enteredAt: '2026-07-13T10:00:00.000Z',
      },
    ] as never);

    render(
      <MemoryRouter>
        <ScorecardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Nº leads cualificados/semana')).toBeInTheDocument());
    expect(screen.getByTestId('trend-metric-1')).toBeInTheDocument();
  });
```

**Note on testing Recharts under jsdom:** `ResponsiveContainer` measures its parent via `getBoundingClientRect`, which jsdom returns as all-zeros — Recharts then renders an empty/zero-size SVG rather than throwing, so the test above only needs to assert the wrapper `data-testid` is present, not that the SVG has actual plotted points. Don't try to assert on rendered `<path>` geometry; it won't be meaningful under jsdom.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- ScorecardPage.test`
Expected: FAIL — no element with `data-testid="trend-metric-1"`.

- [ ] **Step 3: Add the trend column to `front/src/pages/ScorecardPage.tsx`**

Add the import at the top:

```tsx
import { Line, LineChart, ResponsiveContainer } from 'recharts';
```

Add a helper above the component:

```tsx
function trendData(entries: ScorecardEntry[], metricId: string, weeks: Date[]) {
  return weeks
    .map((week) => {
      const iso = week.toISOString();
      const entry = entries.find((e) => e.metricId === metricId && e.periodStart === iso);
      return entry ? { week: iso, value: entry.actualValue } : null;
    })
    .filter((point): point is { week: string; value: number } => point !== null);
}
```

Add the column to the `columns` array (after the week columns, before closing the array):

```tsx
    {
      title: 'Tendencia',
      key: 'trend',
      fixed: 'right' as const,
      width: 120,
      render: (_: unknown, metric: ScorecardMetric) => (
        <div data-testid={`trend-${metric.id}`} style={{ width: 100, height: 32 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData(entries, metric.id, weeks)}>
              <Line type="monotone" dataKey="value" stroke="#16983c" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix front -- ScorecardPage.test`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all exit code 0.

- [ ] **Step 6: Commit**

```bash
git add front/src/pages/ScorecardPage.tsx front/src/pages/ScorecardPage.test.tsx
git commit -m "feat(front): add Recharts trend sparkline column to ScorecardPage"
```

---

## Task 7: `ScorecardMetricFormModal` — crear/editar/borrar métrica

**Files:**
- Create: `front/src/components/ScorecardMetricFormModal.tsx`
- Modify: `front/src/pages/ScorecardPage.tsx` (botón "Nueva métrica" + click en el nombre de una métrica para editar)
- Test: `front/src/components/ScorecardMetricFormModal.test.tsx`
- Modify: `front/src/pages/ScorecardPage.test.tsx`

**Interfaces:**
- Consumes: `scorecardApi` (Task 4), `tenantApi` (Sprint 2, para el selector de owner).
- Produces: `ScorecardMetricFormModal({ open, metric, members, onClose, onSaved }: ScorecardMetricFormModalProps)` — formulario (`name`, `ownerUserId` Select, `goalValue` InputNumber, `comparison` Select, `frequency` Select, `unit` Input, `isActive` Switch cuando se edita) + botón "Borrar métrica" (con `Popconfirm`, solo en edición, mismo patrón que `RockFormModal`'s "Borrar Rock" — Sprint 2).

- [ ] **Step 1: Write the failing test — `front/src/components/ScorecardMetricFormModal.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScorecardMetricFormModal } from './ScorecardMetricFormModal';

vi.mock('../lib/scorecardApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/scorecardApi')>('../lib/scorecardApi');
  return {
    ...actual,
    scorecardApi: { createMetric: vi.fn(), updateMetric: vi.fn(), deleteMetric: vi.fn() },
  };
});

const members = [{ userId: 'user-1', fullName: 'Pablo', email: 'me@example.com' }];

describe('ScorecardMetricFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new metric with the entered fields', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.createMetric).mockResolvedValue({ id: 'metric-1' } as never);
    const onSaved = vi.fn();

    render(<ScorecardMetricFormModal open metric={undefined} members={members} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Nº leads cualificados/semana');
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.type(screen.getByLabelText(/objetivo/i), '10');
    await userEvent.type(screen.getByLabelText(/unidad/i), '#');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(scorecardApi.createMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nº leads cualificados/semana', ownerUserId: 'user-1', goalValue: 10, unit: '#' })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows a delete button only when editing, and deletes on confirm', async () => {
    const { scorecardApi } = await import('../lib/scorecardApi');
    vi.mocked(scorecardApi.deleteMetric).mockResolvedValue(undefined);
    const onSaved = vi.fn();

    const metric = {
      id: 'metric-1',
      tenantId: 'tenant-1',
      name: 'Nº leads cualificados/semana',
      ownerUserId: 'user-1',
      goalValue: 10,
      comparison: 'gte' as const,
      frequency: 'weekly' as const,
      unit: '#',
      isActive: true,
    };

    render(<ScorecardMetricFormModal open metric={metric} members={members} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole('button', { name: /borrar métrica/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^sí$|^yes$|confirmar/i }));

    await waitFor(() => expect(scorecardApi.deleteMetric).toHaveBeenCalledWith('metric-1'));
    expect(onSaved).toHaveBeenCalled();
  });
});
```

**Note:** the exact confirm-button label in the second test's `getByRole('button', { name: ... })` depends on antd `Popconfirm`'s default locale strings — check the actual rendered text if the regex above doesn't match (Sprint 2's equivalent `RockFormModal` delete test, already merged, has the working pattern — copy its exact selector instead of guessing).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- ScorecardMetricFormModal.test`
Expected: FAIL — `Cannot find module './ScorecardMetricFormModal'`.

- [ ] **Step 3: Implement `front/src/components/ScorecardMetricFormModal.tsx`**

```tsx
import { Button, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Switch } from 'antd';
import { useEffect, useState } from 'react';
import { scorecardApi, type MetricComparison, type MetricFrequency, type ScorecardMetric } from '../lib/scorecardApi';
import type { TenantMember } from '../lib/tenantApi';

export interface ScorecardMetricFormModalProps {
  open: boolean;
  metric?: ScorecardMetric;
  members: TenantMember[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  name: string;
  ownerUserId: string;
  goalValue: number;
  comparison: MetricComparison;
  frequency: MetricFrequency;
  unit: string;
  isActive?: boolean;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function ScorecardMetricFormModal({ open, metric, members, onClose, onSaved }: ScorecardMetricFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue(
      metric ?? { comparison: 'gte', frequency: 'weekly', isActive: true }
    );
  }, [metric, form]);

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      if (metric) {
        await scorecardApi.updateMetric(metric.id, values);
      } else {
        await scorecardApi.createMetric(values);
      }
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!metric) return;
    try {
      await scorecardApi.deleteMetric(metric.id);
      onSaved();
      onClose();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={metric ? 'Editar métrica' : 'Nueva métrica'} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'Introduce un nombre' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="ownerUserId" label="Owner" rules={[{ required: true, message: 'Elige un owner' }]}>
          <Select options={members.map((member) => ({ value: member.userId, label: member.fullName }))} />
        </Form.Item>
        <Form.Item name="goalValue" label="Objetivo" rules={[{ required: true, message: 'Introduce un objetivo' }]}>
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="comparison" label="Comparación" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'gte', label: '≥ (mayor o igual)' },
              { value: 'lte', label: '≤ (menor o igual)' },
              { value: 'eq', label: '= (igual)' },
            ]}
          />
        </Form.Item>
        <Form.Item name="frequency" label="Frecuencia" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'weekly', label: 'Semanal' },
              { value: 'monthly', label: 'Mensual' },
            ]}
          />
        </Form.Item>
        <Form.Item name="unit" label="Unidad" rules={[{ required: true, message: 'Introduce una unidad' }]}>
          <Input placeholder="#, %, €" />
        </Form.Item>
        {metric && (
          <Form.Item name="isActive" label="Activa" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" loading={saving} block>
          Guardar
        </Button>
      </Form>

      {metric && (
        <Popconfirm
          title="¿Borrar esta métrica? Esta acción no se puede deshacer."
          onConfirm={handleDelete}
        >
          <Button danger block style={{ marginTop: 12 }}>
            Borrar métrica
          </Button>
        </Popconfirm>
      )}
    </Modal>
  );
}
```

- [ ] **Step 4: Wire the modal into `ScorecardPage`**

Modify `front/src/pages/ScorecardPage.tsx`: add `members` state (populate via `tenantApi.listMembers()` in a `useEffect` keyed on `activeTenantId`, same pattern as `RocksBoard`), `modalMetric` state (`ScorecardMetric | 'new' | null`), a "Nueva métrica" button above the table, make the "Métrica" column's cell clickable to open the modal in edit mode, and render the modal:

```tsx
{modalMetric && (
  <ScorecardMetricFormModal
    open
    metric={modalMetric === 'new' ? undefined : modalMetric}
    members={members}
    onClose={() => setModalMetric(null)}
    onSaved={() => {
      setModalMetric(null);
      scorecardApi.listMetrics({ isActive: true }).then(setMetrics);
    }}
  />
)}
```

- [ ] **Step 5: Add tests for the wiring (extend `ScorecardPage.test.tsx`)**

Add tests mirroring Sprint 2's `RocksBoard.test.tsx` "opens the modal in edit mode" and "refetches ... when the modal is closed" tests — same structure, adapted to metrics instead of rocks.

- [ ] **Step 6: Run tests, typecheck, lint, coverage**

Run: `npm run test --prefix front && npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all green/clean.

- [ ] **Step 7: Commit**

```bash
git add front/src/components/ScorecardMetricFormModal.tsx front/src/components/ScorecardMetricFormModal.test.tsx front/src/pages/ScorecardPage.tsx front/src/pages/ScorecardPage.test.tsx
git commit -m "feat(front): add ScorecardMetricFormModal for create/edit/delete"
```

---

## Task 8: Nav entry + `/scorecard` route

**Files:**
- Modify: `front/src/components/AppLayout.tsx` (añadir "Scorecard" a `NAV_ITEMS`)
- Modify: `front/src/App.tsx` (registrar la ruta)

**Interfaces:**
- Consumes: `ScorecardPage` (Task 5-7).
- Produces: navegar a `/scorecard` renderiza `ScorecardPage`; el menú de `AppLayout` incluye "Scorecard" en todas las páginas.

- [ ] **Step 1: Add the nav item in `front/src/components/AppLayout.tsx`**

```tsx
const NAV_ITEMS = [
  { key: '/dashboard', label: <Link to="/dashboard">Dashboard</Link> },
  { key: '/rocks', label: <Link to="/rocks">Rocks</Link> },
  { key: '/scorecard', label: <Link to="/scorecard">Scorecard</Link> },
];
```

- [ ] **Step 2: Register the route in `front/src/App.tsx`**

```tsx
import { ScorecardPage } from './pages/ScorecardPage';
// ...
          <Route path="/scorecard" element={<ScorecardPage />} />
```

- [ ] **Step 3: Run the full front suite, typecheck, lint**

Run: `npm run test --prefix front && npm run typecheck --prefix front && npm run lint --prefix front`
Expected: all green (this touches shared `AppLayout` — the existing `AppLayout.test.tsx` may need its nav-links assertion extended if it hardcodes the expected link count/labels; check and update if so).

- [ ] **Step 4: Commit**

```bash
git add front/src/components/AppLayout.tsx front/src/App.tsx front/src/components/AppLayout.test.tsx
git commit -m "feat(front): add Scorecard nav entry and route"
```

---

## Task 9: `scorecard.README.md`

**Files:**
- Create: `server/src/routes/scorecard.README.md`

- [ ] **Step 1: Write `server/src/routes/scorecard.README.md`**, following the format of `server/src/routes/rocks.README.md` (Sprint 2): qué hace cada endpoint, la decisión de "semana = lunes" y la función `mondayOf`/`lastNMondays` compartida solo conceptualmente entre frontend/backend (no es código compartido — cada lado calcula sus propias semanas), la conversión `Decimal -> number`, permisos (igual que Rocks, sin ACL por rol), y un ejemplo `curl` de `GET /scorecard/metrics`.

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/scorecard.README.md
git commit -m "docs(server): add scorecard module README"
```

---

## Task 10: Verificación final del sprint

- [ ] **Step 1: Suite completa backend**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test:coverage --prefix server`

- [ ] **Step 2: Suite completa frontend**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`

- [ ] **Step 3: Actualizar el roadmap**

En `docs/superpowers/plans/2026-07-30-eos-tool-roadmap.md`, marcar Sprint 3 como hecho.

- [ ] **Step 4: Revisión final de rama completa (whole-branch review)**

Igual que al cierre de Sprint 2: dispatch de un reviewer en el modelo más capaz disponible sobre el diff completo de Sprint 3 (scoped a los ficheros propios de este sprint, dado que puede haber otra sesión concurrente compartiendo el mismo working tree — ver la nota de concurrencia en Sprint 2's ledger para el patrón exacto de cómo generar ese diff con `git diff BASE HEAD -- <ficheros>`), con foco especial en: la conversión `Decimal->number` es consistente en los tres repositorios/rutas que la tocan, `mondayOf`/`lastNMondays` del frontend nunca puede desincronizarse silenciosamente del cálculo de "hace N semanas" del backend (revisar si vale la pena un test de integración conceptual aunque no haya DB real), y que `ScorecardPage` sigue el mismo patrón de guards que `RocksBoard` (con las dos guards ANTES de cualquier `return` pero DESPUÉS de todos los hooks — el bug de Rules of Hooks de Sprint 2 es exactamente el tipo de cosa a revisar aquí de nuevo, ya que este plan pone los `if (!token)...` guards tras los hooks correctamente en el Step 4 de la Task 5, pero confirmarlo explícitamente en la review es barato y vale la pena dado el precedente).
