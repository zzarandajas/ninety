# Sprint 0 — Fundación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the multitenant foundation (auth, forced password change for admin-created accounts, avatar upload, tenant-context middleware, seed data, dev+prod Docker stack with Redis) so `docker compose up --build` (prod) and `npm run dev` (dev, hot-reload, host Postgres) both boot an end-to-end working app at `http://localhost`.

**Architecture:** Fastify (TS, ESM) backend with a `lib/prisma.ts` singleton, JWT auth via `@fastify/jwt`, a `resolveTenantContext` preHandler that re-validates `TenantMembership` fresh from the DB on every tenant-scoped request. React + Vite + Ant Design frontend with a Zustand auth store and a thin fetch wrapper that injects `Authorization` + `X-Tenant-Id`. Two Compose files: `docker-compose.yml` (prod, Postgres+Redis containerized) and `docker-compose.dev.yml` (dev, Postgres on host via `host.docker.internal`, Redis still containerized, hot-reload via bind mounts).

**Tech Stack:** Node 20 (runtime images) / Node 24 (local dev tooling, already installed), TypeScript, Fastify, Prisma, PostgreSQL, Redis, React, Vite, Ant Design, Zustand, Vitest + @vitest/coverage-v8.

## Global Constraints

- Multitenancy golden rule (CLAUDE.md §4): no controller/service calls `prisma.<model>.findMany/create/update` directly for business models — must go through a tenant-aware repository constructed with `tenantId`. `seed.ts` is the sole exception (infra script, not a controller).
- Everything real runs in Docker (CLAUDE.md §3) — no alternative "npm run dev outside Docker" flow for the app itself. Direct `npm`/`node` invocations in this plan are for the TDD authoring loop only (unit tests with mocked Prisma, no DB needed), not for running the app.
- Postgres migrations are ALWAYS run through the `migrate` Docker container (`prisma migrate deploy` in prod, `prisma migrate dev` the first time in dev) — never invoke `prisma migrate` directly on the host against the dev Postgres instance.
- Design: glassmorphism per `docs/DESIGN_BRIEF.md` — use the documented CSS variables, don't invent new ones.
- **UI/UX care (user's standing instruction):** any page/component a human actually looks at (Login, ChangePassword, Dashboard, avatar upload) needs real UX attention — loading/disabled states on submit, clear error messages, an avatar preview before and after upload, sensible labels/focus order. Not just wired-up AntD defaults. Consult the `ui-ux-pro-max` skill guidance for these screens if available in the implementer's environment.
- Testing: every module ships with unit tests AND coverage tracked from the start (user's standing rule) — `@vitest/coverage-v8`, thresholds enforced in `vitest.config.ts`.
- Documentation: every module ships with a `.md` explaining its functionality (user's standing rule) — not implementation narration, just what it does and how to use it.
- Git: repo is initialized (`main` branch tracking `origin`), but **the user never wants an agent to run `git commit` — in this project or any other.** Implementers do NOT commit — a task ends after its verification step (tests/typecheck/lint green), full stop. The controller (not the implementer) captures a non-destructive snapshot for review purposes via `git add -A && git stash create && git reset` (creates a dangling commit object for diffing, then immediately unstages — no real commit lands, working tree is left exactly as the implementer left it). Every task below that still shows a "Commit" step describes what the controller does after the implementer reports DONE, not an instruction to hand to the implementer.
- Dev DB: Postgres lives on the developer's host machine, not in `docker-compose.dev.yml` — reached via `${DEV_DATABASE_URL}` and `host.docker.internal`. **No subagent in this plan has credentials for that database or can boot the real dev stack against it** — Task 13's final manual verification is explicitly handed to the user, not executed by an implementer.
- Redis: infra-only in Sprint 0 (pub/sub for future WebSocket broadcast) — provisioned in both Compose files, no application code consumes it yet. Don't add an `ioredis` dependency or `lib/redis.ts` in this plan — YAGNI until a real caller exists.
- Forced password change: only accounts created by an admin/the seed script with a temporary password get `mustChangePassword: true`. Self-registration via `POST /auth/register` never sets it (the user picks their own password there).
- Avatar storage: local disk inside a Docker volume (`uploads_data`), served as static files — no Base64-in-DB, no S3/object storage (out of scale for 2-10 tenants).
- Seed credentials: the owner's password is never hardcoded in `seed.ts` — it comes from `SEED_OWNER_PASSWORD` in `.env` (a required env var with no committed default value).

---

## Task 1: Server scaffold + password hashing + strength policy (`lib/password.ts`)

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/eslint.config.js`
- Create: `server/vitest.config.ts`
- Create: `server/src/lib/password.ts`
- Test: `server/src/lib/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`, `isStrongPassword(plain: string): boolean` (true if length >= 10 AND contains at least one letter AND at least one digit) — used by Task 5 (auth routes: register uses a basic length check, `change-password` uses `isStrongPassword` for the new password) and `seed.ts` (Task 8).

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "traction-tool-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "@fastify/cors": "^10.0.1",
    "@fastify/jwt": "^9.0.1",
    "@fastify/multipart": "^8.3.0",
    "@fastify/static": "^7.0.4",
    "@prisma/client": "^5.20.0",
    "bcrypt": "^5.1.1",
    "fastify": "^4.28.1",
    "fastify-plugin": "^5.0.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.14.15",
    "@vitest/coverage-v8": "^2.1.1",
    "eslint": "^9.10.0",
    "prisma": "^5.20.0",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "typescript-eslint": "^8.5.0",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install --prefix server`
Expected: installs into `server/node_modules`, creates `server/package-lock.json`, exit code 0.

- [ ] **Step 3: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `server/eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'uploads/**'],
  }
);
```

- [ ] **Step 5: Create `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/config/**', 'src/plugins/**', 'src/middleware/**', 'src/routes/**', 'src/app.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
```

- [ ] **Step 6: Write the failing test — `server/src/lib/password.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, isStrongPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('hashes a password to something other than the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password against a hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });
});

describe('isStrongPassword', () => {
  it('rejects passwords shorter than 10 characters', () => {
    expect(isStrongPassword('abc123')).toBe(false);
  });

  it('rejects passwords with no digit', () => {
    expect(isStrongPassword('onlylettershere')).toBe(false);
  });

  it('rejects passwords with no letter', () => {
    expect(isStrongPassword('1234567890')).toBe(false);
  });

  it('accepts a password with 10+ chars, a letter, and a digit', () => {
    expect(isStrongPassword('Sup3rSecret')).toBe(true);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm run test --prefix server`
Expected: FAIL — `Cannot find module './password.js'` (file doesn't exist yet).

- [ ] **Step 8: Implement `server/src/lib/password.ts`**

```ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function isStrongPassword(plain: string): boolean {
  return plain.length >= 10 && /[a-zA-Z]/.test(plain) && /[0-9]/.test(plain);
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test --prefix server`
Expected: PASS, 7 tests green.

- [ ] **Step 10: Verify typecheck and lint pass**

Run: `npm run typecheck --prefix server && npm run lint --prefix server`
Expected: both exit code 0, no errors.

- [ ] **Step 11: Commit**

```bash
git add server/package.json server/package-lock.json server/tsconfig.json server/eslint.config.js server/vitest.config.ts server/src/lib/password.ts server/src/lib/password.test.ts
git commit -m "feat(server): scaffold server package, add password hashing + strength check"
```

---

## Task 2: JWT helpers (`lib/jwt.ts`) + env config (`config/env.ts`)

**Files:**
- Create: `server/src/config/env.ts`
- Create: `server/src/lib/jwt.ts`
- Test: `server/src/lib/jwt.test.ts`
- Test: `server/src/config/env.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `env: { DATABASE_URL: string; JWT_SECRET: string; PORT: number; NODE_ENV: string; REDIS_URL: string }` from `config/env.ts`; `signAccessToken(payload: { userId: string }): string`, `verifyAccessToken(token: string): { userId: string }` from `lib/jwt.ts`. Used by Task 4 (`plugins/jwt.ts`), Task 5 (auth routes), Task 6 (tenant middleware).

- [ ] **Step 1: Write the failing test — `server/src/config/env.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('env config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws if a required var is missing', async () => {
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = 'postgresql://u:p@host:5432/db';
    await expect(import('./env.js')).rejects.toThrow(/JWT_SECRET/);
  });

  it('parses required vars and applies defaults', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@host:5432/db';
    process.env.JWT_SECRET = 'a-very-long-random-secret-value';
    const mod = await import('./env.js');
    expect(mod.env.DATABASE_URL).toBe('postgresql://u:p@host:5432/db');
    expect(mod.env.PORT).toBe(4000);
    expect(mod.env.NODE_ENV).toBe('development');
  });
});
```

**Note (plan correction after Task 2's first implementation attempt):** the
original version of this test used `import(\`./env.js?t=${Date.now()}\`)` to
force a fresh module evaluation per test. Vite's SSR module runner rejects
dynamic `import()` calls whose specifier isn't statically analyzable (a
template literal with an interpolated variable), so that pattern throws at
runtime under Vitest. `vi.resetModules()` + a plain static `import('./env.js')`
achieves the same "re-evaluate with current process.env" goal without
tripping that restriction — this is the version to implement.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix server -- env.test`
Expected: FAIL — `Cannot find module './env.js'`.

- [ ] **Step 3: Implement `server/src/config/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
  REDIS_URL: z.string().default('redis://redis:6379'),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix server -- env.test`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Write the failing test — `server/src/lib/jwt.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET = 'a-very-long-random-secret-value';
});

describe('jwt helpers', () => {
  it('signs and verifies a payload round-trip', async () => {
    const { signAccessToken, verifyAccessToken } = await import('./jwt.js');
    const token = signAccessToken({ userId: 'user-123' });
    expect(typeof token).toBe('string');
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe('user-123');
  });

  it('throws on a tampered token', async () => {
    const { signAccessToken, verifyAccessToken } = await import('./jwt.js');
    const token = signAccessToken({ userId: 'user-123' });
    expect(() => verifyAccessToken(token + 'tampered')).toThrow();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test --prefix server -- jwt.test`
Expected: FAIL — `Cannot find module './jwt.js'`.

- [ ] **Step 7: Implement `server/src/lib/jwt.ts`**

```ts
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  userId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}
```

This is a standalone helper (used by tests and available for any future
out-of-request signing need) separate from the `@fastify/jwt` plugin
registered in Task 4 — the plugin handles request-level verification with
Fastify's request/reply lifecycle.

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test --prefix server -- jwt.test`
Expected: PASS, 2 tests green.

- [ ] **Step 9: Verify typecheck, lint, and full suite**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test --prefix server`
Expected: all exit code 0.

- [ ] **Step 10: Commit**

```bash
git add server/src/config/env.ts server/src/config/env.test.ts server/src/lib/jwt.ts server/src/lib/jwt.test.ts
git commit -m "feat(server): add env config and JWT sign/verify helpers"
```

---

## Task 3: Prisma singleton (`lib/prisma.ts`) + Fastify app skeleton (`app.ts`, `index.ts`)

**Files:**
- Create: `server/src/lib/prisma.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Test: `server/src/app.test.ts`

**Interfaces:**
- Consumes: `env` from `config/env.ts` (Task 2).
- Produces: `prisma: PrismaClient` singleton from `lib/prisma.ts`; `buildApp(): FastifyInstance` from `app.ts` (as first written — Task 4 changes this to `buildApp(): Promise<FastifyInstance>` once plugin decorators are introduced, see Task 4's note) — used by Task 4 (plugins), Task 5 (routes), Task 6 (middleware), Task 7 (avatar routes).

`server/prisma/schema.prisma` already includes `User.mustChangePassword` and
`User.avatarUrl` (added before this plan started executing) — nothing to
change in the schema file itself in this task, just generate the client
from it.

- [ ] **Step 1: Generate the Prisma client**

Run: `npx --prefix server prisma generate --schema=server/prisma/schema.prisma`
Expected: exit 0, generates `@prisma/client` types including `mustChangePassword` and `avatarUrl` on `User`.

- [ ] **Step 2: Create `server/src/lib/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 3: Write the failing test — `server/src/app.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

describe('app', () => {
  it('responds to GET /health with 200 and status ok', async () => {
    const { buildApp } = await import('./app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test --prefix server -- app.test`
Expected: FAIL — `Cannot find module './app.js'`.

- [ ] **Step 5: Implement `server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test --prefix server -- app.test`
Expected: PASS, 1 test green.

- [ ] **Step 7: Implement `server/src/index.ts`**

```ts
import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();

app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
```

- [ ] **Step 8: Verify typecheck, lint, and full suite**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test --prefix server`
Expected: all exit code 0.

- [ ] **Step 9: Commit**

```bash
git add server/src/lib/prisma.ts server/src/app.ts server/src/app.test.ts server/src/index.ts
git commit -m "feat(server): add Prisma singleton and Fastify app skeleton with health check"
```

---

## Task 4: Fastify plugins — JWT + CORS (`plugins/jwt.ts`, `plugins/cors.ts`)

**Files:**
- Create: `server/src/plugins/jwt.ts`
- Create: `server/src/plugins/cors.ts`
- Create: `server/src/types/fastify.d.ts`
- Modify: `server/src/app.ts` (register both plugins)
- Test: `server/src/plugins/jwt.test.ts`

**Interfaces:**
- Consumes: `buildApp()` (Task 3), `env` (Task 2).
- Produces: `app.jwt.sign(payload)` / `request.jwtVerify()` (from `@fastify/jwt`, registered globally); `app.authenticate` preHandler decorator (401s on missing/invalid token, otherwise sets `request.user = { userId }`) — used by Task 5 (`GET /auth/me`, `POST /auth/change-password`), Task 6 (tenant middleware runs after this), Task 7 (avatar upload).

- [ ] **Step 1: Add `@fastify/jwt` type augmentation — `server/src/types/fastify.d.ts`**

```ts
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string };
    user: { userId: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
```

- [ ] **Step 2: Implement `server/src/plugins/jwt.ts`**

```ts
import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

export default fp(async (app) => {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});
```

- [ ] **Step 3: Implement `server/src/plugins/cors.ts`**

```ts
import fastifyCors from '@fastify/cors';
import fp from 'fastify-plugin';

export default fp(async (app) => {
  await app.register(fastifyCors, { origin: true });
});
```

- [ ] **Step 4: Write the failing test — `server/src/plugins/jwt.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

describe('jwt plugin', () => {
  it('rejects a request with no Authorization header via app.authenticate', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    app.get('/protected', { preHandler: app.authenticate }, async () => ({ ok: true }));
    const response = await app.inject({ method: 'GET', url: '/protected' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('accepts a request with a valid Bearer token', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    app.get('/protected', { preHandler: app.authenticate }, async (request) => ({
      userId: request.user.userId,
    }));
    const token = app.jwt.sign({ userId: 'user-123' });
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: 'user-123' });
    await app.close();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm run test --prefix server -- plugins/jwt.test`
Expected: FAIL — `app.authenticate is not a function` (plugin not registered in `app.ts` yet).

- [ ] **Step 6: Register both plugins in `server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import corsPlugin from './plugins/cors.js';
import jwtPlugin from './plugins/jwt.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(corsPlugin);
  await app.register(jwtPlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

**Note (plan correction, discovered while implementing this task):** `buildApp`
changes from synchronous to `async`/`Promise<FastifyInstance>` here, and stays
that way for the rest of the plan. Reason: `@fastify/jwt`'s `app.decorate('authenticate', ...)`
call inside the `fp()`-wrapped plugin only completes once that plugin's own
`app.register(...)` promise resolves — a caller that does `const app = buildApp();`
synchronously and then immediately references `app.authenticate` (e.g. as a
route's `preHandler`) would read `undefined`, because the decorator hasn't
attached yet. Awaiting each `app.register(...)` call inside `buildApp` (and
making callers `await buildApp()`) guarantees decorators exist before they're
used. `server/src/index.ts` (Task 3) must also change to an async IIFE:
```ts
import { buildApp } from './app.js';
import { env } from './config/env.js';

(async () => {
  const app = await buildApp();
  app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
})();
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test --prefix server -- plugins/jwt.test`
Expected: PASS, 2 tests green.

- [ ] **Step 8: Verify typecheck, lint, and full suite**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test --prefix server`
Expected: all exit code 0.

- [ ] **Step 9: Commit**

```bash
git add server/src/types/fastify.d.ts server/src/plugins/jwt.ts server/src/plugins/cors.ts server/src/plugins/jwt.test.ts server/src/app.ts
git commit -m "feat(server): register JWT and CORS Fastify plugins with authenticate decorator"
```

---

## Task 5: Auth routes (`routes/auth.ts`) — register, login, me, change-password

**Files:**
- Create: `server/src/routes/auth.ts`
- Modify: `server/src/app.ts` (register `authRoutes` under `/auth` prefix)
- Test: `server/src/routes/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `hashPassword`/`verifyPassword`/`isStrongPassword` (Task 1), `app.authenticate` (Task 4).
- Produces:
  - `POST /auth/register` (body `{ email, password, fullName }` → 201 `{ id, email, fullName }`, 409 if email taken). Never sets `mustChangePassword` (defaults `false` at the DB level).
  - `POST /auth/login` (body `{ email, password }` → 200 `{ token, user, memberships }`, 401 on bad credentials). `user` shape: `{ id: string; email: string; fullName: string; mustChangePassword: boolean; avatarUrl: string | null }`. `memberships` shape: `{ tenantId: string; tenantName: string; tenantSlug: string; role: string }[]` — this exact shape is what Task 11 (front `authStore`) and Task 12 (`LoginPage`, `TenantSwitcher`) consume.
  - `GET /auth/me` (Bearer token → 200 `{ user, memberships }`, same shapes as login).
  - `POST /auth/change-password` (Bearer token, body `{ currentPassword, newPassword }` → 200 `{ ok: true }`; 401 if `currentPassword` is wrong; 400 if `newPassword` fails `isStrongPassword`). On success, updates `passwordHash` and sets `mustChangePassword: false`. This is what Task 12's `ChangePasswordPage` calls.

Tests in this task mock `../lib/prisma.js` with `vi.mock` — no real DB needed, matching the Global Constraints (unit tests, mocked Prisma).

- [ ] **Step 1: Write the failing test — `server/src/routes/auth.test.ts`**

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenantMembership: {
      findMany: vi.fn(),
    },
  },
}));

const baseUser = {
  id: 'user-1',
  email: 'me@example.com',
  fullName: 'Me',
  mustChangePassword: false,
  avatarUrl: null,
  createdAt: new Date(),
};

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /auth/register creates a user and returns 201', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      ...baseUser,
      passwordHash: 'hashed',
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'new@example.com', password: 'supersecret123', fullName: 'New User' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: 'user-1', email: 'me@example.com', fullName: 'Me' });
    await app.close();
  });

  it('POST /auth/register returns 409 if email already exists', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...baseUser, passwordHash: 'hashed' } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'taken@example.com', password: 'supersecret123', fullName: 'Dup' },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it('POST /auth/login returns a token, user (with mustChangePassword/avatarUrl), and memberships', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    const passwordHash = await hashPassword('supersecret123');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      passwordHash,
      mustChangePassword: true,
    } as never);
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      {
        id: 'mem-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        seatId: null,
        tenant: { id: 'tenant-1', name: 'Tasvalor', slug: 'tasvalor' },
      },
    ] as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'me@example.com', password: 'supersecret123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(typeof body.token).toBe('string');
    expect(body.user).toEqual({
      id: 'user-1',
      email: 'me@example.com',
      fullName: 'Me',
      mustChangePassword: true,
      avatarUrl: null,
    });
    expect(body.memberships).toEqual([
      { tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' },
    ]);
    await app.close();
  });

  it('POST /auth/login returns 401 for wrong password', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      passwordHash: await hashPassword('supersecret123'),
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'me@example.com', password: 'wrong' },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /auth/me requires a valid Bearer token', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('POST /auth/change-password rejects a wrong current password with 401', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      passwordHash: await hashPassword('supersecret123'),
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'wrong', newPassword: 'NewSecret123' },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('POST /auth/change-password rejects a weak new password with 400', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      passwordHash: await hashPassword('supersecret123'),
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'supersecret123', newPassword: 'short' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /auth/change-password updates the hash and clears mustChangePassword on success', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      mustChangePassword: true,
      passwordHash: await hashPassword('supersecret123'),
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...baseUser, mustChangePassword: false } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'supersecret123', newPassword: 'NewSecret123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ mustChangePassword: false }),
      })
    );
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix server -- routes/auth.test`
Expected: FAIL — route `/auth/register` not found (404), module `routes/auth.ts` doesn't exist yet.

- [ ] **Step 3: Implement `server/src/routes/auth.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, isStrongPassword, verifyPassword } from '../lib/password.js';
import { prisma } from '../lib/prisma.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

function toPublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    mustChangePassword: user.mustChangePassword,
    avatarUrl: user.avatarUrl,
  };
}

async function getMemberships(userId: string) {
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId },
    include: { tenant: true },
  });

  return memberships.map((membership) => ({
    tenantId: membership.tenantId,
    tenantName: membership.tenant.name,
    tenantSlug: membership.tenant.slug,
    role: membership.role,
  }));
}

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, fullName: body.fullName },
    });

    return reply.code(201).send({ id: user.id, email: user.email, fullName: user.fullName });
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = app.jwt.sign({ userId: user.id });
    const memberships = await getMemberships(user.id);

    return reply.send({ token, user: toPublicUser(user), memberships });
  });

  app.get('/me', { preHandler: app.authenticate }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.userId } });
    const memberships = await getMemberships(request.user.userId);
    return { user: user && toPublicUser(user), memberships };
  });

  app.post('/change-password', { preHandler: app.authenticate }, async (request, reply) => {
    const body = changePasswordSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    if (!isStrongPassword(body.newPassword)) {
      return reply
        .code(400)
        .send({ error: 'New password must be at least 10 characters and include a letter and a digit' });
    }

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    return reply.send({ ok: true });
  });
}
```

- [ ] **Step 4: Register the routes in `server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import corsPlugin from './plugins/cors.js';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(corsPlugin);
  await app.register(jwtPlugin);
  await app.register(authRoutes, { prefix: '/auth' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --prefix server -- routes/auth.test`
Expected: PASS, 8 tests green.

- [ ] **Step 6: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test:coverage --prefix server`
Expected: all exit code 0; coverage report shows `src/lib`, `src/routes` above the configured thresholds.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/auth.ts server/src/routes/auth.test.ts server/src/app.ts
git commit -m "feat(server): add register/login/me/change-password auth routes"
```

---

## Task 6: Tenant context middleware (`middleware/resolveTenantContext.ts`)

**Files:**
- Create: `server/src/middleware/resolveTenantContext.ts`
- Modify: `server/src/types/fastify.d.ts` (add `tenantId`/`userRole` to `FastifyRequest`)
- Test: `server/src/middleware/resolveTenantContext.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `request.user.userId` (set by Task 4's `app.authenticate`).
- Produces: `resolveTenantContext(request, reply): Promise<void>` preHandler — sets `request.tenantId: string` and `request.userRole: 'owner' | 'admin' | 'member'` on success, sends 400/403 otherwise. This is the preHandler every future business-module route (Sprint 1+) registers alongside `app.authenticate`.

- [ ] **Step 1: Extend `server/src/types/fastify.d.ts`**

```ts
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string };
    user: { userId: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    tenantId?: string;
    userRole?: 'owner' | 'admin' | 'member';
  }
}
```

- [ ] **Step 2: Write the failing test — `server/src/middleware/resolveTenantContext.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: {
      findUnique: vi.fn(),
    },
  },
}));

function makeReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply;
}

describe('resolveTenantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if X-Tenant-Id header is missing', async () => {
    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const request = { headers: {}, user: { userId: 'user-1' } } as unknown as FastifyRequest;
    const reply = makeReply();

    await resolveTenantContext(request, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
  });

  it('returns 403 if no membership exists for the tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(null);

    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const request = {
      headers: { 'x-tenant-id': 'tenant-2' },
      user: { userId: 'user-1' },
    } as unknown as FastifyRequest;
    const reply = makeReply();

    await resolveTenantContext(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it('sets request.tenantId and request.userRole on a valid membership', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin',
      seatId: null,
    } as never);

    const { resolveTenantContext } = await import('./resolveTenantContext.js');
    const request = {
      headers: { 'x-tenant-id': 'tenant-1' },
      user: { userId: 'user-1' },
    } as unknown as FastifyRequest;
    const reply = makeReply();

    await resolveTenantContext(request, reply);

    expect(request.tenantId).toBe('tenant-1');
    expect(request.userRole).toBe('admin');
    expect(reply.code).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test --prefix server -- resolveTenantContext.test`
Expected: FAIL — `Cannot find module './resolveTenantContext.js'`.

- [ ] **Step 4: Implement `server/src/middleware/resolveTenantContext.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function resolveTenantContext(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const tenantId = request.headers['x-tenant-id'];

  if (!tenantId || typeof tenantId !== 'string') {
    reply.code(400).send({ error: 'Missing X-Tenant-Id header' });
    return;
  }

  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: request.user.userId, tenantId } },
  });

  if (!membership) {
    reply.code(403).send({ error: 'No access to this tenant' });
    return;
  }

  request.tenantId = membership.tenantId;
  request.userRole = membership.role;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --prefix server -- resolveTenantContext.test`
Expected: PASS, 3 tests green.

- [ ] **Step 6: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test:coverage --prefix server`
Expected: all exit code 0; coverage still above thresholds.

- [ ] **Step 7: Commit**

```bash
git add server/src/middleware/resolveTenantContext.ts server/src/middleware/resolveTenantContext.test.ts server/src/types/fastify.d.ts
git commit -m "feat(server): add resolveTenantContext middleware"
```

---

## Task 7: Avatar upload (`routes/avatar.ts`) + static file serving

**Files:**
- Create: `server/src/plugins/multipart.ts`
- Create: `server/src/plugins/staticFiles.ts`
- Create: `server/src/routes/avatar.ts`
- Modify: `server/src/app.ts` (register `multipart` + `staticFiles` plugins and `avatarRoutes` under `/auth` prefix)
- Test: `server/src/routes/avatar.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `app.authenticate` (Task 4).
- Produces: `POST /auth/me/avatar` (Bearer token, `multipart/form-data` with a single file field named `avatar` → 200 `{ avatarUrl: string }`, 400 if no file or unsupported mimetype). Static files served at `/uploads/*`. `avatarUrl` is server-relative (e.g. `/uploads/avatars/<userId>.png`) — the frontend (Task 12) must prefix it with `/api` when rendering `<img src>`, because nginx only forwards `/api/*` to this server (see `server/src/routes/avatar.README.md` written in Task 13).

- [ ] **Step 1: Implement `server/src/plugins/multipart.ts`**

```ts
import fastifyMultipart from '@fastify/multipart';
import fp from 'fastify-plugin';

export default fp(async (app) => {
  await app.register(fastifyMultipart, {
    limits: { fileSize: 2 * 1024 * 1024 },
  });
});
```

- [ ] **Step 2: Implement `server/src/plugins/staticFiles.ts`**

```ts
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import fp from 'fastify-plugin';

export default fp(async (app) => {
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });
});
```

- [ ] **Step 3: Write the failing test — `server/src/routes/avatar.test.ts`**

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

function multipartPayload(filename: string, mimetype: string, content: string) {
  const boundary = '----plantestboundary';
  return {
    boundary,
    body:
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="avatar"; filename="${filename}"\r\n` +
      `Content-Type: ${mimetype}\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--\r\n`,
  };
}

describe('avatar upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'POST', url: '/auth/me/avatar' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('rejects an unsupported mimetype with 400', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const { boundary, body } = multipartPayload('avatar.gif', 'image/gif', 'fake-bytes');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/me/avatar',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('stores a PNG file and updates the user avatarUrl', async () => {
    const { prisma } = await import('../lib/prisma.js');
    const fsPromises = await import('node:fs/promises');
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const { boundary, body } = multipartPayload('avatar.png', 'image/png', 'fake-png-bytes');

    const response = await app.inject({
      method: 'POST',
      url: '/auth/me/avatar',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ avatarUrl: '/uploads/avatars/user-1.png' });
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('user-1.png'),
      expect.any(Buffer)
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarUrl: '/uploads/avatars/user-1.png' },
    });
    await app.close();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test --prefix server -- routes/avatar.test`
Expected: FAIL — route `/auth/me/avatar` not found (404), module `routes/avatar.ts` doesn't exist yet.

- [ ] **Step 5: Implement `server/src/routes/avatar.ts`**

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'avatars');

export default async function avatarRoutes(app: FastifyInstance): Promise<void> {
  app.post('/me/avatar', { preHandler: app.authenticate }, async (request, reply) => {
    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      return reply.code(400).send({ error: 'Unsupported image type, use PNG, JPEG or WEBP' });
    }

    const buffer = await file.toBuffer();
    const filename = `${request.user.userId}.${extension}`;

    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await prisma.user.update({ where: { id: request.user.userId }, data: { avatarUrl } });

    return reply.send({ avatarUrl });
  });
}
```

- [ ] **Step 6: Register the new plugins and routes in `server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import corsPlugin from './plugins/cors.js';
import jwtPlugin from './plugins/jwt.js';
import multipartPlugin from './plugins/multipart.js';
import staticFilesPlugin from './plugins/staticFiles.js';
import authRoutes from './routes/auth.js';
import avatarRoutes from './routes/avatar.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(corsPlugin);
  await app.register(jwtPlugin);
  await app.register(multipartPlugin);
  await app.register(staticFilesPlugin);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(avatarRoutes, { prefix: '/auth' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test --prefix server -- routes/avatar.test`
Expected: PASS, 3 tests green.

- [ ] **Step 8: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix server && npm run lint --prefix server && npm run test:coverage --prefix server`
Expected: all exit code 0; coverage still above thresholds (avatar route file is under `src/routes/**`, already in the coverage `include` list from Task 1).

- [ ] **Step 9: Commit**

```bash
git add server/src/plugins/multipart.ts server/src/plugins/staticFiles.ts server/src/routes/avatar.ts server/src/routes/avatar.test.ts server/src/app.ts
git commit -m "feat(server): add avatar upload endpoint with local disk storage"
```

---

## Task 8: Seed script (`prisma/seed.ts`)

**Files:**
- Create: `server/prisma/seed.ts`
- Modify: `server/package.json` (add `prisma.seed` config)

**Interfaces:**
- Consumes: `hashPassword` (Task 1), Prisma models directly (exception to the repository rule — infra script, see Global Constraints).
- Produces: no exported interface — this is an executable script, verified by running it against a real dev database in Task 13 (by the user, not a subagent) rather than a unit test (seeding is inherently a DB-integration action, not a unit).

- [ ] **Step 1: Add the `prisma.seed` entry to `server/package.json`**

Add this top-level key alongside `scripts`/`dependencies`:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 2: Implement `server/prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} — set it in your .env before seeding`);
  }
  return value;
}

async function main() {
  const ownerPassword = requireEnv('SEED_OWNER_PASSWORD');

  const tasvalor = await prisma.tenant.upsert({
    where: { slug: 'tasvalor' },
    update: {},
    create: { name: 'Tasvalor', slug: 'tasvalor' },
  });

  const cionet = await prisma.tenant.upsert({
    where: { slug: 'cionet' },
    update: {},
    create: { name: 'Cionet', slug: 'cionet' },
  });

  const ownerPasswordHash = await hashPassword(ownerPassword);
  const owner = await prisma.user.upsert({
    where: { email: 'correopro@gmail.com' },
    update: {},
    create: {
      email: 'correopro@gmail.com',
      passwordHash: ownerPasswordHash,
      fullName: 'Pablo (Owner)',
      mustChangePassword: true,
    },
  });

  for (const tenant of [tasvalor, cionet]) {
    // 'owner' role in TenantMembership is this project's only notion of
    // "administrator" — there is no separate global-admin flag on User.
    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
      update: {},
      create: { userId: owner.id, tenantId: tenant.id, role: 'owner' },
    });

    const seat = await prisma.seat.create({
      data: {
        tenantId: tenant.id,
        name: 'CEO/Integrator',
        rolesAndResponsibilities: ['Visión', 'Rentabilidad', 'Liderazgo del equipo'],
      },
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

    await prisma.scorecardEntry.createMany({
      data: [
        {
          tenantId: tenant.id,
          metricId: metric.id,
          periodStart: new Date('2026-07-13'),
          actualValue: 12,
          enteredByUserId: owner.id,
        },
        {
          tenantId: tenant.id,
          metricId: metric.id,
          periodStart: new Date('2026-07-20'),
          actualValue: 8,
          enteredByUserId: owner.id,
        },
      ],
    });

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

    await prisma.vTODocument.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        coreValues: ['Honestidad', 'Excelencia', 'Trabajo en equipo'],
        coreFocusPurpose: 'Ayudar a organizaciones a ejecutar su estrategia con disciplina',
        coreFocusNiche: 'Consultoría EOS para pymes',
        tenYearTarget: 'Ser referentes de EOS en el mercado hispanohablante',
        marketingStrategy: {},
        threeYearPicture: {},
        oneYearPlan: {},
      },
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

    await prisma.tenantMembership.updateMany({
      where: { userId: owner.id, tenantId: tenant.id },
      data: { seatId: seat.id },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck --prefix server && npm run lint --prefix server`
Expected: both exit code 0. (Running the seed itself against a real database happens in Task 13, by the user, once `docker-compose.dev.yml` and the dev Postgres connection exist.)

- [ ] **Step 4: Commit**

```bash
git add server/prisma/seed.ts server/package.json
git commit -m "feat(server): add dev seed script for tenants, owner user, and example records"
```

---

## Task 9: Front scaffold + glass theme tokens

**Files:**
- Create: `front/package.json`
- Create: `front/tsconfig.json`
- Create: `front/tsconfig.app.json`
- Create: `front/tsconfig.node.json`
- Create: `front/vite.config.ts`
- Create: `front/eslint.config.js`
- Create: `front/index.html`
- Create: `front/src/main.tsx`
- Create: `front/src/theme/glassTokens.ts`
- Create: `front/src/theme/glass.css`
- Create: `front/src/test/setup.ts`
- Test: `front/src/theme/glassTokens.test.ts`

**Interfaces:**
- Produces: `glassThemeConfig: ThemeConfig` (antd `ConfigProvider` theme object) from `theme/glassTokens.ts` — consumed by Task 12 (`App.tsx`).

- [ ] **Step 1: Create `front/package.json`**

```json
{
  "name": "traction-tool-front",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b && vite build",
    "dev": "vite",
    "preview": "vite preview",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "antd": "^5.21.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.9",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "@vitest/coverage-v8": "^2.1.1",
    "eslint": "^9.10.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.2",
    "typescript-eslint": "^8.5.0",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install --prefix front`
Expected: installs into `front/node_modules`, creates `front/package-lock.json`, exit code 0.

- [ ] **Step 3: Create `front/tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 4: Create `front/tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create `front/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Create `front/vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/components/**', 'src/store/**', 'src/pages/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
```

- [ ] **Step 7: Create `front/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 8: Create `front/eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  }
);
```

- [ ] **Step 9: Create `front/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EOS Tool</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Create `front/src/theme/glass.css`** (tokens copied verbatim from `docs/DESIGN_BRIEF.md`)

```css
:root {
  --glass-bg-primary: rgba(255, 255, 255, 0.55);
  --glass-bg-secondary: rgba(255, 255, 255, 0.35);
  --glass-bg-elevated: rgba(255, 255, 255, 0.75);
  --glass-border: rgba(255, 255, 255, 0.4);
  --glass-blur-sm: blur(8px);
  --glass-blur-md: blur(16px);
  --glass-blur-lg: blur(24px);
  --glass-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);

  --app-bg-gradient: linear-gradient(135deg, #6b8dd6 0%, #8e7ee0 50%, #c084c9 100%);

  --status-on-track: rgba(34, 197, 94, 0.85);
  --status-off-track: rgba(239, 68, 68, 0.85);
  --status-done: rgba(59, 130, 246, 0.85);
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--app-bg-gradient);
}

.glass-panel {
  background: var(--glass-bg-primary);
  backdrop-filter: var(--glass-blur-md);
  -webkit-backdrop-filter: var(--glass-blur-md);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: var(--glass-shadow);
}
```

- [ ] **Step 11: Write the failing test — `front/src/theme/glassTokens.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { glassThemeConfig } from './glassTokens';

describe('glassThemeConfig', () => {
  it('sets colorBgContainer to the glass primary surface token', () => {
    expect(glassThemeConfig.token?.colorBgContainer).toBe('rgba(255, 255, 255, 0.55)');
  });

  it('sets a border radius consistent with the glass-panel CSS class', () => {
    expect(glassThemeConfig.token?.borderRadius).toBe(16);
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `npm run test --prefix front -- glassTokens.test`
Expected: FAIL — `Cannot find module './glassTokens'`.

- [ ] **Step 13: Implement `front/src/theme/glassTokens.ts`**

```ts
import type { ThemeConfig } from 'antd';

export const glassThemeConfig: ThemeConfig = {
  token: {
    colorBgContainer: 'rgba(255, 255, 255, 0.55)',
    colorBgElevated: 'rgba(255, 255, 255, 0.75)',
    colorBorder: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
  },
};
```

- [ ] **Step 14: Run test to verify it passes**

Run: `npm run test --prefix front -- glassTokens.test`
Expected: PASS, 2 tests green.

- [ ] **Step 15: Create `front/src/main.tsx`** (minimal bootstrap; `App` itself arrives in Task 12)

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './theme/glass.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div>EOS Tool — scaffold OK, App.tsx pending (Task 12)</div>
  </React.StrictMode>
);
```

- [ ] **Step 16: Verify typecheck, lint, and full suite**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test --prefix front`
Expected: all exit code 0.

- [ ] **Step 17: Commit**

```bash
git add front/package.json front/package-lock.json front/tsconfig.json front/tsconfig.app.json front/tsconfig.node.json front/vite.config.ts front/eslint.config.js front/index.html front/src/main.tsx front/src/theme front/src/test
git commit -m "feat(front): scaffold Vite/React/AntD package with glassmorphism theme tokens"
```

---

## Task 10: Root config — `package.json`, `docker-compose.dev.yml`, Redis + uploads volume in `docker-compose.yml`, `.env.example`

**Files:**
- Create: `package.json` (root)
- Create: `docker-compose.dev.yml`
- Modify: `docker-compose.yml` (add `redis` service, add `uploads_data` volume, add `REDIS_URL` to `server` environment, mount `uploads_data` on `server`)
- Modify: `.env.example` (add `DEV_DATABASE_URL` and `SEED_OWNER_PASSWORD`)

**Interfaces:**
- Consumes: nothing (pure config/orchestration).
- Produces: `npm run dev` (root) boots the dev stack; `npm run typecheck|lint|test|test:coverage` (root) run both packages' checks — used as the Sprint 0 close-out gate (Task 13).

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "traction-tool",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "docker compose -f docker-compose.dev.yml up --build",
    "dev:down": "docker compose -f docker-compose.dev.yml down",
    "typecheck": "npm --prefix server run typecheck && npm --prefix front run typecheck",
    "lint": "npm --prefix server run lint && npm --prefix front run lint",
    "test": "npm --prefix server run test && npm --prefix front run test",
    "test:coverage": "npm --prefix server run test:coverage && npm --prefix front run test:coverage"
  }
}
```

- [ ] **Step 2: Add `redis` service, `uploads_data` volume, and related `server` config to `docker-compose.yml`**

In the existing `services:` block, add a new `redis` service (leave every other existing service untouched):

```yaml
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    expose:
      - "6379"
```

In the existing `server` service, add to its `environment` block:

```yaml
      REDIS_URL: redis://redis:6379
```

and add a new top-level `volumes` entry under `server`:

```yaml
    volumes:
      - uploads_data:/app/uploads
```

In the file's existing top-level `volumes:` section (currently just `postgres_data`), add:

```yaml
  uploads_data:
```

- [ ] **Step 3: Create `docker-compose.dev.yml`**

```yaml
services:
  migrate:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: ${DEV_DATABASE_URL}
    command: ["npx", "prisma", "migrate", "deploy"]
    restart: "no"

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    expose:
      - "6379"

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    depends_on:
      migrate:
        condition: service_completed_successfully
    environment:
      DATABASE_URL: ${DEV_DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
      PORT: 4000
    volumes:
      - ./server/src:/app/src
      - ./server/prisma:/app/prisma
      - uploads_data:/app/uploads
    command: ["npm", "run", "dev"]
    expose:
      - "4000"

  front:
    build:
      context: ./front
      dockerfile: Dockerfile
      target: builder
      args:
        VITE_API_URL: /api
    volumes:
      - ./front/src:/app/src
      - ./front/index.html:/app/index.html
      - ./front/vite.config.ts:/app/vite.config.ts
    command: ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "80"]
    expose:
      - "80"

  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      - server
      - front
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"

volumes:
  uploads_data:
```

- [ ] **Step 4: Add `DEV_DATABASE_URL` and `SEED_OWNER_PASSWORD` to `.env.example`**

Append this block at the end of the existing file (don't touch the existing `POSTGRES_*`/`JWT_SECRET` lines — those stay for the prod compose):

```
# Solo para docker-compose.dev.yml — Postgres en la máquina de desarrollo, fuera de
# Docker. Ajusta host/puerto/credenciales/nombre de DB a tu instancia local.
DEV_DATABASE_URL=postgresql://postgres:changeme@host.docker.internal:5432/ninety

# Contraseña temporal del usuario owner que crea prisma/seed.ts. No tiene valor por
# defecto a propósito — genera una y no la reutilices en producción.
SEED_OWNER_PASSWORD=changeme_generate_a_temporary_password
```

- [ ] **Step 5: Validate both Compose files parse correctly**

Run: `docker compose -f docker-compose.yml config --quiet && docker compose -f docker-compose.dev.yml config --quiet`
Expected: both exit code 0 (no YAML/schema errors). If it errors on a missing required var, create a local `.env` from `.env.example` first (untracked, don't commit real secrets) — see Task 13.

- [ ] **Step 6: Commit**

```bash
git add package.json docker-compose.yml docker-compose.dev.yml .env.example
git commit -m "feat(infra): add root scripts, dev Compose stack, Redis, and uploads volume"
```

---

## Task 11: Front API client + auth store

**Files:**
- Create: `front/src/lib/apiClient.ts`
- Create: `front/src/store/authStore.ts`
- Test: `front/src/store/authStore.test.ts`

**Interfaces:**
- Consumes: nothing external.
- Produces: `apiFetch<T>(path: string, options?: RequestInit): Promise<T>` from `lib/apiClient.ts` (sets `Content-Type: application/json` unless `options.body` is a `FormData`, in which case it's left for the browser to set with the multipart boundary — needed for Task 12's avatar upload); `useAuthStore` (Zustand hook) exposing `{ token, user, tenants, activeTenantId, login(data), logout(), setActiveTenant(tenantId), updateUser(patch) }` from `store/authStore.ts`, where `user: { id, email, fullName, mustChangePassword, avatarUrl } | null` — both consumed by Task 12 (`LoginPage`, `ChangePasswordPage`, `TenantSwitcher`, `DashboardPage`).

- [ ] **Step 1: Write the failing test — `front/src/store/authStore.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

const loginPayload = {
  token: 'jwt-token',
  user: {
    id: 'user-1',
    email: 'me@example.com',
    fullName: 'Me',
    mustChangePassword: true,
    avatarUrl: null,
  },
  memberships: [
    { tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' },
    { tenantId: 'tenant-2', tenantName: 'Cionet', tenantSlug: 'cionet', role: 'owner' },
  ],
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts logged out', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.tenants).toEqual([]);
  });

  it('login stores token, user, tenants, and defaults activeTenantId to the first tenant', () => {
    useAuthStore.getState().login(loginPayload);
    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-token');
    expect(state.user).toEqual(loginPayload.user);
    expect(state.tenants).toEqual(loginPayload.memberships);
    expect(state.activeTenantId).toBe('tenant-1');
  });

  it('setActiveTenant switches the active tenant', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().setActiveTenant('tenant-2');
    expect(useAuthStore.getState().activeTenantId).toBe('tenant-2');
  });

  it('updateUser merges a partial patch into the current user', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().updateUser({ mustChangePassword: false, avatarUrl: '/uploads/avatars/user-1.png' });
    const state = useAuthStore.getState();
    expect(state.user).toEqual({
      ...loginPayload.user,
      mustChangePassword: false,
      avatarUrl: '/uploads/avatars/user-1.png',
    });
  });

  it('logout clears everything', () => {
    useAuthStore.getState().login(loginPayload);
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.tenants).toEqual([]);
    expect(state.activeTenantId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- authStore.test`
Expected: FAIL — `Cannot find module './authStore'`.

- [ ] **Step 3: Implement `front/src/store/authStore.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TenantMembershipView {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  avatarUrl: string | null;
}

interface LoginPayload {
  token: string;
  user: AuthUser;
  memberships: TenantMembershipView[];
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  tenants: TenantMembershipView[];
  activeTenantId: string | null;
  login: (payload: LoginPayload) => void;
  logout: () => void;
  setActiveTenant: (tenantId: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      tenants: [],
      activeTenantId: null,
      login: ({ token, user, memberships }) =>
        set({
          token,
          user,
          tenants: memberships,
          activeTenantId: memberships[0]?.tenantId ?? null,
        }),
      logout: () => set({ token: null, user: null, tenants: [], activeTenantId: null }),
      setActiveTenant: (tenantId) => set({ activeTenantId: tenantId }),
      updateUser: (patch) =>
        set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user })),
    }),
    { name: 'traction-tool-auth' }
  )
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix front -- authStore.test`
Expected: PASS, 5 tests green.

- [ ] **Step 5: Implement `front/src/lib/apiClient.ts`** (no unit test — thin wrapper exercised indirectly through `LoginPage`'s and `ChangePasswordPage`'s tests in Task 12)

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

  return response.json() as Promise<T>;
}
```

- [ ] **Step 6: Verify typecheck, lint, and full suite**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test --prefix front`
Expected: all exit code 0.

- [ ] **Step 7: Commit**

```bash
git add front/src/lib/apiClient.ts front/src/store/authStore.ts front/src/store/authStore.test.ts
git commit -m "feat(front): add API client and auth store with mustChangePassword/avatarUrl support"
```

---

## Task 12: Front pages — Login, ChangePassword, TenantSwitcher, Dashboard with avatar, App shell

**Files:**
- Create: `front/src/pages/LoginPage.tsx`
- Create: `front/src/pages/ChangePasswordPage.tsx`
- Create: `front/src/components/TenantSwitcher.tsx`
- Create: `front/src/components/AvatarUploader.tsx`
- Create: `front/src/pages/DashboardPage.tsx`
- Create: `front/src/App.tsx`
- Modify: `front/src/main.tsx` (render `App` instead of the scaffold placeholder)
- Test: `front/src/components/TenantSwitcher.test.tsx`
- Test: `front/src/pages/LoginPage.test.tsx`
- Test: `front/src/pages/ChangePasswordPage.test.tsx`
- Test: `front/src/components/AvatarUploader.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore`, `apiFetch` (Task 11), `glassThemeConfig` (Task 9).
- Produces: routed app (`/login`, `/change-password`, `/dashboard`) — this is the last front-end task, no downstream consumers within this plan.
- **UI/UX note (see Global Constraints):** these are the screens a real person uses every day — submit buttons must show a loading/disabled state while a request is in flight, errors must be human-readable (not raw JSON), and the avatar uploader must preview the image before AND after a successful upload.

- [ ] **Step 1: Write the failing test — `front/src/components/TenantSwitcher.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { TenantSwitcher } from './TenantSwitcher';

const baseUser = {
  id: 'u1',
  email: 'a@b.com',
  fullName: 'A',
  mustChangePassword: false,
  avatarUrl: null,
};

describe('TenantSwitcher', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('renders nothing when the user belongs to a single tenant', () => {
    useAuthStore.getState().login({
      token: 't',
      user: baseUser,
      memberships: [{ tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });

    const { container } = render(<TenantSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a dropdown with both tenant names when the user belongs to 2+ tenants', () => {
    useAuthStore.getState().login({
      token: 't',
      user: baseUser,
      memberships: [
        { tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' },
        { tenantId: 't2', tenantName: 'Cionet', tenantSlug: 'cionet', role: 'owner' },
      ],
    });

    render(<TenantSwitcher />);
    expect(screen.getByText('Tasvalor')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix front -- TenantSwitcher.test`
Expected: FAIL — `Cannot find module './TenantSwitcher'`.

- [ ] **Step 3: Implement `front/src/components/TenantSwitcher.tsx`**

```tsx
import { Select } from 'antd';
import { useAuthStore } from '../store/authStore';

export function TenantSwitcher() {
  const tenants = useAuthStore((state) => state.tenants);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const setActiveTenant = useAuthStore((state) => state.setActiveTenant);

  if (tenants.length < 2) return null;

  return (
    <Select
      value={activeTenantId ?? undefined}
      onChange={setActiveTenant}
      options={tenants.map((tenant) => ({ value: tenant.tenantId, label: tenant.tenantName }))}
      style={{ minWidth: 160 }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix front -- TenantSwitcher.test`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Write the failing test — `front/src/pages/LoginPage.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LoginPage } from './LoginPage';

vi.mock('../lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    vi.clearAllMocks();
  });

  it('shows a validation error when submitting an empty form', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText(/introduce tu email/i)).toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight, then logs in', async () => {
    const { apiFetch } = await import('../lib/apiClient');
    let resolveLogin: (value: unknown) => void = () => {};
    vi.mocked(apiFetch).mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'me@example.com');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'supersecret123');
    const submitButton = screen.getByRole('button', { name: /entrar/i });
    await userEvent.click(submitButton);

    expect(submitButton).toBeDisabled();

    resolveLogin({
      token: 'jwt-token',
      user: { id: 'user-1', email: 'me@example.com', fullName: 'Me', mustChangePassword: false, avatarUrl: null },
      memberships: [{ tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });

    await vi.waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-token'));
  });

  it('shows a human-readable error on invalid credentials', async () => {
    const { apiFetch } = await import('../lib/apiClient');
    const { ApiError } = await import('../lib/apiClient');
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(401, 'Invalid email or password'));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email/i), 'me@example.com');
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(/email o contraseña incorrectos/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test --prefix front -- LoginPage.test`
Expected: FAIL — `Cannot find module './LoginPage'`.

- [ ] **Step 7: Implement `front/src/pages/LoginPage.tsx`**

```tsx
import { Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuthStore, type AuthUser, type TenantMembershipView } from '../store/authStore';

interface LoginResponse {
  token: string;
  user: AuthUser;
  memberships: TenantMembershipView[];
}

export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: { email: string; password: string }) {
    setError(null);
    setSubmitting(true);
    try {
      const response = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      login(response);
      navigate(response.user.mustChangePassword ? '/change-password' : '/dashboard');
    } catch {
      setError('Email o contraseña incorrectos');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '15vh' }}>
      <Card className="glass-panel" style={{ width: 360 }}>
        <Typography.Title level={3}>EOS Tool</Typography.Title>
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Introduce tu email' }]}
          >
            <Input type="email" autoComplete="username" />
          </Form.Item>
          <Form.Item
            label="Contraseña"
            name="password"
            rules={[{ required: true, message: 'Introduce tu contraseña' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {error && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {error}
            </Typography.Text>
          )}
          <Button type="primary" htmlType="submit" block loading={submitting} disabled={submitting}>
            Entrar
          </Button>
        </Form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test --prefix front -- LoginPage.test`
Expected: PASS, 3 tests green.

- [ ] **Step 9: Write the failing test — `front/src/pages/ChangePasswordPage.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ChangePasswordPage } from './ChangePasswordPage';

vi.mock('../lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const baseUser = {
  id: 'user-1',
  email: 'me@example.com',
  fullName: 'Me',
  mustChangePassword: true,
  avatarUrl: null,
};

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().login({
      token: 'jwt-token',
      user: baseUser,
      memberships: [{ tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });
    vi.clearAllMocks();
  });

  it('submits current and new password, then clears mustChangePassword on success', async () => {
    const { apiFetch } = await import('../lib/apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <ChangePasswordPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/contraseña actual/i), 'changeme123');
    await userEvent.type(screen.getByLabelText(/^nueva contraseña$/i), 'NewSecret123');
    await userEvent.type(screen.getByLabelText(/confirma la nueva contraseña/i), 'NewSecret123');
    await userEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    await vi.waitFor(() => expect(useAuthStore.getState().user?.mustChangePassword).toBe(false));
  });

  it('shows an error if the new password and confirmation do not match', async () => {
    render(
      <MemoryRouter>
        <ChangePasswordPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/contraseña actual/i), 'changeme123');
    await userEvent.type(screen.getByLabelText(/^nueva contraseña$/i), 'NewSecret123');
    await userEvent.type(screen.getByLabelText(/confirma la nueva contraseña/i), 'Different123');
    await userEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm run test --prefix front -- ChangePasswordPage.test`
Expected: FAIL — `Cannot find module './ChangePasswordPage'`.

- [ ] **Step 11: Implement `front/src/pages/ChangePasswordPage.tsx`**

```tsx
import { Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordPage() {
  const updateUser = useAuthStore((state) => state.updateUser);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    setError(null);
    if (values.newPassword !== values.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      updateUser({ mustChangePassword: false });
      navigate('/dashboard');
    } catch {
      setError('No se pudo actualizar la contraseña. Revisa la contraseña actual.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '15vh' }}>
      <Card className="glass-panel" style={{ width: 400 }}>
        <Typography.Title level={3}>Actualiza tu contraseña</Typography.Title>
        <Typography.Paragraph type="secondary">
          Tu contraseña actual es temporal. Elige una nueva de al menos 10 caracteres,
          con al menos una letra y un número.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Contraseña actual"
            name="currentPassword"
            rules={[{ required: true, message: 'Introduce tu contraseña actual' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="Nueva contraseña"
            name="newPassword"
            rules={[{ required: true, message: 'Introduce una nueva contraseña' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Confirma la nueva contraseña"
            name="confirmPassword"
            rules={[{ required: true, message: 'Confirma la nueva contraseña' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          {error && (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {error}
            </Typography.Text>
          )}
          <Button type="primary" htmlType="submit" block loading={submitting} disabled={submitting}>
            Actualizar contraseña
          </Button>
        </Form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm run test --prefix front -- ChangePasswordPage.test`
Expected: PASS, 2 tests green.

- [ ] **Step 13: Write the failing test — `front/src/components/AvatarUploader.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { AvatarUploader } from './AvatarUploader';

vi.mock('../lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const baseUser = {
  id: 'user-1',
  email: 'me@example.com',
  fullName: 'Me',
  mustChangePassword: false,
  avatarUrl: null,
};

describe('AvatarUploader', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().login({
      token: 'jwt-token',
      user: baseUser,
      memberships: [{ tenantId: 't1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });
    vi.clearAllMocks();
  });

  it('uploads the selected file as multipart form data and updates the store avatarUrl', async () => {
    const { apiFetch } = await import('../lib/apiClient');
    vi.mocked(apiFetch).mockResolvedValue({ avatarUrl: '/uploads/avatars/user-1.png' });

    render(<AvatarUploader />);

    const file = new File(['fake-bytes'], 'avatar.png', { type: 'image/png' });
    const input = screen.getByLabelText(/cambiar foto/i);
    await userEvent.upload(input, file);

    await vi.waitFor(() =>
      expect(useAuthStore.getState().user?.avatarUrl).toBe('/uploads/avatars/user-1.png')
    );
    expect(apiFetch).toHaveBeenCalledWith(
      '/auth/me/avatar',
      expect.objectContaining({ method: 'POST' })
    );
    const callArgs = vi.mocked(apiFetch).mock.calls[0][1];
    expect(callArgs?.body).toBeInstanceOf(FormData);
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npm run test --prefix front -- AvatarUploader.test`
Expected: FAIL — `Cannot find module './AvatarUploader'`.

- [ ] **Step 15: Implement `front/src/components/AvatarUploader.tsx`**

```tsx
import { Avatar, Upload, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';

interface AvatarUploadResponse {
  avatarUrl: string;
}

export function AvatarUploader() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const displayUrl = previewUrl ?? (user?.avatarUrl ? `/api${user.avatarUrl}` : undefined);

  async function handleUpload(file: File) {
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await apiFetch<AvatarUploadResponse>('/auth/me/avatar', {
        method: 'POST',
        body: formData,
      });
      updateUser({ avatarUrl: response.avatarUrl });
    } catch {
      message.error('No se pudo subir la foto. Prueba con un PNG, JPEG o WEBP de menos de 2MB.');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
    return false;
  }

  return (
    <Upload
      accept="image/png,image/jpeg,image/webp"
      showUploadList={false}
      beforeUpload={handleUpload}
    >
      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar size={40} src={displayUrl} icon={!displayUrl ? <UserOutlined /> : undefined} />
        <span aria-hidden="true">{uploading ? 'Subiendo…' : 'Cambiar foto'}</span>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
          <input aria-label="Cambiar foto" type="file" />
        </span>
      </label>
    </Upload>
  );
}
```

- [ ] **Step 16: Add `@ant-design/icons` dependency**

Run: `npm install --prefix front @ant-design/icons`
Expected: added to `front/package.json`, exit code 0.

- [ ] **Step 17: Run test to verify it passes**

Run: `npm run test --prefix front -- AvatarUploader.test`
Expected: PASS, 1 test green. If AntD's `Upload` internals swallow the visually-hidden `<input aria-label>` before `userEvent.upload` can target it, replace the hidden `<input>` wrapper with AntD's own `customRequest`-free `Upload` input by inspecting the rendered DOM (`screen.debug()`) and adjust the accessible name/selector accordingly — the requirement that matters is "clicking the visible control opens a file picker wired to `handleUpload`", not the exact DOM shape.

- [ ] **Step 18: Implement `front/src/pages/DashboardPage.tsx`** (no dedicated test — trivial composition of already-tested pieces, covered indirectly; exempt from the coverage-threshold files list in Task 9's `vite.config.ts` `include`)

```tsx
import { Layout, Typography } from 'antd';
import { Navigate } from 'react-router-dom';
import { AvatarUploader } from '../components/AvatarUploader';
import { TenantSwitcher } from '../components/TenantSwitcher';
import { useAuthStore } from '../store/authStore';

export function DashboardPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const tenants = useAuthStore((state) => state.tenants);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const logout = useAuthStore((state) => state.logout);

  if (!token) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;

  const activeTenant = tenants.find((tenant) => tenant.tenantId === activeTenantId);

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Layout.Header
        className="glass-panel"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 16 }}
      >
        <Typography.Text strong>{activeTenant?.tenantName ?? 'EOS Tool'}</Typography.Text>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <TenantSwitcher />
          <AvatarUploader />
          <Typography.Text>{user?.fullName}</Typography.Text>
          <a onClick={logout}>Salir</a>
        </div>
      </Layout.Header>
      <Layout.Content className="glass-panel" style={{ margin: 16, padding: 24 }}>
        <Typography.Title level={4}>Sprint 0 — fundación lista</Typography.Title>
        <Typography.Paragraph>
          Auth, tenant-context, cambio de contraseña forzado y subida de avatar
          funcionando end-to-end. Los módulos (Rocks, Scorecard, L10, Issues,
          Accountability Chart, V/TO) llegan en sus sprints correspondientes.
        </Typography.Paragraph>
      </Layout.Content>
    </Layout>
  );
}
```

- [ ] **Step 19: Implement `front/src/App.tsx`**

```tsx
import { ConfigProvider } from 'antd';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { glassThemeConfig } from './theme/glassTokens';

export function App() {
  return (
    <ConfigProvider theme={glassThemeConfig}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
```

- [ ] **Step 20: Update `front/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './theme/glass.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 21: Verify typecheck, lint, and full suite with coverage**

Run: `npm run typecheck --prefix front && npm run lint --prefix front && npm run test:coverage --prefix front`
Expected: all exit code 0; coverage above the thresholds configured in Task 9.

- [ ] **Step 22: Commit**

```bash
git add front/src/pages front/src/components front/src/App.tsx front/src/main.tsx front/package.json front/package-lock.json
git commit -m "feat(front): add login, forced change-password, tenant switcher, avatar upload, and dashboard shell"
```

---

## Task 13: End-to-end verification gate + functionality docs

**Files:**
- Create: `server/src/routes/auth.README.md`
- Create: `front/src/README.md`

**Interfaces:** none — this task closes out Sprint 0's automated gate. The manual dev-stack run against the real Postgres instance is explicitly the user's step (see below), not a subagent's — no subagent in this plan has the developer's local Postgres credentials.

- [ ] **Step 1: Write `server/src/routes/auth.README.md`**

```markdown
# Auth + tenant context

## Qué hace

- `POST /auth/register` — crea un usuario (email + password + fullName). 409 si el email ya existe. Nunca marca `mustChangePassword` (solo se activa para cuentas creadas por un admin/el seed).
- `POST /auth/login` — verifica credenciales, devuelve `{ token, user, memberships }`. `user` incluye `mustChangePassword` y `avatarUrl`. `memberships` es la lista de tenants a los que pertenece el usuario, con su rol en cada uno.
- `GET /auth/me` — requiere `Authorization: Bearer <token>`, devuelve el usuario y sus memberships actuales (consulta fresca a la DB, no lo que había en el token al hacer login).
- `POST /auth/change-password` — requiere `Authorization: Bearer <token>` y `{ currentPassword, newPassword }`. 401 si `currentPassword` no coincide, 400 si `newPassword` no cumple la política (`isStrongPassword`: 10+ caracteres, al menos una letra y un dígito). En éxito, actualiza el hash y pone `mustChangePassword: false`.
- `POST /auth/me/avatar` — requiere `Authorization: Bearer <token>`, `multipart/form-data` con un campo `avatar` (PNG/JPEG/WEBP, máx 2MB). Guarda el archivo en el volumen `uploads_data` y devuelve `{ avatarUrl }`. `avatarUrl` es server-relative (`/uploads/avatars/<userId>.<ext>`) — el frontend debe anteponer `/api` al renderizarlo como `<img src>`, porque nginx solo reenvía `/api/*` a este servidor.

## Cambio de contraseña forzado

Solo se activa (`mustChangePassword: true`) para cuentas creadas con contraseña
temporal por un admin o por `prisma/seed.ts` — nunca para auto-registro
(`POST /auth/register`), donde el usuario ya eligió su propia contraseña. El
frontend redirige a `/change-password` en vez de `/dashboard` cuando el login
devuelve `user.mustChangePassword: true`.

## Tenant context

Cualquier ruta de negocio (Rocks, Scorecard, etc., en sprints futuros) debe registrar
`resolveTenantContext` como `preHandler` junto a `app.authenticate`. Requiere el header
`X-Tenant-Id`; responde 400 si falta y 403 si el usuario no tiene membership en ese
tenant. En éxito, inyecta `request.tenantId` y `request.userRole` — los repositorios
tenant-aware de cada módulo consumen `request.tenantId`, nunca acceden a Prisma
directamente (ver CLAUDE.md §4).

## Cómo probarlo manualmente

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD del .env>"}'
```

Copia el `token` de la respuesta y úsalo en `Authorization: Bearer <token>` para
`GET /api/auth/me`.
```

- [ ] **Step 2: Write `front/src/README.md`**

```markdown
# Frontend — Sprint 0

## Qué hace

- `LoginPage` — formulario de email/contraseña contra `POST /auth/login`. Guarda
  token + usuario + tenants en `authStore` (Zustand, persistido en localStorage).
  Si el usuario tiene `mustChangePassword: true`, redirige a `/change-password` en
  vez de `/dashboard`.
- `ChangePasswordPage` — fuerza actualizar la contraseña temporal antes de poder
  usar el dashboard. Valida que la confirmación coincida antes de enviar.
- `TenantSwitcher` — dropdown para cambiar de tenant activo; solo se muestra si el
  usuario pertenece a 2+ tenants (oculto para el caso de un solo tenant).
- `AvatarUploader` — sube una foto de perfil (PNG/JPEG/WEBP) vía
  `POST /auth/me/avatar`, con preview inmediato del archivo elegido y actualización
  del avatar mostrado tras la respuesta del servidor.
- `DashboardPage` — placeholder autenticado: confirma que auth, tenant context,
  cambio de contraseña forzado y avatar funcionan end-to-end. Los módulos de
  negocio (Rocks, Scorecard, L10, Issues, Accountability Chart, V/TO) llegan en
  sus propios sprints — no están aquí todavía.
- `apiClient.apiFetch` — wrapper de `fetch` que añade `Authorization` y
  `X-Tenant-Id` automáticamente desde `authStore`, y deja que el navegador ponga
  el `Content-Type` con boundary cuando el body es `FormData` (subida de avatar).

## Tema visual

Tokens de glassmorphism en `theme/glassTokens.ts` (antd `ConfigProvider`) y
`theme/glass.css` (variables CSS + clase `.glass-panel`), copiados de
`docs/DESIGN_BRIEF.md` — no se inventan valores nuevos, cualquier ajuste de tema pasa
por ese doc primero.
```

- [ ] **Step 3: Verify the root automated gate**

Run: `npm run typecheck && npm run lint && npm test && npm run test:coverage`
Expected: all exit code 0, coverage reports above the thresholds set in Task 9's `vitest.config.ts`/`vite.config.ts`.

- [ ] **Step 4: Verify both Compose files still parse correctly after all changes**

Run: `docker compose -f docker-compose.yml config --quiet && docker compose -f docker-compose.dev.yml config --quiet`
Expected: both exit code 0.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.README.md front/src/README.md
git commit -m "docs: add functionality docs for auth/tenant-context and frontend Sprint 0 flows"
```

- [ ] **Step 6: Hand off manual verification to the user — do not attempt this step yourself**

Sprint 0's automated gate (Steps 3-4) is the implementer's and reviewers'
responsibility. The following is explicitly **for the user**, not a subagent —
no subagent in this plan has credentials for the developer's local Postgres:

1. Copy `.env.example` to `.env` and fill in real values, especially
   `DEV_DATABASE_URL` (pointing at a real database on the dev machine, e.g.
   `ninety_dev`) and `SEED_OWNER_PASSWORD` (a temporary password you'll
   be forced to change on first login).
2. Run `npm run dev` from the repo root.
3. If this is the very first run and `server/prisma/migrations/` is empty, run
   `docker compose -f docker-compose.dev.yml run --rm migrate npx prisma migrate dev --name init`
   once, then re-run `npm run dev`.
4. Seed: `docker compose -f docker-compose.dev.yml exec server npx prisma db seed`.
5. Log in at `http://localhost` with `correopro@gmail.com` / the
   `SEED_OWNER_PASSWORD` you set — confirm you're redirected to
   `/change-password`, then confirm the dashboard loads after changing it, the
   `TenantSwitcher` shows both Tasvalor and Cionet, and uploading an avatar
   image shows it in the header.
6. Confirm tenant isolation manually (CLAUDE.md §7): switching tenants changes
   what's shown; a Tasvalor session cannot see Cionet's data.

Report back once you've done this — the plan's implementer/reviewer work is
finished at Step 5's commit; this final manual pass is yours to run and confirm.
