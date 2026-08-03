# Members (gestión de usuarios de un tenant)

## Qué hace

Gestión de `TenantMembership` dentro del tenant activo: listar, invitar
usuarios nuevos (o añadir usuarios existentes de otro tenant), cambiar rol,
asignar/quitar seat, y activar/desactivar la membership.

- `GET /members` — lista todas las memberships del tenant (activas e
  inactivas, para poder reactivarlas), con `user` y `seat` incluidos.
  Disponible para cualquier rol.
- `POST /members/invite` — `{ email, fullName, role }`. Requiere
  `owner`/`admin`. Ver `services/inviteUser.ts`: si el email ya existe en el
  sistema (en otro tenant), solo se le añade la membership a este tenant, sin
  tocar su contraseña; si no existe, se crea el `User` con una contraseña
  temporal (`mustChangePassword: true`) que se devuelve **una sola vez** en
  la respuesta (`temporaryPassword`) — no se guarda en claro ni se reenvía,
  no hay servicio de email en este proyecto (ver CLAUDE.md §3).
- `PATCH /members/:id` — `{ role?, seatId?, isActive? }`, cualquier
  subconjunto. Requiere `owner`/`admin`.

## Reglas de negocio

- **Nadie puede auto-promocionarse a owner:** tanto `invite` como `PATCH`
  rechazan con 403 un `role: 'owner'` si quien hace la petición
  (`request.userRole`) no es ya `owner`.
- **Un seat, un ocupante activo:** `assignSeat` (usado por el `PATCH`) da 409
  si el seat ya tiene otra membership activa apuntándolo — hay que
  desasignarla primero (o hacerlo desde el drawer del seat en el frontend).
- **Desactivar libera el seat:** `PATCH { isActive: false }` pone `seatId:
  null` automáticamente, para que el seat quede disponible sin un paso
  manual aparte. Reactivar (`isActive: true`) no reasigna seat.
- **Baja de tenant ≠ borrado de usuario:** desactivar una membership no toca
  el `User` — sigue existiendo y puede tener memberships activas en otros
  tenants (o ser reinvitado a este más adelante, lo que reactiva la misma
  fila en vez de duplicarla).

## Cómo probarlo manualmente

```bash
curl -X POST http://localhost/api/members/invite \
  -H "Authorization: Bearer <token>" -H "X-Tenant-Id: <tenantId>" \
  -H "Content-Type: application/json" \
  -d '{"email":"nueva@tasvalor.com","fullName":"Nueva Persona","role":"member"}'
```
