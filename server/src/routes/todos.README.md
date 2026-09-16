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

## Permisos

Sin ACL por rol, igual que el resto de módulos.

## Frontend

`front/src/lib/todosApi.ts` envuelve estos endpoints. `front/src/components/TodoFormModal.tsx`
es el formulario de crear/editar/borrar, usado desde `TodosPage` (vista `/todos` independiente)
y desde `L10LiveMeetingPage` (sección "To-Do List"). El prop `meetingId` del modal solo se aplica
en modo creación (se envía como `originatingMeetingId`) — editar un todo existente nunca
reasigna su reunión de origen. En ambos consumidores, `title` se muestra como texto plano en
las tablas; `description` (si existe) solo se ve como preview de una línea en la fila del To-Do
dentro de L10, y completa en el modal de edición.

## Cómo probarlo manualmente

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD>"}' | jq -r .token)

curl http://localhost/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: <tenantId de Tasvalor>"
```
