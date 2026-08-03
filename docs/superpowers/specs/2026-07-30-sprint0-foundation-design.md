# Sprint 0 — Fundación (diseño)

**Fecha:** 2026-07-30
**Estado:** Aprobado (de momento) — pendiente de plan de implementación detallado

## 1. Objetivo y alcance

Inicializar el proyecto EOS Tool según Sprint 0 de `docs/IMPLEMENTATION_PLAN.md` §5:
repo con `server/` (Fastify + Prisma) y `front/` (Vite + React + Ant Design), auth JWT
(registro/login, bcrypt), middleware `resolveTenantContext`, seed de datos de desarrollo,
y arranque conjunto vía Docker Compose (prod-like y dev).

**Fuera de alcance de este sprint:** CRUD y vistas de los 6 módulos de negocio (Rocks,
Scorecard, L10, Issues, Accountability Chart, V/TO) — eso llega sprint a sprint según
`docs/IMPLEMENTATION_PLAN.md` §5, no se salta orden (CLAUDE.md §7). El `schema.prisma`
ya modela todos los módulos (preexistente), pero en Sprint 0 solo se construyen
repositorios/endpoints para el núcleo multitenant (Tenant, User, TenantMembership).

Estado de partida verificado: `server/` solo tiene `Dockerfile` + `prisma/schema.prisma`.
`front/` solo tiene `Dockerfile` + `nginx.spa.conf`. No hay `package.json`, código fuente,
ni git inicializado en ningún sitio del repo.

## 2. Decisiones de alcance confirmadas con el usuario

- **Git:** no se inicializa en este sprint (decisión explícita del usuario).
- **Test runner:** Vitest en `server/` y `front/` (mismo runner ambos, nativo con Vite).
- **Coverage:** obligatorio desde Sprint 0, no opcional ni "para después" — regla
  permanente del proyecto (ver memoria `feedback_testing_required`).
- **Doc de funcionalidad:** cada pieza de trabajo (módulo/feature) debe llevar un `.md`
  explicando qué hace — regla permanente del proyecto (ver memoria
  `feedback_functionality_docs_required`). Este propio documento de spec, más un doc de
  funcionalidad por módulo al cerrar el sprint (ver §7), cubren esta regla para Sprint 0.
- **MCP 21st.dev:** configurado en este entorno durante esta sesión
  (`claude mcp add --transport http 21st ...`) — disponible para generación de
  componentes UI en sprints con vistas de negocio; no imprescindible para Sprint 0
  (solo Login/Dashboard placeholder).
- **Postgres en desarrollo:** standalone en la máquina de desarrollo (fuera de
  Docker), distinto del `postgres` containerizado de producción — ver §8.
- **Redis:** se añade al stack en Sprint 0 como infraestructura (pub/sub para
  WebSocket, sin código de negocio todavía que lo use) — en Docker tanto en
  desarrollo como en producción (a diferencia de Postgres) — ver §9.
- **Cambio de contraseña forzado:** solo aplica a cuentas creadas por un
  admin/el seed con contraseña temporal (`User.mustChangePassword=true`) — el
  auto-registro (`POST /auth/register`, el usuario elige su propia
  contraseña) no lo activa. Ver §4.1.
- **Avatar de usuario:** foto almacenada en disco, en un volumen Docker
  (`uploads_data`), servida como estático — no Base64 en DB, no S3 (fuera de
  escala para 2-10 tenants). Ver §4.2.
- **Contraseña del seed:** ya no hardcodeada en `seed.ts` — se lee de
  `SEED_OWNER_PASSWORD` en `.env` (secreto, no se commitea el valor real).
  El usuario global (`correopro@gmail.com`) se sigue creando con rol
  `owner` en `TenantMembership` para ambos tenants — ya es "administrador"
  en el sentido del modelo de datos (no existe un rol global aparte de los
  roles por tenant). Ver §5.

## 3. Estructura de carpetas

```
server/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── prisma/
│   ├── schema.prisma        (ya existe)
│   └── seed.ts              (nuevo)
└── src/
    ├── index.ts              # bootstrap: build app + listen
    ├── app.ts                # build Fastify instance (separado de index para testear con .inject())
    ├── config/env.ts         # parseo/validación de variables de entorno
    ├── lib/
    │   ├── prisma.ts         # singleton PrismaClient
    │   ├── password.ts       # bcrypt hash/compare
    │   └── jwt.ts            # sign/verify helpers
    ├── plugins/
    │   ├── jwt.ts            # registro @fastify/jwt + decorator req.user
    │   └── cors.ts
    ├── middleware/
    │   └── resolveTenantContext.ts
    ├── routes/
    │   └── auth.ts           # POST /auth/register, POST /auth/login, GET /auth/me
    └── __tests__/            # unit tests, PrismaClient mockeado

front/
├── package.json
├── tsconfig.json
├── vite.config.ts           # vitest embebido
├── eslint.config.js
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx                    # ConfigProvider (tokens glass) + Router
    ├── theme/glassTokens.ts       # tokens de docs/DESIGN_BRIEF.md → antd ConfigProvider
    ├── lib/apiClient.ts           # fetch wrapper: Authorization + X-Tenant-Id
    ├── store/authStore.ts         # Zustand: token, user, tenants[], activeTenantId (persist localStorage)
    ├── components/TenantSwitcher.tsx
    ├── pages/LoginPage.tsx
    ├── pages/DashboardPage.tsx    # placeholder: prueba end-to-end de auth+tenant
    └── __tests__/

package.json                 (raíz, nuevo)
docker-compose.override.yml  (raíz, nuevo)
```

Nota sobre el `package.json` raíz: **no** usa npm workspaces. Los Dockerfiles existentes
construyen `server/` y `front/` con contexto de build aislado (`COPY package*.json ./`
dentro de cada contexto), así que un workspace con lockfile único en la raíz rompería
esa asunción. El `package.json` raíz solo delega comandos vía `--prefix`.

## 4. Backend — auth + tenant context

- JWT payload mínimo: `{ userId }`. Nunca se mete la lista de tenants/roles en el token:
  `resolveTenantContext` consulta `TenantMembership` **fresco en DB en cada request**
  (mismo motivo que la futura Row-Level Security de fase 2 — no confiar en datos
  potencialmente obsoletos si se revoca un membership).
- Endpoints: `POST /auth/register`, `POST /auth/login` (bcrypt), `GET /auth/me`
  (usuario + memberships, para que el front pinte el `TenantSwitcher`).
- `resolveTenantContext` se registra como preHandler en las rutas de negocio futuras
  (no en `/auth/*`). Responde 403 si falta `X-Tenant-Id` o no hay membership válida.
- Regla de oro de multitenancy (CLAUDE.md §4): ningún controller llama a Prisma
  directamente para modelos de negocio. En Sprint 0 no hay controllers de negocio
  todavía (Rock/Scorecard/etc. llegan en sus sprints) — la única excepción legítima es
  `seed.ts`, que es un script de infraestructura de un solo uso, no un controller.

## 5. Seed (`prisma/seed.ts`)

Por CLAUDE.md §8: crea tenants "Tasvalor" (slug `tasvalor`) y "Cionet" (slug `cionet`),
un usuario owner con membership en ambos, y 2-3 registros de ejemplo por módulo y tenant
(`Rock`, `ScorecardMetric` + `ScorecardEntry`, `Issue`, `Seat`, `VTODocument`,
`L10Meeting`) — el schema ya soporta todos esos modelos aunque sus endpoints CRUD no
existan aún, así que sirve para verificar visualmente el aislamiento entre tenants
mientras se desarrollan los sprints siguientes.

## 6. Frontend Sprint 0

Solo lo mínimo para probar el flujo end-to-end: `LoginPage` → guarda token + tenants en
`authStore` → si el usuario pertenece a 2+ tenants, `TenantSwitcher` visible en el
header → `DashboardPage` placeholder mostrando tenant activo y usuario logueado. Nada de
vistas de Rocks/Scorecard/etc. todavía (evita saltar de módulo, CLAUDE.md §7).

Tema glass aplicado vía `ConfigProvider.theme.token` con los valores rgba/blur de
`docs/DESIGN_BRIEF.md` sobre el gradiente de fondo definido ahí.

## 7. Testing + coverage

- Vitest en ambos paquetes. Sin DB real en unit tests de Sprint 0 (mock de
  `PrismaClient` vía `vi.mock`) — nada de testcontainers todavía, se evalúa en un
  sprint de hardening posterior si hace falta.
- Cobertura server: `lib/password.ts`, `lib/jwt.ts`, `middleware/resolveTenantContext.ts`,
  `routes/auth.ts`.
- Cobertura front: `TenantSwitcher`, `authStore`, validación de `LoginPage`
  (Testing Library).
- `@vitest/coverage-v8` en ambos paquetes. Umbral inicial: 80% líneas en
  `lib/`+`middleware/`+`routes/` del server, 70% en componentes del front — se sube
  sprint a sprint, no bloqueante desde ya.
- Doc de funcionalidad por módulo (regla del usuario, ver §2): al cerrar Sprint 0,
  `server/src/routes/auth.README.md` (o equivalente) explicando el flujo de
  auth+tenant-context, y una nota similar en `front/` para el flujo de login/switch
  de tenant.

## 8. Arranque en desarrollo (conjunto)

**Decisión confirmada con el usuario:** en producción, Postgres corre en el contenedor
`postgres` del `docker-compose.yml` (como ya está definido). En desarrollo, Postgres
corre **standalone en la máquina de desarrollo** (fuera de Docker) — no es el mismo
Postgres, ni el mismo flujo de arranque.

Esto descarta un `docker-compose.override.yml` que solo mergee campos sobre el compose
base: excluir limpiamente el servicio `postgres` vía merge es frágil (profiles +
depends_on entre archivos no se comportan como "borrar una dependencia" de forma
fiable). En su lugar: **`docker-compose.dev.yml` standalone**, que ni siquiera define
el servicio `postgres` — solo `migrate`, `server`, `front`, `nginx`, apuntando a la
DB del host vía `host.docker.internal` (Docker Desktop en Windows lo resuelve sin
configuración extra).

```yaml
# docker-compose.dev.yml
services:
  migrate:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: ${DEV_DATABASE_URL}
    command: ["npx", "prisma", "migrate", "deploy"]
    restart: "no"

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
      NODE_ENV: development
      PORT: 4000
    volumes:
      - ./server/src:/app/src
      - ./server/prisma:/app/prisma
    command: ["npm", "run", "dev"]      # tsx watch, hot-reload sin rebuild de imagen
    expose:
      - "4000"

  front:
    build:
      context: ./front
      dockerfile: Dockerfile
      target: builder                   # etapa con node/npm; la final es nginx sin node
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
    depends_on:
      - server
      - front
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
```

`server/package.json` añade `"dev": "tsx watch src/index.ts"` + devDependency `tsx`.

`.env.example` añade (separado de las vars de Postgres-en-Docker de producción, porque
son bases de datos distintas):

```
# Solo para docker-compose.dev.yml — Postgres en la máquina de desarrollo, fuera de
# Docker. Ajusta host/puerto/credenciales/nombre de DB a tu instancia local.
DEV_DATABASE_URL=postgresql://postgres:changeme@host.docker.internal:5432/ninety_dev
```

`package.json` raíz:

```json
{
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

`npm run dev` en la raíz levanta el stack completo en modo desarrollo (hot-reload en
server y front) contra tu Postgres local. `docker compose up --build` (sin `-f`, el
`docker-compose.yml` base) sigue siendo el flujo de producción con Postgres
containerizado, sin tocar.

## 9. Redis (infraestructura, sin código de negocio todavía)

**Decisión confirmada con el usuario:** se añade Redis al stack ahora, en Sprint 0,
como **infraestructura pura** — ningún módulo de negocio lo usa todavía (Sprint 0 solo
tiene auth/tenant, sin features en vivo). Caso de uso previsto: pub/sub para que el
backend Fastify difunda cambios (scorecard, issues, L10 en vivo...) por WebSocket a
todos los clientes conectados de un tenant al instante — justificado porque los
cambios deben propagarse a todos los usuarios a la vez, no solo al que los hizo. La
integración real (dependencia `ioredis`, `lib/redis.ts`, wiring con WebSocket) se
construye en el sprint que primero necesite esa feature en vivo, no en Sprint 0 — no
tiene sentido escribir/testear cliente Redis sin ningún caller (coverage de código
muerto no cuenta como cobertura real).

- **Producción** (`docker-compose.yml`): servicio `redis` (imagen `redis:7-alpine`),
  sin puerto publicado al host (solo accesible entre contenedores, igual que
  `postgres`), sin volumen persistente (pub/sub es efímero, no hay datos que
  sobrevivan a un restart que nos importen). `server` recibe `REDIS_URL` como env var
  desde ya (apuntando a `redis:6379`), aunque no la use ningún código todavía.
- **Desarrollo** (`docker-compose.dev.yml`): mismo servicio `redis` dentro de Docker
  (a diferencia de Postgres, que vive standalone en la máquina de desarrollo) — sin
  datos críticos que proteger, se descarta y recrea sin fricción.

```yaml
# añadido a docker-compose.yml y a docker-compose.dev.yml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    expose:
      - "6379"

  server:
    environment:
      REDIS_URL: redis://redis:6379
      # (resto de env vars sin cambios)
```

## 10. Criterios de cierre de Sprint 0

- `docker compose up --build` (modo prod-like) y `npm run dev` (modo dev, hot-reload)
  levantan el stack completo end-to-end en `http://localhost`.
- Login funciona para el usuario seed, `X-Tenant-Id` se valida correctamente, y un
  usuario de Tasvalor no puede acceder a datos de Cionet (prueba manual con las dos
  seeds, CLAUDE.md §7).
- `npm run typecheck && npm run lint && npm test` (raíz) pasan en verde.
- Coverage reportado (no necesariamente al 100%, pero visible y por encima del umbral
  fijado en §7) en ambos paquetes.
- Doc de funcionalidad de auth+tenant-context presente.
