# Scorecard — alta masiva de métricas e importación de valores (CSV)

Fecha: 2026-09-27

## Objetivo

Poder dar de alta métricas del ERP en bloque y volcar valores semanales/mensuales
desde otros sistemas sin teclear celda a celda en la grid del Scorecard.

## Decisiones

- **Formato:** solo CSV. Separador `;` en plantillas (Excel ES), en subida se
  autodetecta `;` o `,`. UTF-8 con BOM. Parser propio, sin dependencias.
- **Clave de métrica:** nuevo campo `ScorecardMetric.code` (nullable,
  `@@unique([tenantId, code])`, `[A-Z0-9_-]{1,40}`, se normaliza a mayúsculas).
  Editable en el formulario de métrica. Métricas sin código no pueden recibir
  valores por importación.
- **Errores:** todo o nada. Se valida el fichero entero; si hay un error, no se
  graba nada y se devuelve `400 { error, errors: [{ row, field?, message }] }`.
  `row` es el número de línea del fichero (cabecera = 1).
- **Integración:** solo UI (subida manual). Sin tokens de API.

## Plantillas (generadas en frontend)

Alta de métricas — `codigo;nombre;descripcion;responsable_email;objetivo;comparacion;frecuencia;unidad`
- `comparacion`: `>=`, `<=`, `=` (también `gte`, `lte`, `eq`)
- `frecuencia`: `semanal`/`mensual` (también `weekly`/`monthly`)
- `responsable_email`: debe ser miembro activo del tenant
- Código ya existente en el tenant o repetido en el fichero → error

Valores — `codigo;periodo;valor`
- Métrica semanal: `periodo` fecha `AAAA-MM-DD` (o `DD/MM/AAAA`), se normaliza al lunes de esa semana (UTC).
- Métrica mensual: `AAAA-MM` (o una fecha, se normaliza al día 1).
- `valor`: número, coma o punto decimal.
- Mismo código+periodo repetido en el fichero → error. Si ya hay valor guardado, se sobrescribe (upsert).
- La plantilla se descarga prerrellenada con los códigos de las métricas activas y el periodo actual.

## Backend

- `server/src/lib/csv.ts` — `parseCsv(text)`.
- `server/src/lib/scorecardImport.ts` — validación pura (`validateMetricImport`, `validateEntryImport`).
- `ScorecardMetricRepository.createMany`, `ScorecardEntryRepository.upsertMany` — tenant-aware, en `$transaction`.
- `POST /scorecard/metrics/import` y `POST /scorecard/entries/import`, body `{ csv }` (máx 1 MB, 2000 filas).

## Frontend

- Botones "Alta masiva" e "Importar valores" junto a "Nueva métrica".
- `ScorecardImportModal` (modo `metrics`/`entries`): descargar plantilla + guía de columnas, subir CSV, ver resultado o tabla de errores.
- `ApiError` expone el body de error (`details`) para mostrar errores por fila.

## Fuera de alcance

API token para ERP, actualización de métricas existentes vía alta masiva, formato .xlsx.
