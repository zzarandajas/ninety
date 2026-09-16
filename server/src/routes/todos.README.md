# Todos

## Qué hace

To-Dos de EOS: tareas de acción corta con un owner y una fecha límite opcional, que pueden
originarse en una reunión L10 (`originatingMeetingId`) o crearse sueltos. Todas las rutas
requieren `Authorization: Bearer <token>` y `X-Tenant-Id`.

- `GET /todos?status=open|done&ownerUserId=<id>` — lista los todos del tenant activo, ordenados
  por `dueDate` ascendente (los que no tienen fecha van al final). Ambos filtros son opcionales
  y combinables.
- `POST /todos` — crea un todo. Body: `{ title, description?, ownerUserId, quarter, dueDate?, originatingMeetingId? }`.
  `title` es texto plano (máx. 255 caracteres) — es lo que se ve en las tablas (Todos, Dashboard,
  L10). `description` es HTML (editor Quill), opcional, para detalle/contexto adicional; no se
  muestra en listados, solo en el modal de edición.
- `PATCH /todos/:id` — actualiza cualquier subconjunto de `title`, `description`, `ownerUserId`,
  `quarter`, `dueDate`, `status`. `originatingMeetingId` no es editable — se fija solo al crear.
- `DELETE /todos/:id` — 204 en éxito, 404 si no existía.

## Sin página propia

Este sprint no incluye una vista `/todos` independiente — los Todos se gestionan únicamente
dentro de `front/src/pages/L10LiveMeetingPage.tsx` (sección "To-Do List"), que es el único
consumidor real hoy. Una lista global de Todos (filtrable por owner, con vista fuera de una
reunión) es candidata a un sprint futuro si se pide — YAGNI por ahora.

## Permisos

Sin ACL por rol, igual que el resto de módulos.

## Frontend

`front/src/lib/todosApi.ts` envuelve estos endpoints. `front/src/components/TodoFormModal.tsx`
es el formulario de crear/editar/borrar, usado desde `L10LiveMeetingPage`. El prop `meetingId`
del modal solo se aplica en modo creación (se envía como `originatingMeetingId`) — editar un
todo existente nunca reasigna su reunión de origen.

## Cómo probarlo manualmente

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD>"}' | jq -r .token)

curl http://localhost/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: <tenantId de Tasvalor>"
```
