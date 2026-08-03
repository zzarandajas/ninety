# V/TO (Vision/Traction Organizer)

## Qué hace

Documento vivo único por tenant (Vision/Traction Organizer clásico de EOS). Todas las
rutas requieren `Authorization: Bearer <token>` y `X-Tenant-Id` (ver `auth.README.md` —
"Tenant context").

- `GET /vto` — devuelve el documento del tenant activo. Si el tenant no tiene ninguno
  todavía (primer acceso), lo crea vacío en el momento vía upsert — nunca hay un 404
  para este endpoint, siempre hay como mucho un documento vacío.
- `PUT /vto` — actualiza cualquier subconjunto de los campos del documento. Body parcial:
  `{ coreValues?, coreFocusPurpose?, coreFocusNiche?, tenYearTarget?, marketingStrategy?, threeYearPicture?, oneYearPlan? }`.
  Los campos `marketingStrategy`/`threeYearPicture`/`oneYearPlan` son objetos JSON
  completos — al enviar uno se reemplaza entero, no se mergea campo a campo (igual que
  hace el frontend: cada pestaña envía el objeto completo de su sección).

## Forma de los campos JSON

- `coreValues: string[]`
- `marketingStrategy: { targetMarket?, threeUniques?: string[], provenProcess?, guarantee? }`
- `threeYearPicture: { futureDate?, revenue?, profit?, measurables?: string[], lookLikeStatements?: string[] }`
- `oneYearPlan: { futureDate?, revenue?, profit?, measurables?: string[], goals?: string[], companyRockIds?: string[] }`

`oneYearPlan.companyRockIds` guarda IDs de `Rock` reales (del módulo de Sprint 2), no
una copia de sus datos — el frontend resuelve título/trimestre en el momento de
mostrarlos vía `rocksApi.list()`. No hay validación de que esos IDs sigan existiendo al
guardar (un Rock borrado deja un ID huérfano) — `VTOPrintView` filtra esos IDs contra la
lista de rocks vigentes al renderizar, sin fallar. `OneYearPlanForm` no filtra (el `Select`
puede mostrar el UUID crudo como chip si el Rock ya no existe); si el usuario guarda esa
sección igualmente, el huérfano se vuelve a persistir tal cual. Se decidió no añadir esa
validación en el backend: es
un caso raro (borrar un Company Rock que está referenciado en el plan anual) y el
peor caso es un ID que simplemente deja de aparecer en pantalla.

## Permisos

Sin ACL por rol, igual que el resto de módulos: cualquier miembro del tenant puede leer
y editar el V/TO. Es una herramienta interna de equipos pequeños de confianza (ver
`rocks.README.md` — "Permisos" para el razonamiento completo).

## Frontend

`front/src/lib/vtoApi.ts` envuelve estos endpoints. `front/src/pages/VTOPage.tsx` es la
vista principal: pestañas por sección (`front/src/components/vto/*Form.tsx`, cada una
con su propio botón "Guardar sección" — el PUT es por sección, no un único formulario
gigante) más un modo "Vista de impresión" (`VTOPrintView.tsx`) de solo lectura pensado
para `window.print()` / "Guardar como PDF" del navegador, sin librería de generación de
PDF (ver razonamiento en `docs/superpowers/plans/2026-07-31-sprint6-vto.md`, sección
"Decisiones de diseño").

## Cómo probarlo manualmente

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD>"}' | jq -r .token)

curl http://localhost/api/vto \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: <tenantId de Tasvalor>"
```
