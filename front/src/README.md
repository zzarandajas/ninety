# Frontend — Sprint 0

## Qué hace

- `LoginPage` — formulario de email/contraseña contra `POST /auth/login`. Guarda
  token + usuario + tenants en `authStore` (Zustand, persistido en localStorage).
  Si el usuario tiene `mustChangePassword: true`, redirige a `/change-password` en
  vez de `/dashboard`.
- `ChangePasswordPage` — fuerza actualizar la contraseña temporal antes de poder
  usar el dashboard. Valida que la confirmación coincida antes de enviar.
- `TenantSwitcher` — dropdown para cambiar de tenant activo; solo se muestra si el
  usuario pertenece a 2+ tenants (oculto para el caso de un solo tenant).
- `AvatarUploader` — sube una foto de perfil (PNG/JPEG/WEBP) vía
  `POST /auth/me/avatar`, con preview inmediato del archivo elegido y actualización
  del avatar mostrado tras la respuesta del servidor.
- `DashboardPage` — placeholder autenticado: confirma que auth, tenant context,
  cambio de contraseña forzado y avatar funcionan end-to-end. Los módulos de
  negocio (Rocks, Scorecard, L10, Issues, Accountability Chart, V/TO) llegan en
  sus propios sprints — no están aquí todavía.
- `apiClient.apiFetch` — wrapper de `fetch` que añade `Authorization` y
  `X-Tenant-Id` automáticamente desde `authStore`, y deja que el navegador ponga
  el `Content-Type` con boundary cuando el body es `FormData` (subida de avatar).

## Tema visual

Tokens de glassmorphism en `theme/glassTokens.ts` (antd `ConfigProvider`) y
`theme/glass.css` (variables CSS + clase `.glass-panel`), copiados de
`docs/DESIGN_BRIEF.md` — no se inventan valores nuevos, cualquier ajuste de tema pasa
por ese doc primero.

`colorPrimary` es el verde corporativo `#16983c` (`--brand-green` en
`glass.css`, con su rampa `--brand-green-dark/-darker/-light/-tint` para
degradados y superficies derivadas). `LoginPage` usa esa rampa para el panel
visual de marca (columna izquierda) — es la única pantalla con fondo de marca
a pantalla completa; el resto de módulos sigue el `--app-bg-gradient` general.

## Accountability Chart (Sprint 1)

- `AccountabilityChartPage` — dos tabs: "Organigrama" y "Usuarios". Consulta
  `GET /seats` y `GET /members` a la vez y refresca ambos tras cualquier
  cambio (asignar seat, cambiar rol, etc. pueden afectar a los dos).
- `OrgChart` — canvas `@xyflow/react`. Las posiciones no se guardan: se
  recalculan siempre desde `Seat.parentSeatId` con `lib/orgChartLayout.ts`
  (layout de árbol simple, sin dagre). Arrastrar un seat sobre otro llama a
  `seatsApi.update(seatId, { parentSeatId })`; si sueltas fuera de un nodo, o
  sobre el mismo padre que ya tenía, no pasa nada (sin llamada a la API).
  Requiere `ResizeObserver` — jsdom no lo trae, hay un polyfill mínimo en
  `test/setup.ts` para los tests que montan este componente.
- `SeatFormDrawer` — crear/editar un seat (nombre, seat superior, roles y
  responsabilidades como tags) y gestionar su ocupante (asignar desde los
  miembros sin seat, o quitar el actual) y borrarlo. El ocupante no se toca
  aquí vía `seatsApi` — se hace con `membershipsApi.update(membershipId,
  { seatId })`, porque el ocupante es una propiedad de la membership.
- `MembersTable` / `InviteMemberModal` — tabla de miembros del tenant (rol,
  seat y activo editables inline si `canManage`) e invitación de usuarios
  nuevos. Si el email invitado no existía, el modal muestra la contraseña
  temporal generada una única vez (no se vuelve a mostrar ni se envía por
  ningún canal — no hay servicio de email en este proyecto).
- `lib/seatsApi.ts` / `lib/membershipsApi.ts` — wrappers finos sobre
  `apiFetch` para `/seats` y `/members` (backend en
  `server/src/routes/seats.README.md` y `members.README.md`).
