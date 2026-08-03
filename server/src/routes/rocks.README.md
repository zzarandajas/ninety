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

## Frontend

`front/src/lib/rocksApi.ts` (+ `tenantApi.ts` para el selector de owner) envuelve estos
endpoints. `front/src/pages/RocksBoard.tsx` es la vista Kanban (columnas on_track/
off_track/done, filtros de trimestre y owner), y `front/src/components/RockFormModal.tsx`
el formulario de crear/editar con gestión inline de milestones. Ambos viven dentro del
`AppLayout` compartido (`front/src/components/AppLayout.tsx`).

## Cómo probarlo manualmente

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD>"}' | jq -r .token)

curl http://localhost/api/rocks \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: <tenantId de Tasvalor>"
```
