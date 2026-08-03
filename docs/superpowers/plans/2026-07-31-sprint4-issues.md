# Sprint 4 — Issues (IDS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de `Issue` (Identify-Discuss-Solve list de EOS) con lista priorizable por drag-and-drop y cambio de estado `open → discussing → solved/dropped`.

**Architecture:** Mismo patrón que Sprint 2 (Rocks) y Sprint 3 (Scorecard): repositorio tenant-aware → rutas Fastify con `requireTenant(app)` → cliente API tipado → página React dentro de `AppLayout`. La única pieza nueva es el orden manual arrastrable, resuelto con un campo `sortOrder` persistido y `@dnd-kit` en el frontend.

**Tech Stack:** Fastify + Zod + Prisma (backend, ya existente); React + Vite + Ant Design + `@dnd-kit/core`/`@dnd-kit/sortable`/`@dnd-kit/utilities` (nueva dependencia, a instalar en Task 5) + Vitest/Testing Library (frontend).

## Global Constraints

- **Multitenancy (CLAUDE.md §4):** ningún controller/route llama `prisma.issue.*` directamente. Todo pasa por `IssueRepository`, `constructor(private tenantId: string)`, todo `where` inyecta `tenantId`.
- **Patrón de repositorio establecido** (Sprint 2/3): `update`/`delete` usan `updateMany`/`deleteMany` con `{ id, tenantId }` en el `where`; `count === 0` → `null`/`false`, nunca se deja que Prisma lance `P2025`.
- **`requireTenant(app)`** (de `server/src/middleware/resolveTenantContext.ts`) como `preHandler` en cada ruta — nunca `app.addHook` manual.
- **Rules of Hooks (React):** todo hook (`useState`/`useEffect`/`useMemo`/`useAuthStore`) va ANTES de los guards de autenticación (`if (!token) return <Navigate/>`, `if (user?.mustChangePassword) return <Navigate/>`), que van justo antes del `return (`. Este proyecto ya envió una regresión Critical de esto una vez (Sprint 2) — no repetirla.
- **Zod query params booleanos:** si algún query param futuro fuera boolean, usar `z.enum(['true','false']).transform(v => v === 'true')`, nunca `z.coerce.boolean()` (`Boolean("false")` es `true` en JS — bug real ya cometido y arreglado en Sprint 3).
- **Sin ACL por rol** dentro de un tenant — cualquier miembro puede crear/editar/borrar cualquier Issue, igual que Rocks y Scorecard. YAGNI, no construir permisos que nadie pidió.
- **Sin máquina de estados rígida:** el estado de un Issue (`open`/`discussing`/`solved`/`dropped`) se actualiza con un `PATCH` genérico, igual que el `status` de un Rock — no se valida que la transición sea "alcanzable" desde el estado actual. La metodología EOS real permite resolver un issue directamente sin pasar por discusión formal; inventar esa restricción sería una regla que nadie pidió.
- **Cada módulo lleva tests + cobertura + `.md` de funcionalidad** — regla del usuario, no negociable.
- **Diseño glassmorphism** (`docs/DESIGN_BRIEF.md`) — Issues no tiene entrada propia en "Aplicación por módulo"; usar el mismo criterio que Rocks (lista/tabla de trabajo activo, no un dato denso como Scorecard) → `glass-panel` en el contenedor está bien aquí, no hace falta el tratamiento especial "casi opaco" de Scorecard.
- **Nadie hace `git commit`** salvo el usuario — los pasos "Commit" de este plan describen el snapshot no destructivo (`git add -A && git stash create && git reset`) que hace el controlador entre tareas, no una instrucción para el implementador.

## Estado de la migración (ya aplicada por el controlador, no repetir)

El campo `sortOrder Int @default(0) @map("sort_order")` ya se añadió a `model Issue` en
`server/prisma/schema.prisma` y la migración `20260731080939_issue_sort_order` ya se generó y
aplicó contra la base de datos de desarrollo local (`npm run migrate:dev --prefix server`) y
`npx prisma generate` ya corrió con éxito — el `@prisma/client` instalado en
`server/node_modules` ya conoce `sortOrder`. Ningún task de este plan necesita tocar el schema
ni ejecutar `migrate:dev`. El modelo completo tras el cambio:

```prisma
enum IssueStatus {
  open
  discussing
  solved
  dropped
}

enum IssuePriority {
  low
  medium
  high
}

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
  resolvedAt      DateTime?     @map("resolved_at")
  resolutionNotes String?       @map("resolution_notes")

  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  raisedBy  User   @relation("IssueRaisedBy", fields: [raisedByUserId], references: [id])

  @@index([tenantId, status])
  @@map("issues")
}
```

---

### Task 1: `IssueRepository`

**Files:**
- Create: `server/src/repositories/IssueRepository.ts`
- Test: `server/src/repositories/IssueRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` singleton de `server/src/lib/prisma.ts` (`import { prisma } from '../lib/prisma.js';`), tipos `Issue`, `IssueStatus`, `IssuePriority`, `Prisma` de `@prisma/client`.
- Produces: clase `IssueRepository` con `constructor(private tenantId: string)` y los métodos `findAll(filters?)`, `findById(id)`, `create(data)`, `update(id, data)`, `delete(id)`, `reorder(orderedIds)` — usados por `routes/issues.ts` en Task 2. Tipos exportados: `IssueFilters`, `CreateIssueInput`, `UpdateIssueInput`.

`server/src/repositories/**` ya está en `coverage.include` de `server/vitest.config.ts` desde Sprint 2 — no hace falta tocar ese archivo.

- [ ] **Step 1: Escribir el fichero completo con sus tests (TDD por método, pero el fichero es pequeño — escribe todos los tests primero)**

```typescript
// server/src/repositories/IssueRepository.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '@prisma/client';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    issue: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma.js';
import { IssueRepository } from './IssueRepository.js';

const TENANT_A = 'tenant-a';

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

describe('IssueRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('scopes to tenantId and orders by sortOrder ascending', async () => {
      vi.mocked(prisma.issue.findMany).mockResolvedValue([makeIssue()]);
      const repo = new IssueRepository(TENANT_A);

      await repo.findAll();

      expect(prisma.issue.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('adds a status filter when provided', async () => {
      vi.mocked(prisma.issue.findMany).mockResolvedValue([]);
      const repo = new IssueRepository(TENANT_A);

      await repo.findAll({ status: 'open' });

      expect(prisma.issue.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A, status: 'open' },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('scopes to tenantId', async () => {
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue());
      const repo = new IssueRepository(TENANT_A);

      await repo.findById('issue-1');

      expect(prisma.issue.findFirst).toHaveBeenCalledWith({
        where: { id: 'issue-1', tenantId: TENANT_A },
      });
    });
  });

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

  describe('update', () => {
    it('returns null when no row matches id+tenantId', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 0 });
      const repo = new IssueRepository(TENANT_A);

      const result = await repo.update('missing', { title: 'x' });

      expect(result).toBeNull();
    });

    it('sets resolvedAt when status moves to solved', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue({ status: 'solved' }));
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { status: 'solved' });

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'issue-1', tenantId: TENANT_A });
      expect(call.data.status).toBe('solved');
      expect(call.data.resolvedAt).toBeInstanceOf(Date);
    });

    it('sets resolvedAt when status moves to dropped', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue({ status: 'dropped' }));
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { status: 'dropped' });

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.data.resolvedAt).toBeInstanceOf(Date);
    });

    it('clears resolvedAt when status moves back to open', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue({ status: 'open', resolvedAt: null }));
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { status: 'open' });

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.data.resolvedAt).toBeNull();
    });

    it('leaves resolvedAt untouched when status is not part of the update', async () => {
      vi.mocked(prisma.issue.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.issue.findFirst).mockResolvedValue(makeIssue());
      const repo = new IssueRepository(TENANT_A);

      await repo.update('issue-1', { title: 'Renamed' });

      const call = vi.mocked(prisma.issue.updateMany).mock.calls[0][0];
      expect(call.data).not.toHaveProperty('resolvedAt');
    });
  });

  describe('delete', () => {
    it('returns true when a row was deleted, scoped to tenantId', async () => {
      vi.mocked(prisma.issue.deleteMany).mockResolvedValue({ count: 1 });
      const repo = new IssueRepository(TENANT_A);

      const result = await repo.delete('issue-1');

      expect(prisma.issue.deleteMany).toHaveBeenCalledWith({ where: { id: 'issue-1', tenantId: TENANT_A } });
      expect(result).toBe(true);
    });

    it('returns false when nothing matched', async () => {
      vi.mocked(prisma.issue.deleteMany).mockResolvedValue({ count: 0 });
      const repo = new IssueRepository(TENANT_A);

      const result = await repo.delete('missing');

      expect(result).toBe(false);
    });
  });

  describe('reorder', () => {
    it('runs one updateMany per id, scoped to tenantId, with sortOrder = array index', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }, { count: 1 }, { count: 1 }]);
      vi.mocked(prisma.issue.findMany).mockResolvedValue([]);
      const repo = new IssueRepository(TENANT_A);

      await repo.reorder(['issue-3', 'issue-1', 'issue-2']);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = vi.mocked(prisma.$transaction).mock.calls[0][0] as unknown[];
      expect(ops).toHaveLength(3);
    });

    it('returns the reordered list via findAll', async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }]);
      const reordered = [makeIssue({ id: 'issue-2', sortOrder: 0 }), makeIssue({ id: 'issue-1', sortOrder: 1 })];
      vi.mocked(prisma.issue.findMany).mockResolvedValue(reordered);
      const repo = new IssueRepository(TENANT_A);

      const result = await repo.reorder(['issue-2', 'issue-1']);

      expect(result).toBe(reordered);
    });
  });
});
```

```typescript
// server/src/repositories/IssueRepository.ts
import type { Issue, IssuePriority, IssueStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface IssueFilters {
  status?: IssueStatus;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  raisedByUserId: string;
  priority: IssuePriority;
}

export type UpdateIssueInput = Partial<Omit<CreateIssueInput, 'description'>> & {
  description?: string | null;
  status?: IssueStatus;
  resolutionNotes?: string | null;
};

export class IssueRepository {
  constructor(private tenantId: string) {}

  findAll(filters: IssueFilters = {}): Promise<Issue[]> {
    return prisma.issue.findMany({
      where: {
        tenantId: this.tenantId,
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findById(id: string): Promise<Issue | null> {
    return prisma.issue.findFirst({ where: { id, tenantId: this.tenantId } });
  }

  async create(data: CreateIssueInput): Promise<Issue> {
    const last = await prisma.issue.aggregate({
      where: { tenantId: this.tenantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (last._max.sortOrder ?? -1) + 1;
    return prisma.issue.create({ data: { ...data, tenantId: this.tenantId, sortOrder } });
  }

  async update(id: string, data: UpdateIssueInput): Promise<Issue | null> {
    const patch: Prisma.IssueUpdateManyMutationInput = { ...data };
    if (data.status === 'solved' || data.status === 'dropped') {
      patch.resolvedAt = new Date();
    } else if (data.status === 'open' || data.status === 'discussing') {
      patch.resolvedAt = null;
    }
    const result = await prisma.issue.updateMany({ where: { id, tenantId: this.tenantId }, data: patch });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.issue.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }

  async reorder(orderedIds: string[]): Promise<Issue[]> {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.issue.updateMany({ where: { id, tenantId: this.tenantId }, data: { sortOrder: index } })
      )
    );
    return this.findAll();
  }
}
```

Nota sobre `reorder`: `updateMany` con un `id` que no pertenezca a `this.tenantId` simplemente no
actualiza filas (0 rows afectadas) — no lanza error. Un array de ids mezclando tenants no puede
filtrar datos ajenos, solo ignora silenciosamente el id que no es del tenant activo.

- [ ] **Step 2: Ejecutar los tests**

Run: `npm test --prefix server -- IssueRepository`
Expected: todos los tests PASAN.

- [ ] **Step 3: Commit**

```bash
git add server/src/repositories/IssueRepository.ts server/src/repositories/IssueRepository.test.ts
git commit -m "feat(server): add tenant-scoped IssueRepository with manual sort order"
```

---

### Task 2: `routes/issues.ts` + registro en `app.ts`

**Files:**
- Create: `server/src/routes/issues.ts`
- Test: `server/src/routes/issues.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `IssueRepository` de Task 1 (`findAll`, `findById`, `create`, `update`, `delete`, `reorder`), `requireTenant(app)` de `server/src/middleware/resolveTenantContext.ts` (mismo import que `server/src/routes/rocks.ts:3`).
- Produces: router Fastify por defecto (`export default async function issueRoutes(app: FastifyInstance)`), montado bajo el prefijo `/issues` — usado por Task 5 (`issuesApi.ts`) vía `/api/issues/...`.

- [ ] **Step 1: Escribir los tests de la ruta**

```typescript
// server/src/routes/issues.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../repositories/IssueRepository.js', () => ({
  IssueRepository: vi.fn(),
}));
vi.mock('../middleware/resolveTenantContext.js', () => ({
  requireTenant: () => [
    async (request: { tenantId?: string }) => {
      request.tenantId = 'tenant-a';
    },
  ],
}));

import { buildApp } from '../app.js';
import { IssueRepository } from '../repositories/IssueRepository.js';

const mockIssue = {
  id: 'issue-1',
  tenantId: 'tenant-a',
  title: 'Slow onboarding',
  description: null,
  raisedByUserId: 'user-1',
  status: 'open',
  priority: 'medium',
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  resolvedAt: null,
  resolutionNotes: null,
};

describe('routes/issues', () => {
  let app: FastifyInstance;
  let repoMock: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    reorder: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    repoMock = {
      findAll: vi.fn().mockResolvedValue([mockIssue]),
      findById: vi.fn().mockResolvedValue(mockIssue),
      create: vi.fn().mockResolvedValue(mockIssue),
      update: vi.fn().mockResolvedValue(mockIssue),
      delete: vi.fn().mockResolvedValue(true),
      reorder: vi.fn().mockResolvedValue([mockIssue]),
    };
    vi.mocked(IssueRepository).mockImplementation(() => repoMock as never);
    app = await buildApp();
  });

  it('GET /issues lists issues for the tenant', async () => {
    const res = await app.inject({ method: 'GET', url: '/issues' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([mockIssue]);
  });

  it('GET /issues?status=open passes the filter through', async () => {
    await app.inject({ method: 'GET', url: '/issues?status=open' });
    expect(repoMock.findAll).toHaveBeenCalledWith({ status: 'open' });
  });

  it('GET /issues?status=bogus is rejected with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/issues?status=bogus' });
    expect(res.statusCode).toBe(400);
  });

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

  it('POST /issues defaults priority to medium when omitted', async () => {
    await app.inject({ method: 'POST', url: '/issues', payload: { title: 'x', raisedByUserId: 'user-1' } });
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ priority: 'medium' }));
  });

  it('PATCH /issues/:id updates and returns 200', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/issues/issue-1', payload: { status: 'discussing' } });
    expect(res.statusCode).toBe(200);
    expect(repoMock.update).toHaveBeenCalledWith('issue-1', { status: 'discussing' });
  });

  it('PATCH /issues/:id returns 404 when the repo returns null', async () => {
    repoMock.update.mockResolvedValue(null);
    const res = await app.inject({ method: 'PATCH', url: '/issues/missing', payload: { title: 'x' } });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /issues/:id returns 204 on success', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/issues/issue-1' });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /issues/:id returns 404 when nothing was deleted', async () => {
    repoMock.delete.mockResolvedValue(false);
    const res = await app.inject({ method: 'DELETE', url: '/issues/missing' });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /issues/reorder reorders and returns the list', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/issues/reorder',
      payload: { orderedIds: ['issue-2', 'issue-1'] },
    });
    expect(res.statusCode).toBe(200);
    expect(repoMock.reorder).toHaveBeenCalledWith(['issue-2', 'issue-1']);
    expect(res.json()).toEqual([mockIssue]);
  });

  it('PATCH /issues/reorder rejects an empty array with 400', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/issues/reorder', payload: { orderedIds: [] } });
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan (el route file no existe todavía)**

Run: `npm test --prefix server -- issues.test`
Expected: FAIL — `Cannot find module '../routes/issues.js'` (u error de import de `app.ts` intentando registrar algo que no existe todavía; en este punto `app.ts` aún no se ha tocado, así que en realidad fallará porque el test importa `buildApp` que compila bien pero las rutas `/issues` no existen — 404 en vez de los códigos esperados). Confirma que falla por la razón correcta antes de seguir.

- [ ] **Step 3: Escribir la ruta**

```typescript
// server/src/routes/issues.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { IssueRepository } from '../repositories/IssueRepository.js';

const statusEnum = z.enum(['open', 'discussing', 'solved', 'dropped']);
const priorityEnum = z.enum(['low', 'medium', 'high']);

const createIssueSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  raisedByUserId: z.string().min(1),
  priority: priorityEnum.default('medium'),
});

const updateIssueSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  raisedByUserId: z.string().min(1).optional(),
  priority: priorityEnum.optional(),
  status: statusEnum.optional(),
  resolutionNotes: z.string().nullable().optional(),
});

const listIssuesQuerySchema = z.object({
  status: statusEnum.optional(),
});

const reorderIssuesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export default async function issueRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: requireTenant(app) }, async (request) => {
    const query = listIssuesQuerySchema.parse(request.query);
    const repo = new IssueRepository(request.tenantId as string);
    return repo.findAll(query);
  });

  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createIssueSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    const issue = await repo.create(body);
    return reply.code(201).send(issue);
  });

  app.patch('/reorder', { preHandler: requireTenant(app) }, async (request) => {
    const { orderedIds } = reorderIssuesSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    return repo.reorder(orderedIds);
  });

  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateIssueSchema.parse(request.body);
    const repo = new IssueRepository(request.tenantId as string);
    const issue = await repo.update(id, body);
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });
    return issue;
  });

  app.delete('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new IssueRepository(request.tenantId as string);
    const deleted = await repo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Issue not found' });
    return reply.code(204).send();
  });
}
```

`PATCH /reorder` se registra ANTES de `PATCH /:id` en el fichero por claridad de lectura, pero
no es estrictamente necesario: el router de Fastify (`find-my-way`) prioriza siempre los
segmentos estáticos (`/reorder`) sobre los parametrizados (`/:id`) sin importar el orden de
registro — no hay ambigüedad de rutas aquí.

- [ ] **Step 4: Registrar en `app.ts`**

En `server/src/app.ts`, junto a los demás imports de rutas (línea 7-13 actual):

```typescript
import issueRoutes from './routes/issues.js';
```

Junto a los demás `app.register` de rutas de negocio (después de la línea de `scorecardRoutes`):

```typescript
await app.register(issueRoutes, { prefix: '/issues' });
```

- [ ] **Step 5: Ejecutar los tests, deben pasar**

Run: `npm test --prefix server -- issues.test`
Expected: PASS, todos los casos.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck --prefix server`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/issues.ts server/src/routes/issues.test.ts server/src/app.ts
git commit -m "feat(server): add CRUD + reorder routes for Issues"
```

---

### Task 3: Frontend — `reorder.ts` (función pura) + `issuesApi.ts`

**Files:**
- Create: `front/src/lib/reorder.ts`
- Test: `front/src/lib/reorder.test.ts`
- Create: `front/src/lib/issuesApi.ts`
- Test: `front/src/lib/issuesApi.test.ts`

**Interfaces:**
- Consumes: `apiFetch` de `front/src/lib/apiClient.ts` (mismo patrón que `rocksApi.ts`/`scorecardApi.ts`).
- Produces: `reorderIds(ids: string[], activeId: string, overId: string): string[]` — usada por Task 5 dentro del handler `onDragEnd`. `issuesApi` con `list`, `create`, `update`, `remove`, `reorder` — usada por Task 5/6. Tipos exportados: `Issue`, `IssueStatus`, `IssuePriority`, `CreateIssuePayload`, `UpdateIssuePayload`.

- [ ] **Step 1: Test + implementación de `reorderIds`**

```typescript
// front/src/lib/reorder.test.ts
import { describe, expect, it } from 'vitest';
import { reorderIds } from './reorder';

describe('reorderIds', () => {
  it('moves the active id to the position of the over id (moving down the list)', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves the active id to the position of the over id (moving up the list)', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the same array reference-equal content when active and over are the same', () => {
    expect(reorderIds(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
  });

  it('returns the original list unchanged when activeId is not found', () => {
    expect(reorderIds(['a', 'b', 'c'], 'missing', 'b')).toEqual(['a', 'b', 'c']);
  });

  it('returns the original list unchanged when overId is not found', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', 'missing')).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c'];
    reorderIds(input, 'a', 'c');
    expect(input).toEqual(['a', 'b', 'c']);
  });
});
```

```typescript
// front/src/lib/reorder.ts
export function reorderIds(ids: string[], activeId: string, overId: string): string[] {
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return ids;
  const result = ids.slice();
  result.splice(oldIndex, 1);
  result.splice(newIndex, 0, activeId);
  return result;
}
```

- [ ] **Step 2: Ejecutar**

Run: `npm test --prefix front -- reorder.test`
Expected: PASS.

- [ ] **Step 3: Test + implementación de `issuesApi.ts`**

```typescript
// front/src/lib/issuesApi.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({ apiFetch: vi.fn() }));

describe('issuesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list with no filters calls the bare endpoint', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.list();

    expect(apiFetch).toHaveBeenCalledWith('/issues');
  });

  it('list with a status filter builds the query string', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.list({ status: 'open' });

    expect(apiFetch).toHaveBeenCalledWith('/issues?status=open');
  });

  it('create POSTs the payload as JSON', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'issue-1' });
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.create({ title: 'x', raisedByUserId: 'user-1', priority: 'high' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/issues',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'x', raisedByUserId: 'user-1', priority: 'high' }),
      })
    );
  });

  it('update PATCHes only the given fields', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'issue-1' });
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.update('issue-1', { status: 'solved' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/issues/issue-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'solved' }) })
    );
  });

  it('remove DELETEs the issue', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.remove('issue-1');

    expect(apiFetch).toHaveBeenCalledWith('/issues/issue-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('reorder PATCHes the ordered id list', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);
    const { issuesApi } = await import('./issuesApi');

    await issuesApi.reorder(['issue-2', 'issue-1']);

    expect(apiFetch).toHaveBeenCalledWith(
      '/issues/reorder',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ orderedIds: ['issue-2', 'issue-1'] }) })
    );
  });
});
```

```typescript
// front/src/lib/issuesApi.ts
import { apiFetch } from './apiClient';

export type IssueStatus = 'open' | 'discussing' | 'solved' | 'dropped';
export type IssuePriority = 'low' | 'medium' | 'high';

export interface Issue {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  raisedByUserId: string;
  status: IssueStatus;
  priority: IssuePriority;
  sortOrder: number;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

export interface IssueFilters {
  status?: IssueStatus;
}

export interface CreateIssuePayload {
  title: string;
  description?: string;
  raisedByUserId: string;
  priority: IssuePriority;
}

export type UpdateIssuePayload = Partial<CreateIssuePayload> & {
  status?: IssueStatus;
  resolutionNotes?: string | null;
};

function buildQuery(filters: IssueFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const issuesApi = {
  list: (filters: IssueFilters = {}) => apiFetch<Issue[]>(`/issues${buildQuery(filters)}`),

  create: (payload: CreateIssuePayload) =>
    apiFetch<Issue>('/issues', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: UpdateIssuePayload) =>
    apiFetch<Issue>(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  remove: (id: string) => apiFetch<void>(`/issues/${id}`, { method: 'DELETE' }),

  reorder: (orderedIds: string[]) =>
    apiFetch<Issue[]>('/issues/reorder', { method: 'PATCH', body: JSON.stringify({ orderedIds }) }),
};
```

- [ ] **Step 4: Ejecutar**

Run: `npm test --prefix front -- issuesApi.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/lib/reorder.ts front/src/lib/reorder.test.ts front/src/lib/issuesApi.ts front/src/lib/issuesApi.test.ts
git commit -m "feat(front): add reorderIds pure function and issuesApi client"
```

---

### Task 4: Instalar `@dnd-kit`

**Files:**
- Modify: `front/package.json`, `front/package-lock.json`

**Interfaces:**
- Produces: paquetes `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` disponibles para Task 5.

- [ ] **Step 1: Instalar**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --prefix front`
Expected: se añaden las 3 entradas a `dependencies` en `front/package.json` y se actualiza `front/package-lock.json`. No debe tocar ninguna otra dependencia existente (`antd`, `recharts`, `@xyflow/react`, etc.) — si `npm install` propone cambios no relacionados, revisar antes de continuar en vez de aceptar a ciegas.

- [ ] **Step 2: Verificar que el resto del proyecto sigue arrancando**

Run: `npm run typecheck --prefix front`
Expected: sin errores (todavía no se usa la librería en ningún fichero, este paso solo confirma que la instalación no rompió nada).

- [ ] **Step 3: Commit**

```bash
git add front/package.json front/package-lock.json
git commit -m "chore(front): add @dnd-kit for the Issues drag-to-reorder list"
```

---

### Task 5: `IssuesPage` — lista arrastrable

**Files:**
- Create: `front/src/pages/IssuesPage.tsx`
- Test: `front/src/pages/IssuesPage.test.tsx`

**Interfaces:**
- Consumes: `issuesApi` y `reorderIds` de Task 3, `@dnd-kit/core`/`@dnd-kit/sortable`/`@dnd-kit/utilities` de Task 4, `tenantApi`/`TenantMember` de `front/src/lib/tenantApi.ts` (ya existe, usado igual que en `RocksBoard.tsx`), `AppLayout` de `front/src/components/AppLayout.tsx`, `useAuthStore` de `front/src/store/authStore.ts`, `IssueFormModal` de Task 6 (este task escribe la página asumiendo que el modal ya existe con la interfaz declarada abajo — si Task 6 aún no se ha ejecutado, este task NO puede cerrarse: son interdependientes, mira la nota al final de este task).
- Produces: componente `IssuesPage` — usado por Task 7 (`App.tsx`, `AppLayout.tsx`).

**Nota de secuencia:** `IssuesPage` importa `IssueFormModal` (Task 6) y `IssueFormModal` no depende de `IssuesPage` — por eso Task 6 va primero en la ejecución real aunque aparezca después en este documento. Ejecuta **Task 6 antes que Task 5** al correr el plan (el brief de cada task ya lo advierte).

- [ ] **Step 1: Escribir el test de la página**

```typescript
// front/src/pages/IssuesPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { IssuesPage } from './IssuesPage';

vi.mock('../lib/issuesApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/issuesApi')>('../lib/issuesApi');
  return {
    ...actual,
    issuesApi: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
    },
  };
});

vi.mock('../lib/tenantApi', () => ({
  tenantApi: { listMembers: vi.fn() },
}));

const issues = [
  {
    id: 'issue-1',
    tenantId: 'tenant-1',
    title: 'Onboarding lento',
    description: null,
    raisedByUserId: 'user-1',
    status: 'open' as const,
    priority: 'high' as const,
    sortOrder: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
    resolvedAt: null,
    resolutionNotes: null,
  },
  {
    id: 'issue-2',
    tenantId: 'tenant-1',
    title: 'Falta doc de API',
    description: null,
    raisedByUserId: 'user-1',
    status: 'discussing' as const,
    priority: 'medium' as const,
    sortOrder: 1,
    createdAt: '2026-07-02T00:00:00.000Z',
    resolvedAt: null,
    resolutionNotes: null,
  },
];

describe('IssuesPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
    const { issuesApi } = await import('../lib/issuesApi');
    const { tenantApi } = await import('../lib/tenantApi');
    vi.mocked(issuesApi.list).mockResolvedValue(issues as never);
    vi.mocked(tenantApi.listMembers).mockResolvedValue([
      { userId: 'user-1', fullName: 'Pablo', email: 'me@example.com' },
    ]);
  });

  it('lists issues ordered by sortOrder', async () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());
    const rows = screen.getAllByRole('row').slice(1); // descarta la fila de cabecera
    expect(rows[0]).toHaveTextContent('Onboarding lento');
    expect(rows[1]).toHaveTextContent('Falta doc de API');
  });

  it('filters by status', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(issuesApi.list).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByLabelText('Estado'));
    await userEvent.click(await screen.findByText('Discussing'));

    await waitFor(() => expect(issuesApi.list).toHaveBeenCalledWith({ status: 'discussing' }));
  });

  it('redirects to /login when there is no token', () => {
    useAuthStore.setState({ token: null });
    render(
      <MemoryRouter initialEntries={['/issues']}>
        <IssuesPage />
      </MemoryRouter>
    );
    expect(screen.queryByText(/issues/i)).not.toBeInTheDocument();
  });

  it('does not crash when the user logs out while the page is mounted', async () => {
    render(
      <MemoryRouter initialEntries={['/issues']}>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());

    expect(() => {
      useAuthStore.getState().logout();
    }).not.toThrow();

    await waitFor(() => expect(screen.queryByText('Onboarding lento')).not.toBeInTheDocument());
  });

  it('opens the modal in edit mode when a title is clicked', async () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Onboarding lento'));

    expect(await screen.findByText('Editar issue')).toBeInTheDocument();
  });

  it('opens the modal in create mode when "Nuevo issue" is clicked', async () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /nuevo issue/i }));

    expect(await screen.findByText('Nuevo issue', { selector: '.ant-modal-title' })).toBeInTheDocument();
  });

  it('refetches the list when the modal reports a save', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(issuesApi.list).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByText('Onboarding lento'));
    expect(await screen.findByText('Editar issue')).toBeInTheDocument();

    vi.mocked(issuesApi.update).mockResolvedValue(issues[0] as never);
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(issuesApi.list).toHaveBeenCalledTimes(2));
  });

  it('mounts the drag context without crashing', async () => {
    render(
      <MemoryRouter>
        <IssuesPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Onboarding lento')).toBeInTheDocument());
    // La simulación real de puntero de @dnd-kit no es fiable bajo jsdom — la lógica de
    // reordenación en sí ya está cubierta al 100% por front/src/lib/reorder.test.ts. Este
    // test solo confirma que el DndContext/SortableContext/fila arrastrable renderizan sin
    // lanzar, que es el único riesgo real de integración que este componente añade.
    expect(screen.getAllByLabelText('Arrastrar para reordenar')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Ejecutar para comprobar que falla**

Run: `npm test --prefix front -- IssuesPage.test`
Expected: FAIL — `Cannot find module './IssuesPage'`.

- [ ] **Step 3: Implementar la página**

```tsx
// front/src/pages/IssuesPage.tsx
import { MenuOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, message, Select, Space, Table, Tag, Typography } from 'antd';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { IssueFormModal } from '../components/IssueFormModal';
import { issuesApi, type Issue, type IssueStatus } from '../lib/issuesApi';
import { reorderIds } from '../lib/reorder';
import { tenantApi, type TenantMember } from '../lib/tenantApi';
import { useAuthStore } from '../store/authStore';

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  discussing: 'Discussing',
  solved: 'Solved',
  dropped: 'Dropped',
};

const PRIORITY_LABEL: Record<Issue['priority'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

interface RowContextProps {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: SyntheticListenerMap;
}

const RowContext = createContext<RowContextProps>({});

function DragHandle() {
  const { setActivatorNodeRef, listeners } = useContext(RowContext);
  return (
    <MenuOutlined
      ref={setActivatorNodeRef}
      aria-label="Arrastrar para reordenar"
      style={{ touchAction: 'none', cursor: 'grab' }}
      {...listeners}
    />
  );
}

function DraggableRow(props: HTMLAttributes<HTMLTableRowElement> & { 'data-row-key': string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
  });
  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999 } : {}),
  };
  const contextValue = useMemo(() => ({ setActivatorNodeRef, listeners }), [setActivatorNodeRef, listeners]);
  return (
    <RowContext.Provider value={contextValue}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes} />
    </RowContext.Provider>
  );
}

export function IssuesPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | undefined>(undefined);
  const [modalIssue, setModalIssue] = useState<Issue | 'new' | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function refetchIssues() {
    return issuesApi
      .list(statusFilter ? { status: statusFilter } : {})
      .then(setIssues)
      .catch((e) => message.error(errorMessage(e)));
  }

  useEffect(() => {
    refetchIssues();
  }, [statusFilter, activeTenantId]);

  useEffect(() => {
    tenantApi
      .listMembers()
      .then(setMembers)
      .catch((e) => message.error(errorMessage(e)));
  }, [activeTenantId]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = issues.map((issue) => issue.id);
    const newIds = reorderIds(ids, String(active.id), String(over.id));
    const previous = issues;
    setIssues(newIds.map((id) => issues.find((issue) => issue.id === id)!));
    issuesApi.reorder(newIds).catch((e) => {
      message.error(errorMessage(e));
      setIssues(previous);
    });
  }

  if (!token) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;

  const columns = [
    { title: '', key: 'drag', width: 32, render: () => <DragHandle /> },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, issue: Issue) => <a onClick={() => setModalIssue(issue)}>{title}</a>,
    },
    { title: 'Prioridad', dataIndex: 'priority', key: 'priority', render: (p: Issue['priority']) => PRIORITY_LABEL[p] },
    { title: 'Estado', dataIndex: 'status', key: 'status', render: (s: IssueStatus) => <Tag>{STATUS_LABEL[s]}</Tag> },
    {
      title: 'Owner',
      key: 'owner',
      render: (_: unknown, issue: Issue) => members.find((m) => m.userId === issue.raisedByUserId)?.fullName ?? '—',
    },
  ];

  return (
    <AppLayout title="Issues">
      <Space style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Issues
        </Typography.Title>
        <Select
          allowClear
          aria-label="Estado"
          placeholder="Estado"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={(Object.keys(STATUS_LABEL) as IssueStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        <Button type="primary" onClick={() => setModalIssue('new')}>
          Nuevo issue
        </Button>
      </Space>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <Table
            className="glass-panel"
            components={{ body: { row: DraggableRow } }}
            dataSource={issues}
            columns={columns}
            rowKey="id"
            pagination={false}
          />
        </SortableContext>
      </DndContext>

      {modalIssue && (
        <IssueFormModal
          open
          issue={modalIssue === 'new' ? undefined : modalIssue}
          members={members}
          onClose={() => setModalIssue(null)}
          onSaved={() => {
            setModalIssue(null);
            refetchIssues();
          }}
        />
      )}
    </AppLayout>
  );
}
```

Todos los hooks (`useAuthStore` ×3, `useState` ×4, `useSensors`) están declarados antes de los
dos guards (`if (!token)`, `if (user?.mustChangePassword)`) — sigue el mismo orden que
`RocksBoard.tsx`/`ScorecardPage.tsx`. `handleDragEnd` y `refetchIssues` son funciones normales
declaradas en el cuerpo del componente, no hooks — no rompen la regla.

- [ ] **Step 4: Ejecutar**

Run: `npm test --prefix front -- IssuesPage.test`
Expected: PASS.

- [ ] **Step 5: Typecheck y lint**

Run: `npm run typecheck --prefix front && npm run lint --prefix front`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add front/src/pages/IssuesPage.tsx front/src/pages/IssuesPage.test.tsx
git commit -m "feat(front): add IssuesPage with drag-to-reorder list via dnd-kit"
```

---

### Task 6: `IssueFormModal`

**Files:**
- Create: `front/src/components/IssueFormModal.tsx`
- Test: `front/src/components/IssueFormModal.test.tsx`

**Interfaces:**
- Consumes: `issuesApi` de Task 3, `TenantMember` de `front/src/lib/tenantApi.ts`.
- Produces: componente `IssueFormModal` con props `{ open: boolean; issue?: Issue; members: TenantMember[]; onClose: () => void; onSaved: () => void }` — la interfaz exacta que `IssuesPage.tsx` (Task 5) ya asume. **Ejecuta este task antes que Task 5** — `IssuesPage.tsx` importa este componente.

- [ ] **Step 1: Escribir el test**

```typescript
// front/src/components/IssueFormModal.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueFormModal } from './IssueFormModal';

vi.mock('../lib/issuesApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/issuesApi')>('../lib/issuesApi');
  return {
    ...actual,
    issuesApi: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  };
});

const members = [{ userId: 'user-1', fullName: 'Pablo', email: 'me@example.com' }];

const existingIssue = {
  id: 'issue-1',
  tenantId: 'tenant-1',
  title: 'Onboarding lento',
  description: null,
  raisedByUserId: 'user-1',
  status: 'open' as const,
  priority: 'high' as const,
  sortOrder: 0,
  createdAt: '2026-07-01T00:00:00.000Z',
  resolvedAt: null,
  resolutionNotes: null,
};

describe('IssueFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an issue with the entered fields', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    vi.mocked(issuesApi.create).mockResolvedValue(existingIssue as never);
    const onSaved = vi.fn();

    render(<IssueFormModal open members={members} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/título/i), 'Nuevo issue');
    await userEvent.click(screen.getByLabelText('Owner'));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(issuesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Nuevo issue', raisedByUserId: 'user-1' })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('pre-fills the form when editing and shows the status field', async () => {
    render(<IssueFormModal open issue={existingIssue} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText(/título/i)).toHaveValue('Onboarding lento');
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
  });

  it('updates status on save when editing', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    vi.mocked(issuesApi.update).mockResolvedValue(existingIssue as never);

    render(<IssueFormModal open issue={existingIssue} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByLabelText('Estado'));
    await userEvent.click(await screen.findByText('Solved'));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(issuesApi.update).toHaveBeenCalledWith('issue-1', expect.objectContaining({ status: 'solved' }))
    );
  });

  it('deletes the issue after confirming', async () => {
    const { issuesApi } = await import('../lib/issuesApi');
    vi.mocked(issuesApi.remove).mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<IssueFormModal open issue={existingIssue} members={members} onClose={onClose} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole('button', { name: /borrar/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));

    await waitFor(() => expect(issuesApi.remove).toHaveBeenCalledWith('issue-1'));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not show the delete button in create mode', () => {
    render(<IssueFormModal open members={members} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /borrar/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar para comprobar que falla**

Run: `npm test --prefix front -- IssueFormModal.test`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar**

```tsx
// front/src/components/IssueFormModal.tsx
import { Button, Form, Input, message, Modal, Popconfirm, Select } from 'antd';
import { useEffect, useState } from 'react';
import { issuesApi, type Issue, type IssuePriority, type IssueStatus } from '../lib/issuesApi';
import type { TenantMember } from '../lib/tenantApi';

export interface IssueFormModalProps {
  open: boolean;
  issue?: Issue;
  members: TenantMember[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  title: string;
  description?: string;
  raisedByUserId: string;
  priority: IssuePriority;
  status?: IssueStatus;
  resolutionNotes?: string;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export function IssueFormModal({ open, issue, members, onClose, onSaved }: IssueFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue(issue ?? { priority: 'medium' });
  }, [issue, form]);

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      if (issue) {
        await issuesApi.update(issue.id, values);
      } else {
        await issuesApi.create(values);
      }
      onSaved();
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!issue) return;
    try {
      await issuesApi.remove(issue.id);
      onSaved();
      onClose();
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={issue ? 'Editar issue' : 'Nuevo issue'} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="title" label="Título" rules={[{ required: true, message: 'Introduce un título' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Descripción">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="raisedByUserId" label="Owner" rules={[{ required: true, message: 'Elige un owner' }]}>
          <Select
            aria-label="Owner"
            options={members.map((member) => ({ value: member.userId, label: member.fullName }))}
          />
        </Form.Item>
        <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
          <Select
            aria-label="Prioridad"
            options={[
              { value: 'low', label: 'Baja' },
              { value: 'medium', label: 'Media' },
              { value: 'high', label: 'Alta' },
            ]}
          />
        </Form.Item>
        {issue && (
          <Form.Item name="status" label="Estado">
            <Select
              aria-label="Estado"
              options={[
                { value: 'open', label: 'Open' },
                { value: 'discussing', label: 'Discussing' },
                { value: 'solved', label: 'Solved' },
                { value: 'dropped', label: 'Dropped' },
              ]}
            />
          </Form.Item>
        )}
        {issue && (
          <Form.Item name="resolutionNotes" label="Notas de resolución">
            <Input.TextArea rows={2} />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" loading={saving} block>
          Guardar
        </Button>
      </Form>

      {issue && (
        <div style={{ marginTop: 24 }}>
          <Popconfirm
            title="¿Borrar este issue? Esta acción no se puede deshacer."
            onConfirm={handleDelete}
            okText="Borrar"
            cancelText="Cancelar"
          >
            <Button danger block>
              Borrar
            </Button>
          </Popconfirm>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 4: Ejecutar**

Run: `npm test --prefix front -- IssueFormModal.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/components/IssueFormModal.tsx front/src/components/IssueFormModal.test.tsx
git commit -m "feat(front): add IssueFormModal for create/edit/delete"
```

---

### Task 7: Nav + ruta `/issues`

**Files:**
- Modify: `front/src/components/AppLayout.tsx`
- Modify: `front/src/App.tsx`

**Interfaces:**
- Consumes: `IssuesPage` de Task 5.

- [ ] **Step 1: Añadir la entrada de navegación**

En `front/src/components/AppLayout.tsx`, en el array `NAV_ITEMS` (línea 8-13 actual), añadir después de la entrada de Scorecard:

```tsx
{ key: '/issues', label: <Link to="/issues">Issues</Link> },
```

- [ ] **Step 2: Añadir la ruta**

En `front/src/App.tsx`, junto al resto de imports de páginas:

```tsx
import { IssuesPage } from './pages/IssuesPage';
```

Y junto al resto de `<Route>` (después de la de `/scorecard`):

```tsx
<Route path="/issues" element={<IssuesPage />} />
```

- [ ] **Step 3: Verificación manual — arrancar el dev server y comprobar la navegación**

Run: `npm run dev` (desde la raíz del repo)
Expected: en `http://localhost:5173`, tras hacer login, el menú superior muestra "Issues" y navega
a `/issues` mostrando la tabla (vacía o con los issues del seed). Cerrar el servidor tras
confirmar (Ctrl+C) — no lo dejes corriendo en segundo plano al terminar el task.

- [ ] **Step 4: Tests existentes de `AppLayout`/`App` siguen pasando**

Run: `npm test --prefix front -- AppLayout`
Expected: PASS (si `AppLayout.test.tsx` verifica la lista completa de `NAV_ITEMS`, actualízalo
para incluir "Issues" — mira cómo se hizo para "Scorecard" en el mismo fichero y replica el
mismo patrón).

- [ ] **Step 5: Commit**

```bash
git add front/src/components/AppLayout.tsx front/src/App.tsx front/src/components/AppLayout.test.tsx
git commit -m "feat(front): wire Issues into nav and routing"
```

---

### Task 8: `issues.README.md`

**Files:**
- Create: `server/src/routes/issues.README.md`

**Interfaces:**
- Ninguna — documentación pura, mismo formato que `server/src/routes/scorecard.README.md` y `server/src/routes/rocks.README.md`.

- [ ] **Step 1: Escribir el fichero**

```markdown
# Issues (IDS)

## Qué hace

Lista de Identify-Discuss-Solve de EOS: cada Issue tiene un título, descripción opcional,
prioridad, estado y un owner (`raisedByUserId`). El orden de la lista es manual (drag-to-reorder
en el frontend), persistido en `sortOrder` — no tiene relación con `priority`, son dos conceptos
independientes: `priority` es una etiqueta informativa, `sortOrder` es la posición real en la
lista de trabajo del equipo. Todas las rutas requieren `Authorization: Bearer <token>` y
`X-Tenant-Id` (ver `auth.README.md` — "Tenant context").

- `GET /issues?status=open|discussing|solved|dropped` — lista los issues del tenant activo,
  ordenados por `sortOrder` ascendente. Omitir `status` devuelve todos.
- `POST /issues` — crea un issue. Body: `{ title, description?, raisedByUserId, priority? }`.
  `priority` es `low`/`medium`/`high`, por defecto `medium`. El nuevo issue se añade al final de
  la lista (`sortOrder` = máximo actual del tenant + 1).
- `PATCH /issues/:id` — actualiza cualquier subconjunto de `title`, `description`,
  `raisedByUserId`, `priority`, `status`, `resolutionNotes`. Cambiar `status` a `solved` o
  `dropped` fija `resolvedAt` a la fecha actual automáticamente; volver a `open`/`discussing` lo
  limpia a `null`. No hay máquina de estados — cualquier transición es válida (ver "Sin máquina
  de estados" más abajo).
- `DELETE /issues/:id` — 204 en éxito, 404 si no existía.
- `PATCH /issues/reorder` — body `{ orderedIds: string[] }`, reasigna `sortOrder` = posición en
  el array para cada id (0-indexado) y devuelve la lista completa ya reordenada. Un id que no
  pertenezca al tenant activo se ignora silenciosamente (0 filas afectadas, sin error) — el
  `where: { id, tenantId }` de cada `updateMany` hace imposible que un array manipulado desde el
  cliente reordene o filtre datos de otro tenant.

## Sin máquina de estados

A diferencia de lo que podría sugerir "Identify → Discuss → Solve", el backend no valida que la
transición de `status` sea alcanzable desde el estado actual (igual que el `status` de un Rock).
La metodología EOS real permite resolver un issue directamente sin pasar por una discusión
formal — inventar esa restricción habría sido una regla que nadie pidió (YAGNI).

## Permisos

Sin ACL por rol, igual que Rocks y Scorecard: cualquier miembro del tenant puede crear/editar/
borrar/reordenar cualquier issue.

## Frontend

`front/src/lib/issuesApi.ts` envuelve estos endpoints. `front/src/lib/reorder.ts` exporta
`reorderIds`, la función pura que calcula el nuevo orden local tras un drag (independiente de
`@dnd-kit`, testeada sin él). `front/src/pages/IssuesPage.tsx` es la tabla arrastrable
(`@dnd-kit/core` + `@dnd-kit/sortable`, con `PATCH /issues/reorder` disparado al soltar).
`front/src/components/IssueFormModal.tsx` es el formulario de crear/editar/borrar.

## Cómo probarlo manualmente

\`\`\`bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD>"}' | jq -r .token)

curl http://localhost/api/issues \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: <tenantId de Tasvalor>"
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/issues.README.md
git commit -m "docs: add issues.README.md"
```

---

### Task 9: Verificación final

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Backend — typecheck, lint, test, cobertura**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm test --prefix server -- --coverage`
Expected: typecheck y lint limpios (o solo los 2 errores pre-existentes de Sprint 1 ya conocidos,
sin errores nuevos); todos los tests pasan; `IssueRepository.ts`/`routes/issues.ts` con cobertura
≥80% líneas/funciones/statements, ≥70% branches (umbrales de `server/vitest.config.ts`).

- [ ] **Step 2: Frontend — typecheck, lint, test, cobertura**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm test --prefix front -- --coverage`
Expected: typecheck y lint limpios; todos los tests pasan, incluidos los de `reorder.ts`,
`issuesApi.ts`, `IssuesPage.tsx`, `IssueFormModal.tsx`.

- [ ] **Step 3: Comprobación manual de aislamiento multitenant**

Con el dev server levantado (`npm run dev` en la raíz) y las dos seeds de Tasvalor/Cionet ya
creadas (Sprint 0), confirma en el navegador que un usuario con la sesión activa en Tasvalor no
ve los issues de Cionet en `/issues` (cambia de tenant con el `TenantSwitcher` y verifica que la
lista cambia por completo). Esta comprobación es manual porque requiere las credenciales reales
de la base de datos de desarrollo — no delegable a un subagente.

- [ ] **Step 4: Actualizar el roadmap**

En `docs/superpowers/plans/2026-07-30-eos-tool-roadmap.md`, marcar Sprint 4 como hecho en el
bloque de estado (línea 11-16) siguiendo el mismo formato usado para Sprint 2 y Sprint 3, y en la
sección "5. Sprint 4 — Issues List (IDS)" añadir un `✅ hecho` al título con el resumen de
resultado (tests, cobertura, decisiones tomadas: `sortOrder` con migración, `@dnd-kit`, sin
máquina de estados).
