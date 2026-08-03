# Hardening (Sprint 7)

## Qué hace

Cuatro mejoras de aislamiento multitenant y operación, sin nueva superficie de API:

### 1. Auditoría (`createdByUserId`/`updatedByUserId`)

`Rock`, `Issue`, `Seat`, `ScorecardMetric`, `L10Meeting` y `Todo` llevan ahora `createdByUserId`,
`updatedByUserId`, `createdAt` y `updatedAt` (nullable, no rompen filas ya existentes). Se rellenan
siempre desde `request.user.userId` en la capa de ruta, nunca desde el body del cliente — los
schemas Zod de creación/actualización no los declaran, así que Zod los descarta si el cliente
intenta mandarlos.

Tablas excluidas deliberadamente (ver `docs/superpowers/plans/2026-08-01-sprint7-hardening.md`,
"Decisiones de diseño"): `Milestone`/`L10AgendaItemLog` (sub-registros, no tablas clave),
`ScorecardEntry` (ya tenía `enteredByUserId`/`enteredAt`), `VTODocument` (ya tenía
`updatedByUserId`/`updatedAt`).

### 2. Row-Level Security — preparado, sin activar

`server/prisma/rls/enable-rls.sql` (política `tenant_isolation` + `FORCE ROW LEVEL SECURITY` por
tabla de negocio) y `server/src/lib/tenantPrisma.ts` (`forTenant(tenantId)`, wrapper de Prisma que
fija `app.current_tenant` vía `$transaction` en modo array antes de cada query) están escritos y
testeados a nivel de mecánica, pero **ningún repositorio los usa todavía** y el SQL no se ha
ejecutado contra ninguna base de datos. Activarlo de verdad requiere: (1) conectar `forTenant()` en
las ~12 clases de repositorio (sustituir el `prisma` importado por `forTenant(this.tenantId)` en
cada una), y (2) aplicar `enable-rls.sql` manualmente contra la base de datos real, verificando
después con las queries de comprobación que trae el propio archivo (sección final, comentada) que
el rol que usa `DATABASE_URL` efectivamente ve 0 filas sin `app.current_tenant` fijado. Se decidió
no automatizar esto en Sprint 7 porque un fallo de configuración (falta el `FORCE`, o la variable de
sesión no se propaga bien) puede tumbar la app entera o dar una falsa sensación de seguridad — se
prefirió dejarlo listo para activar con calma, con acceso a un Postgres real, en vez de activarlo a
ciegas.

### 3. Backups

`scripts/backup-db.sh` hace `pg_dump | gzip` con fecha en el nombre y borra backups de más de 14
días. El servicio `backup` en `docker-compose.yml` lo corre una vez al día dentro de un volumen
`backup_data` dedicado. Restaurar un backup:
```bash
gunzip -c /backups/eos-tool-<timestamp>.sql.gz | psql "$DATABASE_URL"
```
**Pendiente del usuario:** la prueba real de restauración (crear un backup con datos reales, tirar
la BD, restaurar, verificar que la app funciona igual) requiere el VPS desplegado — no se ha hecho
en este sprint, mismo patrón que la verificación manual de aislamiento multitenant que arrastran
todos los sprints anteriores.

### 4. Tenant switcher

Ya estaba completo desde Sprint 0 (`front/src/components/TenantSwitcher.tsx`) — se confirmó en
este sprint que cubre el caso de un usuario en 2+ tenants sin necesitar ningún cambio.

### 5. `eslint-plugin-react-hooks`

Activado en `front/eslint.config.js` — `npm run lint --prefix front` ahora falla si algún
componente viola las Rules of Hooks (hooks condicionales, en loops, o después de un `return`
temprano), en vez de depender solo de la revisión manual como en los Sprints 1-6. Cero violaciones
encontradas en el código de los 6 sprints anteriores — quedan 11 warnings `exhaustive-deps`
(distintos de `rules-of-hooks`), todos revisados caso por caso y confirmados como falsos positivos
intencionales (mismo patrón que Sprint 6: usar `JSON.stringify(document.<sección>)` en vez de la
referencia completa del documento para no pisar borradores sin guardar de otras secciones/pestañas).

## Cómo probarlo manualmente

```bash
# Confirmar que el body del cliente no puede suplantar el usuario de auditoría:
curl -X POST http://localhost/api/rocks \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: <tenantId>" \
  -H "Content-Type: application/json" \
  -d '{"title":"x","ownerUserId":"<userId>","quarter":"2026-Q3","isCompanyRock":false,"dueDate":"2026-09-30","createdByUserId":"otro-usuario"}'
# El rock creado debe tener createdByUserId = tu propio userId del JWT, no "otro-usuario".
```
