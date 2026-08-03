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
  `dropped` respecto al valor que tenía antes fija `resolvedAt` a la fecha actual
  automáticamente; volver a `open`/`discussing` lo limpia a `null`. Reenviar el mismo `status`
  que el issue ya tenía (p. ej. renombrar un issue ya resuelto sin cambiar su estado) no toca
  `resolvedAt`. No hay máquina de estados — cualquier transición es válida (ver "Sin máquina de
  estados" más abajo).
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
(`@dnd-kit/core` + `@dnd-kit/sortable`, con `PATCH /issues/reorder` disparado al soltar) — si el
`PATCH` falla, la página vuelve a pedir la lista al servidor (`refetchIssues()`) en vez de
restaurar un snapshot local, para no pisar un reordenamiento concurrente que sí haya tenido
éxito. `front/src/components/IssueFormModal.tsx` es el formulario de crear/editar/borrar.

## Cómo probarlo manualmente

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD>"}' | jq -r .token)

curl http://localhost/api/issues \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: <tenantId de Tasvalor>"
```
