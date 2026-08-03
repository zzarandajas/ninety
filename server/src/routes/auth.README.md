# Auth + tenant context

## Qué hace

No hay auto-registro público: esta es una herramienta interna privada. Los usuarios se
crean con `prisma/seed.ts` o, a partir del Sprint 1, con un flujo de invitación hecho
por un admin.

- `POST /auth/login` — verifica credenciales, devuelve `{ token, user, memberships }`. `user` incluye `mustChangePassword` y `avatarUrl`. `memberships` es la lista de tenants a los que pertenece el usuario, con su rol en cada uno.
- `GET /auth/me` — requiere `Authorization: Bearer <token>`, devuelve el usuario y sus memberships actuales (consulta fresca a la DB, no lo que había en el token al hacer login).
- `POST /auth/change-password` — requiere `Authorization: Bearer <token>` y `{ currentPassword, newPassword }`. 401 si `currentPassword` no coincide, 400 si `newPassword` no cumple la política (`isStrongPassword`: 10+ caracteres, al menos una letra y un dígito). En éxito, actualiza el hash y pone `mustChangePassword: false`.
- `POST /auth/me/avatar` — requiere `Authorization: Bearer <token>`, `multipart/form-data` con un campo `avatar` (PNG/JPEG/WEBP, máx 2MB). Responde 403 si el usuario aún tiene `mustChangePassword: true` (la restricción se aplica en el servidor, no solo con el redirect del frontend). Guarda el archivo en el volumen `uploads_data` y devuelve `{ avatarUrl }`. `avatarUrl` es server-relative (`/uploads/avatars/<userId>.<ext>`) — el frontend debe anteponer `/api` al renderizarlo como `<img src>`, porque nginx solo reenvía `/api/*` a este servidor.

## Cambio de contraseña forzado

Se activa (`mustChangePassword: true`) en las cuentas creadas con contraseña temporal
por `prisma/seed.ts` (o por un admin, cuando exista el flujo de invitación). El
frontend redirige a `/change-password` en vez de `/dashboard` cuando el login
devuelve `user.mustChangePassword: true`, y el servidor además rechaza con 403 las
acciones que no sean `GET /auth/me` ni `POST /auth/change-password` mientras la
bandera siga activa.

## Tenant context

Cualquier ruta de negocio (Rocks, Scorecard, etc., en sprints futuros) debe registrar
`resolveTenantContext` como `preHandler` junto a `app.authenticate`. Requiere el header
`X-Tenant-Id`; responde 400 si falta y 403 si el usuario no tiene membership en ese
tenant. En éxito, inyecta `request.tenantId` y `request.userRole` — los repositorios
tenant-aware de cada módulo consumen `request.tenantId`, nunca acceden a Prisma
directamente (ver CLAUDE.md §4).

## Cómo probarlo manualmente

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD del .env>"}'
```

Copia el `token` de la respuesta y úsalo en `Authorization: Bearer <token>` para
`GET /api/auth/me`.
