# Traction Tool

Herramienta interna privada estilo EOS/Ninety, multitenant (Tasvalor + Cionet).

## Para Claude Code

Empieza por **`CLAUDE.md`** — ahí está todo lo que necesitas saber antes de tocar
código (stack, regla de multitenancy, diseño, orden de sprints).

Documentos de referencia en `docs/`:
- `IMPLEMENTATION_PLAN.md` — arquitectura completa, modelo de datos, roadmap por sprints
- `DESIGN_BRIEF.md` — tokens y dirección visual (glassmorphism)
- `MCP_SETUP.md` — configuración del MCP 21st.dev

## Arquitectura de despliegue

Todo corre en Docker, sin excepciones — nada de `npm run dev` sueltos en local
para el flujo "real". Un único punto de entrada:

```
                    ┌─────────────────────────┐
   navegador ──────▶│   nginx  (puerto 80)    │
                    └───────────┬─────────────┘
                     /api/*     │      /* (resto)
                    ┌───────────▼──────┐  ┌────────────▼─────┐
                    │ server (Fastify) │  │ front (nginx+SPA) │
                    └───────────┬──────┘  └───────────────────┘
                                │
                    ┌───────────▼──────┐
                    │    postgres      │
                    └───────────┬──────┘
                                │
                    ┌───────────▼──────┐
                    │ migrate (one-shot)│  ← corre antes que `server`,
                    └──────────────────┘     aplica `prisma migrate deploy`
```

`server` y `front` no publican ningún puerto al host — solo `nginx` lo hace.
Nginx reenvía `/api/*` al contenedor `server` y todo lo demás al contenedor
`front` (que sirve el build estático de la SPA con su propio nginx interno).

## Arranque

```bash
cp .env.example .env       # y rellena los secretos
docker compose up --build
```

Eso ya:
1. Levanta Postgres y espera a que esté healthy
2. Corre el contenedor `migrate` (`prisma migrate deploy`) y espera a que termine con éxito
3. Levanta `server` y `front`
4. Levanta `nginx` sirviendo todo en **http://localhost**

Para generar una migración nueva durante el desarrollo (no en producción):
```bash
docker compose run --rm migrate npx prisma migrate dev --name nombre_de_la_migracion
```

## Estructura

```
traction-tool/
├── CLAUDE.md                 ← leer primero
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf            ← reverse proxy: /api → server, resto → front
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── DESIGN_BRIEF.md
│   └── MCP_SETUP.md
├── server/
│   ├── Dockerfile
│   └── prisma/schema.prisma  ← modelo de datos completo, ya listo
└── front/
    ├── Dockerfile             ← build multi-stage, servido por nginx interno
    └── nginx.spa.conf
```
