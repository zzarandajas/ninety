# Sprint 2 — Rocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de Rocks (empresa e individuales) con Milestones anidados, filtrables por trimestre y owner, con una vista Kanban (on_track/off_track/done) en el frontend — end-to-end, tenant-aware, con tests y cobertura.

**Architecture:** Backend Fastify: dos repositorios tenant-aware nuevos (`RockRepository`, `MilestoneRepository`) siguiendo el patrón de CLAUDE.md §4 (constructor con `tenantId`, todo `where` lo inyecta, updates/deletes vía `updateMany`/`deleteMany`), un route file (`routes/rocks.ts`) con `app.authenticate` + `resolveTenantContext` como preHandlers globales del plugin. Un endpoint auxiliar mínimo (`GET /tenant/members`) desbloquea el selector de owner sin esperar a Sprint 1. Frontend: se extrae `AppLayout` (header compartido) de `DashboardPage`, y se añade `RocksBoard` (Kanban con filtros) + `RockFormModal` (crear/editar Rock + Milestones inline), consumiendo un `rocksApi.ts` tipado sobre el `apiFetch` ya existente (al que hay que añadirle soporte de 204 No Content, primer DELETE del proyecto).

**Tech Stack:** Fastify, Prisma, Zod, Vitest (backend ya existente) + React, Ant Design, Zustand, React Router, Vitest + React Testing Library (frontend ya existente). Sin dependencias nuevas.

## Global Constraints

- Multitenancy golden rule (CLAUDE.md §4): ningún controller/route llama `prisma.<modelo>.findMany/create/update/delete` directamente para Rock, Milestone o TenantMembership — todo pasa por un repositorio tenant-aware construido con `tenantId`.
- Toda ruta de este plan registra `app.authenticate` y `resolveTenantContext` (en ese orden) como preHandlers — usa `app.addHook('preHandler', ...)` a nivel de plugin, no repetido ruta por ruta.
- Repositorios: updates/deletes usan `prisma.<modelo>.updateMany`/`deleteMany` con `{ id, tenantId }` en el `where`, comprobando `result.count === 0` para devolver `null`/`false` en vez de dejar que Prisma lance una excepción `P2025` — evita try/catch innecesario en el route.
- Sin ACL granular por rol dentro del tenant: cualquier miembro autenticado del tenant puede crear/editar/borrar cualquier Rock o Milestone de ese tenant. Herramienta interna de confianza (2-10 personas por tenant) — no se pidió control de permisos por rol en este sprint, no se añade (YAGNI).
- `GET /tenant/members` es una lectura mínima (`userId`, `fullName`, `email`) para alimentar el selector de owner — no crea ni edita membership, no pisa el alcance de Sprint 1 (que sí gestionará invitaciones/seats). Si Sprint 1 termina con un endpoint equivalente, se revisa y fusiona entonces, no ahora.
- Testing: unit tests con Prisma mockeado (`vi.mock('../lib/prisma.js', ...)`), sin DB real. Cobertura con `@vitest/coverage-v8`; `server/vitest.config.ts` debe incluir `src/repositories/**` en `coverage.include` (hoy no lo incluye — se corrige en Task 2) para que `RockRepository`/`MilestoneRepository` cuenten.
- Documentación: `server/src/routes/rocks.README.md` al final del sprint, siguiendo el formato de `server/src/routes/auth.README.md` (qué hace, no cómo está implementado).
- Diseño: `docs/DESIGN_BRIEF.md` — Rocks como `glass-panel` agrupados por columna de estado sobre el fondo con gradiente (`--app-bg-gradient`), usar `ui-ux-pro-max` skill si está disponible en el entorno del implementador para el pulido de `RocksBoard`/`RockFormModal` (loading states, empty states, confirmación de borrado).
- Git: nadie hace `git commit` salvo el usuario (CLAUDE.md / regla del usuario) — los pasos "Commit" de cada tarea describen lo que hace el controlador entre tareas (snapshot no destructivo), no una instrucción para el implementador.
- Fechas: el schema usa `DateTime` para `Rock.dueDate` y `Milestone.dueDate` — el body JSON llega como string ISO, los schemas Zod usan `z.coerce.date()` para convertir.
- Formato de trimestre: string `"YYYY-Qn"` (ej. `"2026-Q3"`), validado con regex `^\d{4}-Q[1-4]$` — ya es el formato usado en `server/prisma/seed.ts`, no inventar otro.

---

## Task 1: `GET /tenant/members` — lectura mínima de miembros del tenant activo

**Files:**
- Create: `server/src/repositories/TenantMemberRepository.ts`
- Create: `server/src/routes/tenant.ts`
- Modify: `server/src/app.ts` (registrar `tenantRoutes` bajo `/tenant`)
- Modify: `server/vitest.config.ts` (añadir `src/repositories/**` a `coverage.include`)
- Test: `server/src/repositories/TenantMemberRepository.test.ts`
- Test: `server/src/routes/tenant.test.ts`

**Interfaces:**
- Consumes: `prisma` (`lib/prisma.ts`), `app.authenticate` (`plugins/jwt.ts`), `resolveTenantContext` (`middleware/resolveTenantContext.ts`).
- Produces: `TenantMemberRepository.findAll(): Promise<{ userId: string; fullName: string; email: string }[]>` — usado por Task 9 (`RockFormModal`, selector de owner) vía `GET /tenant/members` → `200 TenantMember[]`. Ruta requiere Bearer token + `X-Tenant-Id` válidos (401/400/403 heredados de los preHandlers).

- [ ] **Step 1: Añadir `src/repositories/**` a la cobertura de Vitest**

En `server/vitest.config.ts`, cambia la línea `include`:

```ts
      include: [
        'src/lib/**',
        'src/config/**',
        'src/plugins/**',
        'src/middleware/**',
        'src/routes/**',
        'src/repositories/**',
        'src/app.ts',
      ],
```

- [ ] **Step 2: Write the failing test — `server/src/repositories/TenantMemberRepository.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: {
      findMany: vi.fn(),
    },
  },
}));

describe('TenantMemberRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAll scopes by tenantId and maps to userId/fullName/email', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      {
        id: 'mem-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        seatId: null,
        user: { id: 'user-1', fullName: 'Pablo', email: 'correopro@gmail.com' },
      },
    ] as never);

    const { TenantMemberRepository } = await import('./TenantMemberRepository.js');
    const repo = new TenantMemberRepository('tenant-1');
    const members = await repo.findAll();

    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } })
    );
    expect(members).toEqual([{ userId: 'user-1', fullName: 'Pablo', email: 'correopro@gmail.com' }]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test --prefix server -- TenantMemberRepository.test`
Expected: FAIL — `Cannot find module './TenantMemberRepository.js'`.

- [ ] **Step 4: Implement `server/src/repositories/TenantMemberRepository.ts`**

```ts
import { prisma } from '../lib/prisma.js';

export interface TenantMember {
  userId: string;
  fullName: string;
  email: string;
}

export class TenantMemberRepository {
  constructor(private tenantId: string) {}

  async findAll(): Promise<TenantMember[]> {
    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId: this.tenantId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { user: { fullName: 'asc' } },
    });

    return memberships.map((membership) => ({
      userId: membership.user.id,
      fullName: membership.user.fullName,
      email: membership.user.email,
    }));
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --prefix server -- TenantMemberRepository.test`
Expected: PASS, 1 test green.

- [ ] **Step 6: Write the failing test — `server/src/routes/tenant.test.ts`**

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('tenant routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /tenant/members requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/tenant/members' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /tenant/members requires X-Tenant-Id', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/tenant/members',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('GET /tenant/members returns 403 without a valid membership', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(null);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/tenant/members',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('GET /tenant/members returns the member list for a valid tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'owner',
      seatId: null,
    } as never);
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      {
        id: 'mem-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        seatId: null,
        user: { id: 'user-1', fullName: 'Pablo', email: 'correopro@gmail.com' },
      },
    ] as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/tenant/members',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ userId: 'user-1', fullName: 'Pablo', email: 'correopro@gmail.com' }]);
    await app.close();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm run test --prefix server -- routes/tenant.test`
Expected: FAIL — route `/tenant/members` not found (404), module `routes/tenant.ts` doesn't exist yet.

- [ ] **Step 8: Implement `server/src/routes/tenant.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { TenantMemberRepository } from '../repositories/TenantMemberRepository.js';

export default async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', resolveTenantContext);

  app.get('/members', async (request) => {
    const repo = new TenantMemberRepository(request.tenantId as string);
    return repo.findAll();
  });
}
```

- [ ] **Step 9: Register the routes in `server/src/app.ts`**

Añade el import y el `register` junto a los existentes:

```ts
import tenantRoutes from './routes/tenant.js';
// ...
  await app.register(tenantRoutes, { prefix: '/tenant' });
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm run test --prefix server -- routes/tenant.test`
Expected: PASS, 4 tests green.

- [ ] **Step 11: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test:coverage --prefix server`
Expected: all exit code 0; `src/repositories/TenantMemberRepository.ts` aparece en el reporte de cobertura.

- [ ] **Step 12: Commit**

```bash
git add server/src/repositories/TenantMemberRepository.ts server/src/repositories/TenantMemberRepository.test.ts server/src/routes/tenant.ts server/src/routes/tenant.test.ts server/src/app.ts server/vitest.config.ts
git commit -m "feat(server): add GET /tenant/members for owner selection"
```

---

## Task 2: `RockRepository`

**Files:**
- Create: `server/src/repositories/RockRepository.ts`
- Test: `server/src/repositories/RockRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` (`lib/prisma.ts`).
- Produces: class `RockRepository`, `constructor(private tenantId: string)`, methods:
  - `findAll(filters?: { quarter?: string; ownerUserId?: string }): Promise<Rock[]>` (incluye `milestones`, `orderBy: { createdAt: 'asc' }`)
  - `findById(id: string): Promise<Rock | null>` (incluye `milestones`)
  - `create(data: CreateRockInput): Promise<Rock>` — `CreateRockInput = { title: string; description?: string; ownerUserId: string; quarter: string; isCompanyRock: boolean; dueDate: Date }`
  - `update(id: string, data: UpdateRockInput): Promise<Rock | null>` — `UpdateRockInput = Partial<CreateRockInput> & { status?: RockStatus }`, `null` si no existe en el tenant
  - `delete(id: string): Promise<boolean>`
  Usado por Task 4 (`routes/rocks.ts`).

- [ ] **Step 1: Write the failing test — `server/src/repositories/RockRepository.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    rock: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const baseRock = {
  id: 'rock-1',
  tenantId: 'tenant-1',
  title: 'Lanzar módulo de Scorecard',
  description: null,
  ownerUserId: 'user-1',
  quarter: '2026-Q3',
  isCompanyRock: true,
  status: 'on_track',
  createdAt: new Date('2026-07-01'),
  dueDate: new Date('2026-09-30'),
  milestones: [],
};

describe('RockRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAll scopes by tenantId and applies optional filters', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.findMany).mockResolvedValue([baseRock] as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.findAll({ quarter: '2026-Q3', ownerUserId: 'user-1' });

    expect(prisma.rock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', quarter: '2026-Q3', ownerUserId: 'user-1' },
      })
    );
    expect(result).toEqual([baseRock]);
  });

  it('findAll with no filters only scopes by tenantId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.findMany).mockResolvedValue([] as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    await repo.findAll();

    expect(prisma.rock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } })
    );
  });

  it('findById scopes by tenantId, returns null when not found', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.findFirst).mockResolvedValue(null);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.findById('missing');

    expect(prisma.rock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'missing', tenantId: 'tenant-1' } })
    );
    expect(result).toBeNull();
  });

  it('create injects tenantId into the data', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.create).mockResolvedValue(baseRock as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    await repo.create({
      title: 'Lanzar módulo de Scorecard',
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: true,
      dueDate: new Date('2026-09-30'),
    });

    expect(prisma.rock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', title: 'Lanzar módulo de Scorecard' }),
    });
  });

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

  it('update returns the fresh row when a row matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.rock.findFirst).mockResolvedValue({ ...baseRock, status: 'done' } as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.update('rock-1', { status: 'done' });

    expect(result).toEqual({ ...baseRock, status: 'done' });
  });

  it('delete scopes by tenantId and returns false when nothing matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.deleteMany).mockResolvedValue({ count: 0 });

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.delete('missing');

    expect(prisma.rock.deleteMany).toHaveBeenCalledWith({ where: { id: 'missing', tenantId: 'tenant-1' } });
    expect(result).toBe(false);
  });

  it('delete returns true when a row was removed', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.deleteMany).mockResolvedValue({ count: 1 });

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.delete('rock-1');

    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix server -- RockRepository.test`
Expected: FAIL — `Cannot find module './RockRepository.js'`.

- [ ] **Step 3: Implement `server/src/repositories/RockRepository.ts`**

```ts
import type { Rock, RockStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface RockFilters {
  quarter?: string;
  ownerUserId?: string;
}

export interface CreateRockInput {
  title: string;
  description?: string;
  ownerUserId: string;
  quarter: string;
  isCompanyRock: boolean;
  dueDate: Date;
}

export type UpdateRockInput = Partial<CreateRockInput> & { status?: RockStatus };

export class RockRepository {
  constructor(private tenantId: string) {}

  findAll(filters: RockFilters = {}): Promise<Rock[]> {
    return prisma.rock.findMany({
      where: {
        tenantId: this.tenantId,
        ...(filters.quarter ? { quarter: filters.quarter } : {}),
        ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      },
      include: { milestones: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<Rock | null> {
    return prisma.rock.findFirst({
      where: { id, tenantId: this.tenantId },
      include: { milestones: true },
    });
  }

  create(data: CreateRockInput): Promise<Rock> {
    return prisma.rock.create({ data: { ...data, tenantId: this.tenantId } });
  }

  async update(id: string, data: UpdateRockInput): Promise<Rock | null> {
    const result = await prisma.rock.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.rock.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix server -- RockRepository.test`
Expected: PASS, 8 tests green.

- [ ] **Step 5: Verify typecheck and lint**

Run: `npm run typecheck --prefix server && npm run lint --prefix server`
Expected: both exit code 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/repositories/RockRepository.ts server/src/repositories/RockRepository.test.ts
git commit -m "feat(server): add tenant-aware RockRepository"
```

---

## Task 3: `MilestoneRepository`

**Files:**
- Create: `server/src/repositories/MilestoneRepository.ts`
- Test: `server/src/repositories/MilestoneRepository.test.ts`

**Interfaces:**
- Consumes: `prisma` (`lib/prisma.ts`).
- Produces: class `MilestoneRepository`, `constructor(private tenantId: string)`, methods:
  - `findAllForRock(rockId: string): Promise<Milestone[]>`
  - `create(rockId: string, data: CreateMilestoneInput): Promise<Milestone>` — `CreateMilestoneInput = { description: string; dueDate: Date }`
  - `update(id: string, data: UpdateMilestoneInput): Promise<Milestone | null>` — `UpdateMilestoneInput = { description?: string; dueDate?: Date; completedAt?: Date | null }`
  - `delete(id: string): Promise<boolean>`
  Usado por Task 4 (`routes/rocks.ts`). `create` asume que el `rockId` ya se validó como perteneciente al tenant en el route (Task 4) — el FK compuesto `Milestone.rock` (`[rockId, tenantId] -> [id, tenantId]`) del schema Prisma rechazaría a nivel de DB un `rockId` de otro tenant de todas formas, pero el route valida antes para devolver un 404 limpio en vez de un error 500 de constraint.

- [ ] **Step 1: Write the failing test — `server/src/repositories/MilestoneRepository.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    milestone: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const baseMilestone = {
  id: 'milestone-1',
  tenantId: 'tenant-1',
  rockId: 'rock-1',
  description: 'Diseñar el schema',
  dueDate: new Date('2026-08-15'),
  completedAt: null,
};

describe('MilestoneRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAllForRock scopes by rockId and tenantId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.findMany).mockResolvedValue([baseMilestone] as never);

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    const result = await repo.findAllForRock('rock-1');

    expect(prisma.milestone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rockId: 'rock-1', tenantId: 'tenant-1' } })
    );
    expect(result).toEqual([baseMilestone]);
  });

  it('create injects rockId and tenantId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.create).mockResolvedValue(baseMilestone as never);

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    await repo.create('rock-1', { description: 'Diseñar el schema', dueDate: new Date('2026-08-15') });

    expect(prisma.milestone.create).toHaveBeenCalledWith({
      data: {
        description: 'Diseñar el schema',
        dueDate: new Date('2026-08-15'),
        rockId: 'rock-1',
        tenantId: 'tenant-1',
      },
    });
  });

  it('update returns null when no row matched tenant+id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.updateMany).mockResolvedValue({ count: 0 });

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    const result = await repo.update('missing', { completedAt: new Date() });

    expect(result).toBeNull();
  });

  it('update returns the fresh row when a row matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.updateMany).mockResolvedValue({ count: 1 });
    const completed = { ...baseMilestone, completedAt: new Date('2026-08-01') };
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue(completed as never);

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    const result = await repo.update('milestone-1', { completedAt: new Date('2026-08-01') });

    expect(result).toEqual(completed);
  });

  it('delete scopes by tenantId and reports whether a row was removed', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.deleteMany).mockResolvedValue({ count: 1 });

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    const result = await repo.delete('milestone-1');

    expect(prisma.milestone.deleteMany).toHaveBeenCalledWith({
      where: { id: 'milestone-1', tenantId: 'tenant-1' },
    });
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix server -- MilestoneRepository.test`
Expected: FAIL — `Cannot find module './MilestoneRepository.js'`.

- [ ] **Step 3: Implement `server/src/repositories/MilestoneRepository.ts`**

```ts
import type { Milestone } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface CreateMilestoneInput {
  description: string;
  dueDate: Date;
}

export interface UpdateMilestoneInput {
  description?: string;
  dueDate?: Date;
  completedAt?: Date | null;
}

export class MilestoneRepository {
  constructor(private tenantId: string) {}

  findAllForRock(rockId: string): Promise<Milestone[]> {
    return prisma.milestone.findMany({
      where: { rockId, tenantId: this.tenantId },
      orderBy: { dueDate: 'asc' },
    });
  }

  create(rockId: string, data: CreateMilestoneInput): Promise<Milestone> {
    return prisma.milestone.create({ data: { ...data, rockId, tenantId: this.tenantId } });
  }

  async update(id: string, data: UpdateMilestoneInput): Promise<Milestone | null> {
    const result = await prisma.milestone.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (result.count === 0) return null;
    return prisma.milestone.findFirst({ where: { id, tenantId: this.tenantId } });
  }

  async delete(id: string): Promise<boolean> {
    const result = await prisma.milestone.deleteMany({ where: { id, tenantId: this.tenantId } });
    return result.count > 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix server -- MilestoneRepository.test`
Expected: PASS, 5 tests green.

- [ ] **Step 5: Verify typecheck and lint**

Run: `npm run typecheck --prefix server && npm run lint --prefix server`
Expected: both exit code 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/repositories/MilestoneRepository.ts server/src/repositories/MilestoneRepository.test.ts
git commit -m "feat(server): add tenant-aware MilestoneRepository"
```

---

## Task 4: `routes/rocks.ts` — Rock CRUD + nested Milestones

**Files:**
- Create: `server/src/routes/rocks.ts`
- Modify: `server/src/app.ts` (registrar `rockRoutes` bajo `/rocks`)
- Test: `server/src/routes/rocks.test.ts`

**Interfaces:**
- Consumes: `RockRepository` (Task 2), `MilestoneRepository` (Task 3), `app.authenticate`, `resolveTenantContext`.
- Produces:
  - `GET /rocks?quarter=&ownerUserId=` → 200 `Rock[]`
  - `POST /rocks` (body `{ title, description?, ownerUserId, quarter, isCompanyRock, dueDate }`) → 201 `Rock`
  - `GET /rocks/:id` → 200 `Rock` | 404
  - `PATCH /rocks/:id` (body: subconjunto de los campos anteriores + `status`) → 200 `Rock` | 404
  - `DELETE /rocks/:id` → 204 | 404
  - `POST /rocks/:rockId/milestones` (body `{ description, dueDate }`) → 201 `Milestone` | 404 si el rock no existe en el tenant
  - `PATCH /rocks/:rockId/milestones/:id` (body `{ description?, dueDate?, completed? }` — `completed` es azúcar sobre `completedAt`: `true` → `completedAt: new Date()`, `false` → `completedAt: null`) → 200 `Milestone` | 404
  - `DELETE /rocks/:rockId/milestones/:id` → 204 | 404
  Todas requieren `Authorization: Bearer <token>` + `X-Tenant-Id` válidos (401/400/403 vía preHandlers, ya cubiertos por los tests de `resolveTenantContext.test.ts` y `plugins/jwt.test.ts` — este test file no repite esos casos, solo confirma que los hooks están enganchados con un caso 401 y deja el resto a los happy paths).

- [ ] **Step 1: Write the failing test — `server/src/routes/rocks.test.ts`**

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: { findUnique: vi.fn() },
    rock: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    milestone: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const membership = {
  id: 'mem-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'owner',
  seatId: null,
};

const baseRock = {
  id: 'rock-1',
  tenantId: 'tenant-1',
  title: 'Lanzar módulo de Scorecard',
  description: null,
  ownerUserId: 'user-1',
  quarter: '2026-Q3',
  isCompanyRock: true,
  status: 'on_track',
  createdAt: new Date('2026-07-01'),
  dueDate: new Date('2026-09-30'),
  milestones: [],
};

async function authedApp() {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const token = app.jwt.sign({ userId: 'user-1' });
  return { app, headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' } };
}

describe('rocks routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /rocks requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/rocks' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /rocks returns the tenant rock list', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.findMany).mockResolvedValue([baseRock] as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/rocks?quarter=2026-Q3', headers });

    expect(response.statusCode).toBe(200);
    expect(prisma.rock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1', quarter: '2026-Q3' }) })
    );
    await app.close();
  });

  it('POST /rocks validates the body with Zod (400 on invalid quarter)', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/rocks',
      headers,
      payload: {
        title: 'Rock sin trimestre válido',
        ownerUserId: 'user-1',
        quarter: 'not-a-quarter',
        isCompanyRock: false,
        dueDate: '2026-09-30',
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /rocks creates a rock and returns 201', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.create).mockResolvedValue(baseRock as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/rocks',
      headers,
      payload: {
        title: 'Lanzar módulo de Scorecard',
        ownerUserId: 'user-1',
        quarter: '2026-Q3',
        isCompanyRock: true,
        dueDate: '2026-09-30',
      },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('GET /rocks/:id returns 404 when not found in tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.findFirst).mockResolvedValue(null);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/rocks/missing', headers });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('PATCH /rocks/:id updates status and returns 200', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.rock.findFirst).mockResolvedValue({ ...baseRock, status: 'done' } as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/rocks/rock-1',
      headers,
      payload: { status: 'done' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('done');
    await app.close();
  });

  it('DELETE /rocks/:id returns 204 on success', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.deleteMany).mockResolvedValue({ count: 1 });

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'DELETE', url: '/rocks/rock-1', headers });

    expect(response.statusCode).toBe(204);
    await app.close();
  });

  it('DELETE /rocks/:id returns 404 when nothing was removed', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.deleteMany).mockResolvedValue({ count: 0 });

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'DELETE', url: '/rocks/missing', headers });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('POST /rocks/:rockId/milestones returns 404 when the rock does not exist in the tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.findFirst).mockResolvedValue(null);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/rocks/missing/milestones',
      headers,
      payload: { description: 'Diseñar el schema', dueDate: '2026-08-15' },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('POST /rocks/:rockId/milestones creates a milestone and returns 201', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.findFirst).mockResolvedValue(baseRock as never);
    vi.mocked(prisma.milestone.create).mockResolvedValue({
      id: 'milestone-1',
      tenantId: 'tenant-1',
      rockId: 'rock-1',
      description: 'Diseñar el schema',
      dueDate: new Date('2026-08-15'),
      completedAt: null,
    } as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/rocks/rock-1/milestones',
      headers,
      payload: { description: 'Diseñar el schema', dueDate: '2026-08-15' },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('PATCH /rocks/:rockId/milestones/:id maps completed=true to a completedAt timestamp', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.milestone.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue({
      id: 'milestone-1',
      tenantId: 'tenant-1',
      rockId: 'rock-1',
      description: 'Diseñar el schema',
      dueDate: new Date('2026-08-15'),
      completedAt: new Date('2026-08-02'),
    } as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/rocks/rock-1/milestones/milestone-1',
      headers,
      payload: { completed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.milestone.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ completedAt: expect.any(Date) }) })
    );
    await app.close();
  });

  it('DELETE /rocks/:rockId/milestones/:id returns 204 on success', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.milestone.deleteMany).mockResolvedValue({ count: 1 });

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/rocks/rock-1/milestones/milestone-1',
      headers,
    });

    expect(response.statusCode).toBe(204);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix server -- routes/rocks.test`
Expected: FAIL — route `/rocks` not found (404), module `routes/rocks.ts` doesn't exist yet.

- [ ] **Step 3: Implement `server/src/routes/rocks.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolveTenantContext } from '../middleware/resolveTenantContext.js';
import { MilestoneRepository } from '../repositories/MilestoneRepository.js';
import { RockRepository } from '../repositories/RockRepository.js';

const quarterSchema = z.string().regex(/^\d{4}-Q[1-4]$/, 'Formato de trimestre inválido, usa YYYY-Qn');

const createRockSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  ownerUserId: z.string().min(1),
  quarter: quarterSchema,
  isCompanyRock: z.boolean().default(false),
  dueDate: z.coerce.date(),
});

const updateRockSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  ownerUserId: z.string().min(1).optional(),
  quarter: quarterSchema.optional(),
  isCompanyRock: z.boolean().optional(),
  status: z.enum(['on_track', 'off_track', 'done']).optional(),
  dueDate: z.coerce.date().optional(),
});

const listRocksQuerySchema = z.object({
  quarter: z.string().optional(),
  ownerUserId: z.string().optional(),
});

const createMilestoneSchema = z.object({
  description: z.string().min(1),
  dueDate: z.coerce.date(),
});

const updateMilestoneSchema = z.object({
  description: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
  completed: z.boolean().optional(),
});

export default async function rockRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', resolveTenantContext);

  app.get('/', async (request) => {
    const query = listRocksQuerySchema.parse(request.query);
    const repo = new RockRepository(request.tenantId as string);
    return repo.findAll(query);
  });

  app.post('/', async (request, reply) => {
    const body = createRockSchema.parse(request.body);
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.create(body);
    return reply.code(201).send(rock);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.findById(id);
    if (!rock) return reply.code(404).send({ error: 'Rock not found' });
    return rock;
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRockSchema.parse(request.body);
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.update(id, body);
    if (!rock) return reply.code(404).send({ error: 'Rock not found' });
    return rock;
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new RockRepository(request.tenantId as string);
    const deleted = await repo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Rock not found' });
    return reply.code(204).send();
  });

  app.post('/:rockId/milestones', async (request, reply) => {
    const { rockId } = request.params as { rockId: string };
    const body = createMilestoneSchema.parse(request.body);

    const rockRepo = new RockRepository(request.tenantId as string);
    const rock = await rockRepo.findById(rockId);
    if (!rock) return reply.code(404).send({ error: 'Rock not found' });

    const milestoneRepo = new MilestoneRepository(request.tenantId as string);
    const milestone = await milestoneRepo.create(rockId, body);
    return reply.code(201).send(milestone);
  });

  app.patch('/:rockId/milestones/:id', async (request, reply) => {
    const { id } = request.params as { rockId: string; id: string };
    const { completed, ...rest } = updateMilestoneSchema.parse(request.body);

    const milestoneRepo = new MilestoneRepository(request.tenantId as string);
    const milestone = await milestoneRepo.update(id, {
      ...rest,
      ...(completed === undefined ? {} : { completedAt: completed ? new Date() : null }),
    });
    if (!milestone) return reply.code(404).send({ error: 'Milestone not found' });
    return milestone;
  });

  app.delete('/:rockId/milestones/:id', async (request, reply) => {
    const { id } = request.params as { rockId: string; id: string };
    const milestoneRepo = new MilestoneRepository(request.tenantId as string);
    const deleted = await milestoneRepo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Milestone not found' });
    return reply.code(204).send();
  });
}
```

- [ ] **Step 4: Register the routes in `server/src/app.ts`**

```ts
import rockRoutes from './routes/rocks.js';
// ...
  await app.register(rockRoutes, { prefix: '/rocks' });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --prefix server -- routes/rocks.test`
Expected: PASS, 13 tests green.

- [ ] **Step 6: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test:coverage --prefix server`
Expected: all exit code 0; coverage above thresholds.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/rocks.ts server/src/routes/rocks.test.ts server/src/app.ts
git commit -m "feat(server): add Rock and Milestone CRUD routes"
```

---

## Task 5: `apiFetch` — soporte de 204 No Content

**Files:**
- Modify: `front/src/lib/apiClient.ts`
- Test: crea `front/src/lib/apiClient.test.ts` (no existía)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `apiFetch<T>` ahora resuelve a `undefined` (tipado como `T`) cuando `response.status === 204`, en vez de intentar parsear un body inexistente. Usado por Task 7 (`rocksApi.remove`, `rocksApi.removeMilestone`) y por todo `DELETE` futuro de sprints siguientes.

- [ ] **Step 1: Write the failing test — `front/src/lib/apiClient.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './apiClient';
import { useAuthStore } from '../store/authStore';

describe('apiFetch', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'test-token', activeTenantId: 'tenant-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().logout();
  });

  it('returns undefined for a 204 No Content response without parsing a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('should not be called on 204')),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/rocks/rock-1', { method: 'DELETE' });

    expect(result).toBeUndefined();
  });

  it('parses JSON for a normal 200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'rock-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ id: string }>('/rocks/rock-1');

    expect(result).toEqual({ id: 'rock-1' });
  });

  it('throws ApiError with the server message on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Rock not found' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/rocks/missing')).rejects.toThrow(ApiError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- apiClient.test`
Expected: FAIL — el primer test (`204 No Content`) falla porque hoy `apiFetch` llama `response.json()` incondicionalmente, y el mock de esa respuesta rechaza esa llamada a propósito.

- [ ] **Step 3: Implement the fix in `front/src/lib/apiClient.ts`**

```ts
import { useAuthStore } from '../store/authStore';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { token, activeTenantId } = useAuthStore.getState();

  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (activeTenantId) headers.set('X-Tenant-Id', activeTenantId);

  const response = await fetch(`/api${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix front -- apiClient.test`
Expected: PASS, 3 tests green.

- [ ] **Step 5: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all exit code 0.

- [ ] **Step 6: Commit**

```bash
git add front/src/lib/apiClient.ts front/src/lib/apiClient.test.ts
git commit -m "fix(front): handle 204 No Content responses in apiFetch"
```

---

## Task 6: `rocksApi.ts` + `tenantApi.ts` (frontend, tipados)

**Files:**
- Create: `front/src/lib/rocksApi.ts`
- Create: `front/src/lib/tenantApi.ts`
- Test: `front/src/lib/rocksApi.test.ts`

**Interfaces:**
- Consumes: `apiFetch` (Task 5).
- Produces:
  - `tenantApi.listMembers(): Promise<TenantMember[]>` — `TenantMember = { userId: string; fullName: string; email: string }`.
  - `rocksApi.list(filters?: { quarter?: string; ownerUserId?: string }): Promise<Rock[]>`
  - `rocksApi.create(payload: CreateRockPayload): Promise<Rock>`
  - `rocksApi.update(id: string, payload: UpdateRockPayload): Promise<Rock>`
  - `rocksApi.remove(id: string): Promise<void>`
  - `rocksApi.addMilestone(rockId: string, payload: { description: string; dueDate: string }): Promise<Milestone>`
  - `rocksApi.toggleMilestone(rockId: string, milestoneId: string, completed: boolean): Promise<Milestone>`
  - `rocksApi.removeMilestone(rockId: string, milestoneId: string): Promise<void>`
  Tipos `Rock`, `Milestone`, `RockStatus`, `CreateRockPayload`, `UpdateRockPayload` exportados desde `rocksApi.ts` — usados por Task 8 (`RocksBoard`) y Task 9 (`RockFormModal`).

- [ ] **Step 1: Write the failing test — `front/src/lib/rocksApi.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('rocksApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list builds the query string only from provided filters', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.list({ quarter: '2026-Q3' });

    expect(apiFetch).toHaveBeenCalledWith('/rocks?quarter=2026-Q3');
  });

  it('list with no filters calls the bare endpoint', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue([]);

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.list();

    expect(apiFetch).toHaveBeenCalledWith('/rocks');
  });

  it('create POSTs the payload as JSON', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'rock-1' });

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.create({
      title: 'Rock 1',
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: false,
      dueDate: '2026-09-30',
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/rocks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Rock 1',
          ownerUserId: 'user-1',
          quarter: '2026-Q3',
          isCompanyRock: false,
          dueDate: '2026-09-30',
        }),
      })
    );
  });

  it('toggleMilestone PATCHes { completed }', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ id: 'milestone-1' });

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.toggleMilestone('rock-1', 'milestone-1', true);

    expect(apiFetch).toHaveBeenCalledWith(
      '/rocks/rock-1/milestones/milestone-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ completed: true }) })
    );
  });

  it('remove DELETEs the rock', async () => {
    const { apiFetch } = await import('./apiClient');
    vi.mocked(apiFetch).mockResolvedValue(undefined);

    const { rocksApi } = await import('./rocksApi');
    await rocksApi.remove('rock-1');

    expect(apiFetch).toHaveBeenCalledWith('/rocks/rock-1', expect.objectContaining({ method: 'DELETE' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- rocksApi.test`
Expected: FAIL — `Cannot find module './rocksApi'`.

- [ ] **Step 3: Implement `front/src/lib/tenantApi.ts`**

```ts
import { apiFetch } from './apiClient';

export interface TenantMember {
  userId: string;
  fullName: string;
  email: string;
}

export const tenantApi = {
  listMembers: () => apiFetch<TenantMember[]>('/tenant/members'),
};
```

- [ ] **Step 4: Implement `front/src/lib/rocksApi.ts`**

```ts
import { apiFetch } from './apiClient';

export type RockStatus = 'on_track' | 'off_track' | 'done';

export interface Milestone {
  id: string;
  rockId: string;
  description: string;
  dueDate: string;
  completedAt: string | null;
}

export interface Rock {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  quarter: string;
  isCompanyRock: boolean;
  status: RockStatus;
  createdAt: string;
  dueDate: string;
  milestones: Milestone[];
}

export interface RockFilters {
  quarter?: string;
  ownerUserId?: string;
}

export interface CreateRockPayload {
  title: string;
  description?: string;
  ownerUserId: string;
  quarter: string;
  isCompanyRock: boolean;
  dueDate: string;
}

export type UpdateRockPayload = Partial<CreateRockPayload> & { status?: RockStatus };

function buildQuery(filters: RockFilters): string {
  const params = new URLSearchParams();
  if (filters.quarter) params.set('quarter', filters.quarter);
  if (filters.ownerUserId) params.set('ownerUserId', filters.ownerUserId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const rocksApi = {
  list: (filters: RockFilters = {}) => apiFetch<Rock[]>(`/rocks${buildQuery(filters)}`),

  create: (payload: CreateRockPayload) =>
    apiFetch<Rock>('/rocks', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: UpdateRockPayload) =>
    apiFetch<Rock>(`/rocks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  remove: (id: string) => apiFetch<void>(`/rocks/${id}`, { method: 'DELETE' }),

  addMilestone: (rockId: string, payload: { description: string; dueDate: string }) =>
    apiFetch<Milestone>(`/rocks/${rockId}/milestones`, { method: 'POST', body: JSON.stringify(payload) }),

  toggleMilestone: (rockId: string, milestoneId: string, completed: boolean) =>
    apiFetch<Milestone>(`/rocks/${rockId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),

  removeMilestone: (rockId: string, milestoneId: string) =>
    apiFetch<void>(`/rocks/${rockId}/milestones/${milestoneId}`, { method: 'DELETE' }),
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --prefix front -- rocksApi.test`
Expected: PASS, 5 tests green.

- [ ] **Step 6: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all exit code 0.

- [ ] **Step 7: Commit**

```bash
git add front/src/lib/rocksApi.ts front/src/lib/rocksApi.test.ts front/src/lib/tenantApi.ts
git commit -m "feat(front): add typed rocksApi and tenantApi clients"
```

---

## Task 7: Extraer `AppLayout` compartido de `DashboardPage`

**Files:**
- Create: `front/src/components/AppLayout.tsx`
- Modify: `front/src/pages/DashboardPage.tsx`
- Modify: `front/src/App.tsx` (nada de rutas cambia aún, solo queda listo para Task 8)
- Test: `front/src/components/AppLayout.test.tsx`
- Test: Modify `front/src/pages/DashboardPage.test.tsx` si existe, o crear uno mínimo si no existía (el glob de la sesión no encontró `DashboardPage.test.tsx` — confirmar al ejecutar; si no existe, este task lo crea)

**Interfaces:**
- Consumes: `useAuthStore` (`store/authStore.ts`), `TenantSwitcher`, `AvatarUploader` (ya existentes).
- Produces: `AppLayout({ title, children }: { title?: string; children: React.ReactNode })` — renderiza el header glass (nombre de tenant activo o `title`, `TenantSwitcher`, `AvatarUploader`, nombre de usuario, logout) + `Layout.Content` glass envolviendo `children`. Incluye un `Menu` horizontal de navegación con las rutas de módulo (`Dashboard`, `Rocks` — cada sprint siguiente añade su entrada aquí). Usado por `DashboardPage` (Task de este mismo bloque) y por `RocksBoard` (Task 8).

- [ ] **Step 1: Write the failing test — `front/src/components/AppLayout.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
  });

  it('renders the active tenant name and the nav links', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <div>contenido</div>
        </AppLayout>
      </MemoryRouter>
    );

    expect(screen.getByText('Tasvalor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rocks/i })).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- AppLayout.test`
Expected: FAIL — `Cannot find module './AppLayout'`.

- [ ] **Step 3: Implement `front/src/components/AppLayout.tsx`**

```tsx
import { Layout, Menu, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AvatarUploader } from './AvatarUploader';
import { TenantSwitcher } from './TenantSwitcher';

const NAV_ITEMS = [
  { key: '/dashboard', label: <Link to="/dashboard">Dashboard</Link> },
  { key: '/rocks', label: <Link to="/rocks">Rocks</Link> },
];

export function AppLayout({ title, children }: { title?: string; children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const tenants = useAuthStore((state) => state.tenants);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  const activeTenant = tenants.find((tenant) => tenant.tenantId === activeTenantId);

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Layout.Header
        className="glass-panel"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 16, gap: 24 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Typography.Text strong>{title ?? activeTenant?.tenantName ?? 'EOS Tool'}</Typography.Text>
          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={NAV_ITEMS}
            style={{ background: 'transparent', borderBottom: 'none', minWidth: 240 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <TenantSwitcher />
          <AvatarUploader />
          <Typography.Text>{user?.fullName}</Typography.Text>
          <a onClick={logout}>Salir</a>
        </div>
      </Layout.Header>
      <Layout.Content className="glass-panel" style={{ margin: 16, padding: 24 }}>
        {children}
      </Layout.Content>
    </Layout>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix front -- AppLayout.test`
Expected: PASS, 1 test green.

- [ ] **Step 5: Rewrite `front/src/pages/DashboardPage.tsx` to use `AppLayout`**

```tsx
import { Typography } from 'antd';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';

export function DashboardPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  if (!token) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;

  return (
    <AppLayout>
      <Typography.Title level={4}>Sprint 2 — Rocks disponible</Typography.Title>
      <Typography.Paragraph>
        Auth, tenant-context, cambio de contraseña forzado, avatar y Rocks funcionando
        end-to-end. Los módulos restantes (Scorecard, L10, Issues, Accountability Chart,
        V/TO) llegan en sus sprints correspondientes.
      </Typography.Paragraph>
    </AppLayout>
  );
}
```

- [ ] **Step 6: Run the existing `DashboardPage` test (or write a minimal one if it doesn't exist yet)**

Run: `npm run test --prefix front -- DashboardPage`

Si `front/src/pages/DashboardPage.test.tsx` no existe todavía, créalo con al menos:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
  });

  it('redirects to /login when there is no token', () => {
    useAuthStore.setState({ token: null });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Sprint 2/)).not.toBeInTheDocument();
  });

  it('renders inside AppLayout when authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Sprint 2 — Rocks disponible/)).toBeInTheDocument();
  });
});
```

Expected: PASS.

- [ ] **Step 7: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all exit code 0.

- [ ] **Step 8: Commit**

```bash
git add front/src/components/AppLayout.tsx front/src/components/AppLayout.test.tsx front/src/pages/DashboardPage.tsx front/src/pages/DashboardPage.test.tsx
git commit -m "refactor(front): extract shared AppLayout with module nav from DashboardPage"
```

---

## Task 8: `RocksBoard` — vista Kanban con filtros

**Files:**
- Create: `front/src/pages/RocksBoard.tsx`
- Test: `front/src/pages/RocksBoard.test.tsx`

**Interfaces:**
- Consumes: `rocksApi` (Task 6), `tenantApi` (Task 6), `AppLayout` (Task 7).
- Produces: componente de página `RocksBoard` montado en `/rocks` (Task 10). Columnas `on_track`/`off_track`/`done`, cada Rock como `glass-panel`. Filtros: `Select` de trimestre (derivado de los trimestres presentes en los rocks cargados, más el trimestre actual) y `Select` de owner (desde `tenantApi.listMembers()`). Botón "Nuevo Rock" abre `RockFormModal` (Task 9) — este task deja el hueco (`onCreateClick`) y Task 9 lo conecta.

- [ ] **Step 1: Write the failing test — `front/src/pages/RocksBoard.test.tsx`**

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { RocksBoard } from './RocksBoard';

vi.mock('../lib/rocksApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/rocksApi')>('../lib/rocksApi');
  return { ...actual, rocksApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
});

vi.mock('../lib/tenantApi', () => ({
  tenantApi: { listMembers: vi.fn() },
}));

const rocks = [
  {
    id: 'rock-1',
    tenantId: 'tenant-1',
    title: 'Lanzar módulo de Scorecard',
    description: null,
    ownerUserId: 'user-1',
    quarter: '2026-Q3',
    isCompanyRock: true,
    status: 'on_track' as const,
    createdAt: '2026-07-01T00:00:00.000Z',
    dueDate: '2026-09-30T00:00:00.000Z',
    milestones: [],
  },
  {
    id: 'rock-2',
    tenantId: 'tenant-1',
    title: 'Cerrar 3 nuevos clientes',
    description: null,
    ownerUserId: 'user-1',
    quarter: '2026-Q3',
    isCompanyRock: false,
    status: 'off_track' as const,
    createdAt: '2026-07-01T00:00:00.000Z',
    dueDate: '2026-09-30T00:00:00.000Z',
    milestones: [],
  },
];

describe('RocksBoard', () => {
  beforeEach(async () => {
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Pablo', mustChangePassword: false, avatarUrl: null },
      tenants: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
      activeTenantId: 'tenant-1',
    });
    const { rocksApi } = await import('../lib/rocksApi');
    const { tenantApi } = await import('../lib/tenantApi');
    vi.mocked(rocksApi.list).mockResolvedValue(rocks as never);
    vi.mocked(tenantApi.listMembers).mockResolvedValue([
      { userId: 'user-1', fullName: 'Pablo', email: 'me@example.com' },
    ]);
  });

  it('groups rocks into their status column', async () => {
    render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Lanzar módulo de Scorecard')).toBeInTheDocument());

    const onTrackColumn = screen.getByTestId('rocks-column-on_track');
    const offTrackColumn = screen.getByTestId('rocks-column-off_track');
    expect(within(onTrackColumn).getByText('Lanzar módulo de Scorecard')).toBeInTheDocument();
    expect(within(offTrackColumn).getByText('Cerrar 3 nuevos clientes')).toBeInTheDocument();
  });

  it('refetches with the selected quarter filter', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    render(
      <MemoryRouter>
        <RocksBoard />
      </MemoryRouter>
    );
    await waitFor(() => expect(rocksApi.list).toHaveBeenCalledWith({}));

    await userEvent.click(screen.getByLabelText(/trimestre/i));
    await userEvent.click(await screen.findByText('2026-Q3'));

    await waitFor(() =>
      expect(rocksApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ quarter: '2026-Q3' }))
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- RocksBoard.test`
Expected: FAIL — `Cannot find module './RocksBoard'`.

- [ ] **Step 3: Implement `front/src/pages/RocksBoard.tsx`**

```tsx
import { Button, Card, Col, Row, Select, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { rocksApi, type Rock, type RockStatus } from '../lib/rocksApi';
import { tenantApi, type TenantMember } from '../lib/tenantApi';

const COLUMNS: { status: RockStatus; label: string }[] = [
  { status: 'on_track', label: 'On track' },
  { status: 'off_track', label: 'Off track' },
  { status: 'done', label: 'Done' },
];

function currentQuarter(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${quarter}`;
}

export function RocksBoard() {
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [quarter, setQuarter] = useState<string | undefined>(undefined);
  const [ownerUserId, setOwnerUserId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    tenantApi.listMembers().then(setMembers);
  }, []);

  useEffect(() => {
    setLoading(true);
    rocksApi
      .list({ quarter, ownerUserId })
      .then(setRocks)
      .finally(() => setLoading(false));
  }, [quarter, ownerUserId]);

  const quarterOptions = useMemo(() => {
    const quarters = new Set(rocks.map((rock) => rock.quarter));
    quarters.add(currentQuarter());
    return Array.from(quarters).sort();
  }, [rocks]);

  return (
    <AppLayout title="Rocks">
      <Space style={{ marginBottom: 24 }} wrap>
        <Select
          allowClear
          aria-label="Trimestre"
          placeholder="Trimestre"
          style={{ width: 160 }}
          value={quarter}
          onChange={setQuarter}
          options={quarterOptions.map((q) => ({ value: q, label: q }))}
        />
        <Select
          allowClear
          aria-label="Owner"
          placeholder="Owner"
          style={{ width: 200 }}
          value={ownerUserId}
          onChange={setOwnerUserId}
          options={members.map((member) => ({ value: member.userId, label: member.fullName }))}
        />
        <Button type="primary">Nuevo Rock</Button>
      </Space>

      <Row gutter={16}>
        {COLUMNS.map((column) => (
          <Col span={8} key={column.status}>
            <Typography.Title level={5}>{column.label}</Typography.Title>
            <div data-testid={`rocks-column-${column.status}`} style={{ display: 'grid', gap: 12 }}>
              {loading && rocks.length === 0 && <Typography.Text type="secondary">Cargando…</Typography.Text>}
              {rocks
                .filter((rock) => rock.status === column.status)
                .map((rock) => (
                  <Card key={rock.id} className="glass-panel" size="small">
                    <Typography.Text strong>{rock.title}</Typography.Text>
                    <div>
                      <Typography.Text type="secondary">{rock.quarter}</Typography.Text>
                    </div>
                  </Card>
                ))}
              {!loading && rocks.filter((rock) => rock.status === column.status).length === 0 && (
                <Typography.Text type="secondary">Sin rocks</Typography.Text>
              )}
            </div>
          </Col>
        ))}
      </Row>
    </AppLayout>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix front -- RocksBoard.test`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all exit code 0.

- [ ] **Step 6: Commit**

```bash
git add front/src/pages/RocksBoard.tsx front/src/pages/RocksBoard.test.tsx
git commit -m "feat(front): add RocksBoard kanban view with quarter/owner filters"
```

---

## Task 9: `RockFormModal` — crear/editar Rock + Milestones inline

**Files:**
- Create: `front/src/components/RockFormModal.tsx`
- Modify: `front/src/pages/RocksBoard.tsx` (conectar el botón "Nuevo Rock" y el click en una tarjeta a este modal)
- Test: `front/src/components/RockFormModal.test.tsx`

**Interfaces:**
- Consumes: `rocksApi`, `tenantApi` (Task 6).
- Produces: `RockFormModal({ open, rock, members, onClose, onSaved }: RockFormModalProps)` — `rock?: Rock` (si viene, es edición; si no, creación). Formulario AntD (`title`, `description`, `ownerUserId` Select de `members`, `quarter`, `isCompanyRock` Switch, `dueDate` DatePicker, `status` Select solo visible en edición). Lista de milestones inline (solo visible en edición, ya que crear milestones requiere un `rockId` existente): añadir (`description` + `dueDate`), marcar como completado (`Checkbox`), borrar. Llama `onSaved()` tras guardar con éxito para que `RocksBoard` recargue la lista.

- [ ] **Step 1: Write the failing test — `front/src/components/RockFormModal.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RockFormModal } from './RockFormModal';

vi.mock('../lib/rocksApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/rocksApi')>('../lib/rocksApi');
  return {
    ...actual,
    rocksApi: {
      create: vi.fn(),
      update: vi.fn(),
      addMilestone: vi.fn(),
      toggleMilestone: vi.fn(),
      removeMilestone: vi.fn(),
    },
  };
});

const members = [{ userId: 'user-1', fullName: 'Pablo', email: 'me@example.com' }];

describe('RockFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new rock with the entered fields', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    vi.mocked(rocksApi.create).mockResolvedValue({ id: 'rock-1' } as never);
    const onSaved = vi.fn();

    render(<RockFormModal open rock={undefined} members={members} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/título/i), 'Lanzar módulo de Scorecard');
    // ownerUserId is required with no default — quarter/dueDate get sensible
    // defaults on mount (current quarter, end of quarter) so the form is
    // submittable without touching the DatePicker in this test.
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Pablo'));
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(rocksApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Lanzar módulo de Scorecard', ownerUserId: 'user-1' })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows the milestones list and adds a new one when editing an existing rock', async () => {
    const { rocksApi } = await import('../lib/rocksApi');
    vi.mocked(rocksApi.addMilestone).mockResolvedValue({
      id: 'milestone-1',
      rockId: 'rock-1',
      description: 'Diseñar el schema',
      dueDate: '2026-08-15T00:00:00.000Z',
      completedAt: null,
    } as never);

    const rock = {
      id: 'rock-1',
      tenantId: 'tenant-1',
      title: 'Lanzar módulo de Scorecard',
      description: null,
      ownerUserId: 'user-1',
      quarter: '2026-Q3',
      isCompanyRock: true,
      status: 'on_track' as const,
      createdAt: '2026-07-01T00:00:00.000Z',
      dueDate: '2026-09-30T00:00:00.000Z',
      milestones: [],
    };

    render(<RockFormModal open rock={rock} members={members} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText(/milestones/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/descripción del milestone/i), 'Diseñar el schema');
    await userEvent.click(screen.getByRole('button', { name: /añadir milestone/i }));

    await waitFor(() =>
      expect(rocksApi.addMilestone).toHaveBeenCalledWith(
        'rock-1',
        expect.objectContaining({ description: 'Diseñar el schema' })
      )
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- RockFormModal.test`
Expected: FAIL — `Cannot find module './RockFormModal'`.

- [ ] **Step 3: Implement `front/src/components/RockFormModal.tsx`**

```tsx
import { Button, Checkbox, DatePicker, Form, Input, Modal, Select, Switch, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { rocksApi, type Milestone, type Rock } from '../lib/rocksApi';
import type { TenantMember } from '../lib/tenantApi';

export interface RockFormModalProps {
  open: boolean;
  rock?: Rock;
  members: TenantMember[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  title: string;
  description?: string;
  ownerUserId: string;
  quarter: string;
  isCompanyRock: boolean;
  dueDate: dayjs.Dayjs;
  status?: Rock['status'];
}

function defaultQuarter(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${quarter}`;
}

function defaultDueDate(): dayjs.Dayjs {
  const now = new Date();
  const quarterEndMonth = Math.floor(now.getMonth() / 3) * 3 + 2; // 0-indexed last month of current quarter
  return dayjs(new Date(now.getFullYear(), quarterEndMonth + 1, 0)); // day 0 of next month = last day of quarterEndMonth
}

export function RockFormModal({ open, rock, members, onClose, onSaved }: RockFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>(rock?.milestones ?? []);
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState<dayjs.Dayjs | null>(dayjs());

  useEffect(() => {
    setMilestones(rock?.milestones ?? []);
    form.setFieldsValue(
      rock
        ? {
            title: rock.title,
            description: rock.description ?? undefined,
            ownerUserId: rock.ownerUserId,
            quarter: rock.quarter,
            isCompanyRock: rock.isCompanyRock,
            dueDate: dayjs(rock.dueDate),
            status: rock.status,
          }
        : { isCompanyRock: false, quarter: defaultQuarter(), dueDate: defaultDueDate() }
    );
  }, [rock, form]);

  async function handleSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        title: values.title,
        description: values.description,
        ownerUserId: values.ownerUserId,
        quarter: values.quarter,
        isCompanyRock: values.isCompanyRock,
        dueDate: values.dueDate.toISOString(),
      };
      if (rock) {
        await rocksApi.update(rock.id, { ...payload, status: values.status });
      } else {
        await rocksApi.create(payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMilestone() {
    if (!rock || !newMilestoneDescription) return;
    const milestone = await rocksApi.addMilestone(rock.id, {
      description: newMilestoneDescription,
      dueDate: (newMilestoneDueDate ?? dayjs()).toISOString(),
    });
    setMilestones((prev) => [...prev, milestone]);
    setNewMilestoneDescription('');
    setNewMilestoneDueDate(dayjs());
  }

  async function handleToggleMilestone(milestone: Milestone, completed: boolean) {
    if (!rock) return;
    const updated = await rocksApi.toggleMilestone(rock.id, milestone.id, completed);
    setMilestones((prev) => prev.map((m) => (m.id === milestone.id ? updated : m)));
  }

  async function handleRemoveMilestone(milestone: Milestone) {
    if (!rock) return;
    await rocksApi.removeMilestone(rock.id, milestone.id);
    setMilestones((prev) => prev.filter((m) => m.id !== milestone.id));
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={rock ? 'Editar Rock' : 'Nuevo Rock'}           <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="title" label="Título" rules={[{ required: true, message: 'Introduce un título' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Descripción">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="ownerUserId" label="Owner" rules={[{ required: true, message: 'Elige un owner' }]}>
          <Select options={members.map((member) => ({ value: member.userId, label: member.fullName }))} />
        </Form.Item>
        <Form.Item name="quarter" label="Trimestre" rules={[{ required: true, message: 'Introduce el trimestre' }]}>
          <Input placeholder="2026-Q3" />
        </Form.Item>
        <Form.Item name="isCompanyRock" label="Rock de empresa" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="dueDate" label="Fecha límite" rules={[{ required: true, message: 'Elige una fecha' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        {rock && (
          <Form.Item name="status" label="Estado">
            <Select
              options={[
                { value: 'on_track', label: 'On track' },
                { value: 'off_track', label: 'Off track' },
                { value: 'done', label: 'Done' },
              ]}
            />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" loading={saving} block>
          Guardar
        </Button>
      </Form>

      {rock && (
        <div style={{ marginTop: 24 }}>
          <Typography.Title level={5}>Milestones</Typography.Title>
          {milestones.map((milestone) => (
            <div key={milestone.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Checkbox
                checked={!!milestone.completedAt}
                onChange={(e) => handleToggleMilestone(milestone, e.target.checked)}
              />
              <Typography.Text delete={!!milestone.completedAt} style={{ flex: 1 }}>
                {milestone.description}
              </Typography.Text>
              <Button size="small" danger onClick={() => handleRemoveMilestone(milestone)}>
                Borrar
              </Button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              aria-label="Descripción del milestone"
              placeholder="Nuevo milestone"
              value={newMilestoneDescription}
              onChange={(e) => setNewMilestoneDescription(e.target.value)}
            />
            <DatePicker value={newMilestoneDueDate} onChange={setNewMilestoneDueDate} />
            <Button onClick={handleAddMilestone}>Añadir milestone</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 4: Wire the modal into `RocksBoard`**

Modifica `front/src/pages/RocksBoard.tsx`: añade estado `const [modalRock, setModalRock] = useState<Rock | 'new' | null>(null)`, el botón "Nuevo Rock" hace `onClick={() => setModalRock('new')}`, cada `Card` de rock hace `onClick={() => setModalRock(rock)}`, y al final del JSX (dentro de `<AppLayout>`, tras `</Row>`):

```tsx
{modalRock && (
  <RockFormModal
    open
    rock={modalRock === 'new' ? undefined : modalRock}
    members={members}
    onClose={() => setModalRock(null)}
    onSaved={() => {
      setModalRock(null);
      rocksApi.list({ quarter, ownerUserId }).then(setRocks);
    }}
  />
)}
```

Añade el import `import { RockFormModal } from '../components/RockFormModal';`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --prefix front -- RockFormModal.test`
Expected: PASS, 2 tests green.

- [ ] **Step 6: Run the full front suite (RocksBoard's wiring change must not break its own tests)**

Run: `npm run test --prefix front`
Expected: all green.

- [ ] **Step 7: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all exit code 0.

- [ ] **Step 8: Commit**

```bash
git add front/src/components/RockFormModal.tsx front/src/components/RockFormModal.test.tsx front/src/pages/RocksBoard.tsx
git commit -m "feat(front): add RockFormModal for create/edit with inline milestones"
```

---

## Task 10: Ruta `/rocks` en `App.tsx`

**Files:**
- Modify: `front/src/App.tsx`
- Test: si existe `front/src/App.test.tsx`, ampliarlo; si no existe, no crear uno nuevo solo para esto (cubierto indirectamente por los tests de `RocksBoard`/`DashboardPage`, que ya montan las páginas vía `MemoryRouter`) — no añadir un test file solo para una línea de routing sin lógica propia.

**Interfaces:**
- Consumes: `RocksBoard` (Task 8).
- Produces: navegar a `/rocks` renderiza `RocksBoard` en vez de un 404/redirect.

- [ ] **Step 1: Modify `front/src/App.tsx`**

```tsx
import { ConfigProvider } from 'antd';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RocksBoard } from './pages/RocksBoard';
import { glassThemeConfig } from './theme/glassTokens';

export function App() {
  return (
    <ConfigProvider theme={glassThemeConfig}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/rocks" element={<RocksBoard />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
```

- [ ] **Step 2: Run the full front suite**

Run: `npm run test --prefix front`
Expected: all green (no test targets `App.tsx` routing directly today — this step just confirms the change didn't break anything else).

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck --prefix front && npm run lint --prefix front`
Expected: both exit code 0.

- [ ] **Step 4: Commit**

```bash
git add front/src/App.tsx
git commit -m "feat(front): register /rocks route"
```

---

## Task 11: `rocks.README.md`

**Files:**
- Create: `server/src/routes/rocks.README.md`

**Interfaces:**
- No code — documentación siguiendo el formato de `server/src/routes/auth.README.md`.

- [ ] **Step 1: Write `server/src/routes/rocks.README.md`**

```markdown
# Rocks

## Qué hace

Objetivos trimestrales (Rocks), de empresa o individuales, con milestones opcionales
dentro de cada uno. Todas las rutas requieren `Authorization: Bearer <token>` y
`X-Tenant-Id` (ver `auth.README.md` — "Tenant context").

- `GET /rocks?quarter=&ownerUserId=` — lista los rocks del tenant activo, filtrable por
  trimestre (`"2026-Q3"`) y por owner. Incluye los `milestones` de cada rock.
- `POST /rocks` — crea un rock. Body: `{ title, description?, ownerUserId, quarter, isCompanyRock, dueDate }`.
- `GET /rocks/:id` — 404 si no existe en el tenant activo.
- `PATCH /rocks/:id` — actualiza cualquier subconjunto de los campos anteriores, incluido `status` (`on_track` | `off_track` | `done`).
- `DELETE /rocks/:id` — 204 en éxito, 404 si no existía.
- `POST /rocks/:rockId/milestones` — añade un milestone. Body: `{ description, dueDate }`. 404 si el rock no existe en el tenant.
- `PATCH /rocks/:rockId/milestones/:id` — Body: `{ description?, dueDate?, completed? }`. `completed: true` pone `completedAt` a ahora, `completed: false` lo limpia.
- `DELETE /rocks/:rockId/milestones/:id` — 204 en éxito, 404 si no existía.

## Permisos

Sin ACL por rol: cualquier miembro del tenant (`owner`/`admin`/`member`) puede crear,
editar y borrar cualquier Rock o Milestone de ese tenant. Es una herramienta interna de
equipos pequeños de confianza — no se pidió control de permisos más fino, no se ha
añadido (YAGNI). Si en el futuro hace falta, se aplica un chequeo de `request.userRole`
o de `rock.ownerUserId === request.user.userId` en `routes/rocks.ts`.

## `GET /tenant/members`

Endpoint auxiliar en `routes/tenant.ts`, no en este archivo, pero pensado para este
módulo: devuelve `{ userId, fullName, email }[]` de los miembros del tenant activo, para
poblar el selector de owner al crear/editar un Rock. Es una lectura mínima — la gestión
real de invitaciones/membership vive en el módulo de Accountability Chart (Sprint 1). Si
ese sprint termina con un endpoint equivalente más completo, revisar si conviene
fusionarlos.

## Cómo probarlo manualmente

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD>"}' | jq -r .token)

curl http://localhost/api/rocks \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: <tenantId de Tasvalor>"
```
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/rocks.README.md
git commit -m "docs(server): add rocks module README"
```

---

## Task 12: Verificación final del sprint

**Files:** ninguno nuevo — solo comandos de verificación.

- [ ] **Step 1: Suite completa backend**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test:coverage --prefix server`
Expected: exit 0, cobertura `src/repositories/**` (nuevo) y `src/routes/**` por encima de los umbrales configurados.

- [ ] **Step 2: Suite completa frontend**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: exit 0.

- [ ] **Step 3: Arranque real y comprobación manual de aislamiento multitenant**

Este paso lo ejecuta el usuario, no un implementador (mismo motivo que Sprint 0: nadie
más tiene credenciales de la Postgres de desarrollo real). Con `npm run dev` corriendo:

1. Login como `correopro@gmail.com`, tenant activo Tasvalor. `GET /api/rocks` (o la
   vista `/rocks`) debe mostrar los 2 rocks seed de Tasvalor (`Lanzar módulo de
   Scorecard`, `Cerrar 3 nuevos clientes`).
2. Cambiar el tenant activo a Cionet (`TenantSwitcher`). La lista debe cambiar a los
   rocks seed de Cionet — nunca mezclar ni mostrar los de Tasvalor.
3. Crear un Rock nuevo en Cionet, refrescar, confirmar que no aparece si se vuelve a
   Tasvalor.

Si el paso 2 o 3 falla (se ve un rock del tenant equivocado), es un bug de seguridad
(CLAUDE.md §7) — no se considera el sprint cerrado hasta corregirlo.

- [ ] **Step 4: Actualizar el roadmap**

En `docs/superpowers/plans/2026-07-30-eos-tool-roadmap.md`, marcar Sprint 2 como hecho
y anotar cualquier decisión tomada durante la implementación que difiera de este plan
(igual que Sprint 0 dejó notas de corrección inline en su propio plan).
