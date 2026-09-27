# Scorecard

## Qué hace

Métricas semanales/mensuales con objetivo, y una entrada por semana (celda de
la grid). Todas las rutas requieren `Authorization: Bearer <token>` y
`X-Tenant-Id` (ver `auth.README.md` — "Tenant context").

- `GET /scorecard/metrics?isActive=true|false` — lista las métricas del
  tenant activo. `isActive` acepta únicamente los literales `"true"`/`"false"`
  (no cualquier string truthy) — omitir el parámetro devuelve todas.
- `POST /scorecard/metrics` — crea una métrica. Body: `{ code?, name, ownerUserId, goalValue, comparison, frequency, unit, isActive? }`. `code` (opcional) se normaliza a mayúsculas, `[A-Z0-9_-]{1,40}`, único por tenant (409 si se repite; `""`/`null` lo borra en PATCH). `comparison` es `gte`/`lte`/`eq`, `frequency` es `weekly`/`monthly`.
- `PATCH /scorecard/metrics/:id` — actualiza cualquier subconjunto de los campos anteriores.
- `DELETE /scorecard/metrics/:id` — 204 en éxito, 404 si no existía.
- `GET /scorecard/entries?weeks=12` — todas las entradas del tenant desde hace `weeks` semanas hasta hoy (default 12), de todas las métricas a la vez — el frontend cruza por `metricId`+`periodStart` para construir la grid, no hay un endpoint por métrica.
- `PUT /scorecard/entries` — upsert de una celda. Body: `{ metricId, periodStart, actualValue }`. `enteredByUserId` se toma siempre de `request.user.userId`, nunca del body. 404 si `metricId` no existe en el tenant.

- `POST /scorecard/metrics/import` — alta masiva desde CSV. Body `{ csv }`. 201 `{ created }`.
- `POST /scorecard/entries/import` — carga masiva de valores desde CSV. Body `{ csv }`. 200 `{ upserted }`.

## Importación CSV (alta masiva y valores)

Pensado para volcar métricas y valores que vienen del ERP u otros sistemas.
Spec: `docs/superpowers/specs/2026-09-27-scorecard-import-design.md`.

- **Formato:** CSV, separador `;` o `,` (autodetectado en la cabecera), BOM
  UTF-8 opcional, comillas estándar. Cabeceras sin importar mayúsculas/acentos
  (`Código` = `codigo`). Máx. 1 MB y 2000 filas.
- **Todo o nada:** `server/src/lib/scorecardImport.ts` valida el fichero entero
  (función pura, sin DB). Si hay cualquier error → `400 { error, errors: [{ row,
  field?, message }] }` (`row` = línea del fichero, cabecera = 1, máx. 200
  errores) y no se escribe nada. Si todo es válido, se escribe en una sola
  `$transaction` (`createMany` / `upsertMany` de los repositorios).
- **Alta de métricas** — columnas `codigo, nombre, descripcion?,
  responsable_email, objetivo, comparacion (>=, <=, =), frecuencia (semanal,
  mensual), unidad? (# por defecto)`. El email debe ser miembro activo del
  tenant; código ya existente en el tenant o repetido en el fichero → error.
- **Valores** — columnas `codigo, periodo, valor`. La métrica se busca por
  `code` **solo entre las métricas del tenant activo** (un código de Cionet es
  "desconocido" en Tasvalor). Semanal: fecha `AAAA-MM-DD` o `DD/MM/AAAA`,
  normalizada al lunes UTC. Mensual: `AAAA-MM`, `MM/AAAA` o fecha, normalizada
  al día 1. Valor con coma o punto decimal (`1.234,5` válido). Mismo
  código+periodo dos veces en el fichero → error; si ya hay valor guardado se
  sobrescribe (upsert).
- Métricas sin `code` no pueden recibir valores por importación: hay que
  asignarles código en su ficha.

## Decimal → number

`goalValue` y `actualValue` son `Decimal` en el schema de Prisma. Los
repositorios (`ScorecardMetricRepository`, `ScorecardEntryRepository`)
convierten siempre a `number` de JS vía `.toNumber()` antes de devolver —
nunca se deja un `Decimal` crudo en una respuesta (si no, `JSON.stringify`
lo serializa como string vía su propio `toJSON()`, y el contrato con el
frontend quedaría inconsistente).

## Semana = lunes

`periodStart` es siempre el lunes de la semana a medianoche UTC. El backend
(`server/src/routes/scorecard.ts`, `weeksAgo()`) y el frontend
(`front/src/lib/weeks.ts`, `mondayOf`/`lastNMondays`) calculan sus propias
fechas de forma independiente — no comparten código — así que si algún día
hace falta cambiar la definición de "semana", hay que tocar ambos sitios.
`weeksAgo()` resta días de calendario desde "hoy", sin alinear al lunes —
puede desplazar la ventana de `GET /entries` hasta 6 días respecto a un
corte perfectamente alineado; no afecta a la corrección de lo ya guardado,
solo a cuántas semanas de histórico trae una consulta puntual.

## Permisos

Sin ACL por rol, igual que Rocks (Sprint 2): cualquier miembro del tenant
puede crear/editar/borrar cualquier métrica o entrada. YAGNI — no se pidió
control más fino.

## Frontend

`front/src/lib/scorecardApi.ts` envuelve estos endpoints.
`front/src/pages/ScorecardPage.tsx` es la grid (filas = métricas activas,
columnas = últimas 12 semanas, celdas editables inline con
`evaluateGoal` coloreando verde/rojo, más una columna de tendencia con
Recharts). `front/src/components/ScorecardMetricFormModal.tsx` es el
formulario de crear/editar/borrar métrica (incluye `code`). Ambos dentro del `AppLayout`
compartido. Botones "Alta masiva" e "Importar valores" abren
`front/src/components/ScorecardImportModal.tsx`: descarga de plantilla
(`front/src/lib/scorecardCsv.ts`, generada en cliente; la de valores sale
prerrellenada con los códigos de métricas activas y el periodo actual), subida
del CSV y tabla de errores por fila.

## Cómo probarlo manualmente

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"correopro@gmail.com","password":"<SEED_OWNER_PASSWORD>"}' | jq -r .token)

curl http://localhost/api/scorecard/metrics \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Id: <tenantId de Tasvalor>"
```
