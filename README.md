# EOS Tool

Herramienta interna privada estilo EOS/Ninety, multitenant (Tasvalor + Cionet).

## Para Claude Code

Empieza por **`CLAUDE.md`** — ahí está todo lo que necesitas saber antes de tocar
código (stack, regla de multitenancy, diseño, orden de sprints).

Documentos de referencia en `docs/`:
- `IMPLEMENTATION_PLAN.md` — arquitectura completa, modelo de datos, roadmap por sprints
- `DESIGN_BRIEF.md` — tokens y dirección visual (glassmorphism)
- `MCP_SETUP.md` — configuración del MCP 21st.dev

## Desarrollo local (sin Docker)

Requisitos: Node 20+, y Postgres + Redis corriendo en tu máquina (o accesibles
por red) — este proyecto no los levanta por ti en desarrollo.

**1. Configura el entorno del servidor**

```bash
cp server/.env.example server/.env
```

Rellena con tus valores reales: `DATABASE_URL` (tu Postgres local),
`REDIS_URL` (tu Redis local), `JWT_SECRET`, `SEED_OWNER_PASSWORD`.

**2. Instala dependencias** (una vez, o cuando cambien los `package.json`)

```bash
npm install
npm install --prefix server
npm install --prefix front
```

**3. Levanta todo**

```bash
npm run dev
```

Esto aplica migraciones pendientes (`prisma migrate deploy`) y arranca
`server` (tsx watch, puerto 4000) y `front` (Vite, puerto 5173) en paralelo.
El proxy `/api` de Vite reenvía a `localhost:4000`, igual que nginx lo hace
en producción — no hace falta nginx en local.

**4. Siembra datos de desarrollo** (primera vez, o cuando quieras resetear)

```bash
npm run seed
```

**5. Entra**

Abre **http://localhost:5173** y haz login con `correopro@gmail.com` y el
valor de `SEED_OWNER_PASSWORD` de tu `server/.env`. Como el usuario del seed
se crea con `mustChangePassword: true`, la app te redirige a cambiar la
contraseña.

Para generar una migración nueva durante el desarrollo (contra tu Postgres
local, se commitea el resultado):
```bash
npm run migrate:dev -- --name nombre_de_la_migracion
```

## Despliegue en producción (VPS, Docker)

Todo corre en Docker en el VPS, sin excepciones — el flujo local de arriba es
solo para desarrollar, no aplica aquí. Un único punto de entrada:

```
                    ┌─────────────────────────┐
   navegador ──────▶│   nginx  (puerto 80)    │
                    └───────────┬─────────────┘
                     /api/*     │      /* (resto)
                    ┌───────────▼──────┐  ┌────────────▼─────┐
                    │ server (Fastify) │  │ front (nginx+SPA) │
                    └───────────┬──────┘  └───────────────────┘
                                │
                    ┌───────────▼──────┐      ┌──────────┐
                    │    postgres      │      │  redis   │
                    └───────────┬──────┘      └──────────┘
                                │
                    ┌───────────▼──────┐
                    │ migrate (one-shot)│  ← corre antes que `server`,
                    └──────────────────┘     aplica `prisma migrate deploy`
```

`server` y `front` no publican ningún puerto al host — solo `nginx` lo hace.
Nginx reenvía `/api/*` al contenedor `server` y todo lo demás al contenedor
`front` (que sirve el build estático de la SPA con su propio nginx interno).

**Pasos en el VPS** (Docker + Docker Compose ya instalados ahí):

```bash
git clone <repo> && cd <repo>
cp .env.example .env
```

Rellena `.env` con valores **reales de producción** (no reutilices los de tu
`server/.env` local): `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`,
`JWT_SECRET`, `SEED_OWNER_PASSWORD`. `DATABASE_URL` no se pone a mano aquí —
`docker-compose.yml` la arma sola a partir de las variables de Postgres, para
que apunte al contenedor `postgres`, no a `localhost`.

```bash
docker compose up --build -d
docker compose exec server npx prisma db seed   # solo la primera vez
```

`docker compose up` ya aplica las migraciones commiteadas (`migrate deploy`,
vía el contenedor `migrate`) antes de arrancar `server`. Las migraciones
nuevas se generan en local (ver arriba) y se despliegan simplemente haciendo
`git pull` + `docker compose up --build -d` en el VPS — nunca se corre
`migrate dev` contra la base de datos de producción.

HTTPS (443) no está configurado todavía — ver el TODO en `nginx/nginx.conf`;
añadir cuando el VPS tenga dominio y certificado (ej. certbot).

## Sincronización en Tiempo Real (Redis Pub/Sub & WebSockets)

La aplicación cuenta con sincronización live entre usuarios del mismo tenant mediante Redis Pub/Sub y WebSockets de Fastify (`@fastify/websocket`):

1. **Backend (`server/src/lib/redis.ts` & `server/src/plugins/websocket.ts`):**
   - Publicación en Redis Pub/Sub (`publishTenantEvent`) en canales de tenant `tenant:{tenantId}:events` al crear, actualizar o eliminar entidades (Rocks, Scorecard, Issues, Todos, VTO, Seats, L10 Meetings).
   - Suscripción pattern Redis `tenant:*:events` que retransmite automáticamente a las conexiones WebSocket activas en `/ws?token=JWT&tenantId=TENANT_ID`.
   - Aislamiento tenant estricto: Validación de JWT y comprobación de `TenantMembership` en el saludo WebSocket.

2. **Frontend (`front/src/lib/realtime.ts` & `front/src/hooks/useRealtimeSync.ts`):**
   - Cliente singleton de WebSocket con reconexión automática y heartbeat (`ping`/`pong`).
   - Hook React `useRealtimeSync` que permite a cualquier vista suscribirse a eventos y actualizar automáticamente sus datos al detectar modificaciones realizadas por otros usuarios.

---

## Ejecución de Tests y Cobertura (Coverage)

Puedes ejecutar los tests unitarios e integración en cualquier momento desde la raíz o dentro de cada paquete.

### Scripts disponibles en `package.json`

| Comando | Descripción |
| --- | --- |
| `npm test` | Ejecuta **todos** los tests unitarios (`server` y `front`). |
| `npm run test:coverage` | Ejecuta los tests unitarios generando el **informe de cobertura (Coverage)**. |
| `npm run typecheck` | Verifica que no existan errores de tipos en TypeScript. |
| `npm run lint` | Ejecuta el linter ESLint en backend y frontend. |

### Ejecución individual por paquete

- **Solo Backend (`server`):**
  ```bash
  npm test --prefix server
  npm run test:coverage --prefix server
  ```

- **Solo Frontend (`front`):**
  ```bash
  npm test --prefix front
  npm run test:coverage --prefix front
  ```

---

## Estructura

```
ninety/
├── CLAUDE.md                 ← leer primero
├── docker-compose.yml         # producción (VPS)
├── .env.example               # variables de docker-compose.yml
├── nginx/
│   └── nginx.conf            ← reverse proxy: /api → server, resto → front
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── DESIGN_BRIEF.md
│   └── MCP_SETUP.md
├── server/
│   ├── Dockerfile
│   ├── .env.example           # variables de desarrollo local (sin Docker)
│   ├── prisma/schema.prisma
│   ├── prisma/migrations/     # commiteadas, aplicadas por `migrate deploy`
│   └── src/
│       ├── lib/redis.ts       # Pub/Sub con ioredis
│       └── plugins/websocket.ts # Handler de WebSockets Fastify
└── front/
    ├── Dockerfile             ← build multi-stage (producción)
    ├── nginx.spa.conf
    ├── vite.config.ts         ← proxy /api (con ws: true para dev)
    └── src/
        ├── lib/realtime.ts    # Cliente WebSocket frontend
        └── hooks/useRealtimeSync.ts # Hook React para sync en vivo
```

