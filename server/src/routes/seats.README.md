# Seats (Accountability Chart)

## Qué hace

CRUD del árbol de seats de un tenant (`Seat.parentSeatId` es la jerarquía).
No incluye la asignación de ocupante — eso vive en `members.ts`
(`PATCH /members/:id { seatId }`), porque el ocupante es una propiedad de la
membership, no del seat.

- `GET /seats` — lista todos los seats del tenant activo, con su ocupante
  activo incluido (`occupants`, filtrado a `isActive: true`, con `user`
  básico). Disponible para cualquier rol (lectura del organigrama).
- `POST /seats` — crea un seat (`name`, `parentSeatId?`,
  `rolesAndResponsibilities?`). Requiere rol `owner` o `admin`.
- `PATCH /seats/:id` — actualiza cualquier subconjunto de esos campos.
  Cambiar `parentSeatId` es el mismo endpoint que usa el drag-and-drop del
  organigrama en el frontend. Requiere `owner`/`admin`.
- `DELETE /seats/:id` — requiere `owner`/`admin`. Bloqueado con 409 si el
  seat tiene seats hijos o un ocupante activo — hay que reasignarlos antes.

## Reglas de negocio (en `SeatRepository`)

- **Sin ciclos:** `PATCH .../parentSeatId` recorre la cadena de padres del
  nuevo `parentSeatId` hacia la raíz; si encuentra el propio seat en esa
  cadena, 409 (`Cannot move a seat under one of its own descendants`).
- **Aislamiento de tenant:** tanto el seat como su `parentSeatId` deben
  pertenecer al tenant activo (`request.tenantId`) — un `parentSeatId` de
  otro tenant da 404, no 403 (no revela que el seat existe en otro tenant).

## Cómo probarlo manualmente

```bash
curl -X POST http://localhost/api/seats \
  -H "Authorization: Bearer <token>" -H "X-Tenant-Id: <tenantId>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ventas","parentSeatId":"<id-del-CEO>"}'
```
