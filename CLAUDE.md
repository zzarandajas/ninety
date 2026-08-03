# CLAUDE.md — EOS Tool (herramienta interna estilo EOS/Ninety)

Este archivo es el punto de entrada para Claude Code. Léelo entero antes de tocar código.

> **Idioma (regla obligatoria):** todas las respuestas, explicaciones, mensajes de
> commit y comentarios para el usuario se escriben **siempre en castellano**.
> El código, los identificadores y la documentación técnica interna pueden seguir
> en inglés, pero la comunicación con la persona usuaria nunca en otro idioma.

## 1. Qué es esto

Herramienta interna **privada** (no comercial) para gestionar la metodología EOS en
dos organizaciones distintas del mismo owner: **Tasvalor** y **Cionet**. Multitenant
desde el día 1, pensado para crecer a 5-10 tenants sin fricción, no para miles.

Documento de referencia completo (arquitectura, modelo de datos, roadmap por sprints):
**`docs/IMPLEMENTATION_PLAN.md`** — léelo antes de empezar cualquier sprint.

## 2. Stack (decisiones ya tomadas, no las cuestiones sin motivo)

- **Backend:** Node.js + TypeScript + Fastify
- **ORM:** Prisma + PostgreSQL (ver `server/prisma/schema.prisma`)
- **Frontend:** React + Vite + TypeScript + Ant Design
- **Auth:** JWT propio (email + password, bcrypt). Sin SSO por ahora.
- **Despliegue:** Docker Compose en VPS dedicado
- **Sin** n8n, sin billing, sin multi-idioma, sin dark mode configurable — no lo añadas
  aunque parezca buena idea, no está en scope.

## 3. Desarrollo local vs. producción (decisión ya tomada)

**Desarrollo: Node/npm directo, sin Docker.** `npm run dev` en la raíz levanta
`server` (`tsx watch`, puerto 4000) y `front` (Vite dev server, puerto 5173) en
paralelo vía `concurrently`, contra Postgres y Redis que corren en tu máquina
(no en contenedores gestionados por este proyecto). El proxy `/api` de
`front/vite.config.ts` reemplaza el trabajo de nginx en local: reenruta
`/api/*` a `http://localhost:4000/*` igual que nginx lo hace en producción.
`server/.env` (no `.env` de la raíz, que es solo para Docker/VPS) trae
`DATABASE_URL`/`REDIS_URL` apuntando a `localhost` — copia
`server/.env.example` y ajusta a tu instalación local. Antes de arrancar por
primera vez: `npm run migrate:deploy` (aplica migraciones) y `npm run seed`
(datos de ejemplo). `npm run dev` ya corre `migrate:deploy` automáticamente
antes de arrancar los procesos.

**Producción: todo en Docker**, incluidas las migraciones — así se instala en
el VPS. `docker-compose.yml` no cambia por lo anterior; sigue siendo la única
fuente de verdad para el despliegue real. Servicios:
- `postgres` — sin puerto publicado al host
- `redis` — sin puerto publicado al host
- `migrate` — contenedor **one-shot**: corre `prisma migrate deploy` y termina
  (exit 0). `server` tiene `depends_on: migrate: condition:
  service_completed_successfully`, así que nunca arranca con un schema
  desincronizado. Para generar una migración nueva (esto SÍ se hace en local,
  contra tu Postgres local, no en Docker):
  `npm run migrate:dev --prefix server -- --name X`
  — **`migrate dev` nunca debe apuntar al compose de producción**
  (`docker-compose.yml`) ni ejecutarse contra la base de datos del VPS: puede
  resetear/borrar datos si detecta drift; en producción solo se usa
  `migrate deploy` (ya automatizado por el contenedor `migrate`). El fichero de
  migración generado en local se commitea y es lo que `migrate deploy` aplica
  en el VPS.
- `server` (Fastify/API) — sin puerto publicado, solo `expose: 4000`
- `front` (SPA) — build multi-stage, servido por un nginx interno propio del
  contenedor (`front/nginx.spa.conf`), sin puerto publicado
- `nginx` (edge) — **único** contenedor con el puerto 80 publicado al host.
  Enruta `/api/*` → `server:4000` (con rewrite, quitando el prefijo `/api`) y
  todo lo demás → `front:80`. Config en `nginx/nginx.conf`.

Si añades un endpoint nuevo en `server`, recuerda que desde el navegador se
llama como `/api/lo-que-sea`, no como `http://server:4000/lo-que-sea` — eso
solo es válido dentro de la red interna de Docker (o vía el proxy de Vite en
local, que replica el mismo prefijo).

## 4. Regla de oro: multitenancy (léela dos veces)

Todas las tablas de negocio tienen `tenantId`. **Ningún controller ni servicio llama
directamente a `prisma.<modelo>.findMany/create/update` con el modelo de negocio.**
Todo pasa por repositorios tenant-aware que reciben el `tenantId` en el constructor
y lo inyectan automáticamente en cada query.

```typescript
// ✅ CORRECTO
class RockRepository {
  constructor(private tenantId: string) {}
  findAll() {
    return prisma.rock.findMany({ where: { tenantId: this.tenantId } });
  }
}

// ❌ PROHIBIDO — nunca hagas esto en un controller
prisma.rock.findMany(); // sin filtro de tenant = fuga de datos entre Tasvalor y Cionet
```

El middleware `resolveTenantContext` ya se encarga de:
1. Leer el header `X-Tenant-Id`
2. Verificar `TenantMembership` válida para el usuario del JWT
3. Inyectar `req.tenantId` en el contexto

Si escribes un endpoint nuevo, el primer paso es siempre instanciar el repositorio
con `req.tenantId`, nunca acceder a Prisma "a pelo" desde el controller.

Antes de dar por cerrado cualquier sprint, verifica: ¿hay alguna query de negocio
(Rock, Scorecard, Issue, Meeting, Seat, VTO, Todo) que NO pase por un repositorio
tenant-aware? Si la hay, es un bug de seguridad, no un detalle menor.

## 5. Diseño visual: glassmorphism

Dirección de diseño: **glass / opacidad**, no flat design tradicional de Ant Design
por defecto. Lee `docs/DESIGN_BRIEF.md` antes de construir cualquier vista — define
tokens concretos (blur, opacidad, bordes) para que el resultado sea consistente
entre módulos, no que cada pantalla invente su propio "glass".

## 6. Herramientas de generación UI disponibles

- **MCP 21st.dev (Magic)** — si está configurado en este entorno (ver
  `docs/MCP_SETUP.md`), úsalo para generar/buscar componentes React acordes al
  estilo glass definido en el design brief, en vez de escribir cada componente
  visual desde cero.
- **Skill "UX UI PRO MAX"** — si existe en tu carpeta de skills local
  (`~/.claude/skills/` o equivalente), actívala para el trabajo de frontend/UI de
  este proyecto. Si no la encuentras, ignora esta línea y sigue con
  `docs/DESIGN_BRIEF.md` + Ant Design + la guía de frontend-design estándar.

## 7. Orden de ejecución

Sigue los sprints tal y como están definidos en `docs/IMPLEMENTATION_PLAN.md`,
sección 5 (Sprint 0 → Sprint 7). No saltes de módulo a módulo sin cerrar el anterior
con al menos: modelo Prisma migrado, repositorio tenant-aware, endpoints CRUD,
vista en frontend funcional.

Al terminar cada sprint, corre:
```bash
npm run typecheck && npm run lint && npm test
```
y confirma manualmente que un usuario en Tasvalor no puede ver datos de Cionet
(prueba con las dos seeds de tenant que crea Sprint 0).

## 8. Seeds de desarrollo

El seed script (`server/prisma/seed.ts`, a crear en Sprint 0) debe crear:
- Tenant "Tasvalor" (slug `tasvalor`) y Tenant "Cionet" (slug `cionet`)
- Un usuario owner con membership en ambos tenants
- 2-3 registros de ejemplo por módulo y por tenant, para poder verificar
  visualmente el aislamiento mientras desarrollas
