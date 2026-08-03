#!/usr/bin/env sh
# Vuelca la base de datos de producción a un archivo comprimido con fecha en el nombre.
# Uso: ./backup-db.sh [directorio-destino]  (por defecto: /backups, el volumen del servicio backup)
set -eu

DEST_DIR="${1:-/backups}"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST_FILE="${DEST_DIR}/eos-tool-${TIMESTAMP}.sql"

mkdir -p "${DEST_DIR}"

# pg_dump y gzip por separado (no en pipeline) para que `set -e` sí aborte
# si pg_dump falla — en un pipeline, el exit code visible sería el de gzip,
# que casi siempre es 0 aunque pg_dump haya fallado a medio volcado.
pg_dump "${DATABASE_URL}" > "${DEST_FILE}"
gzip "${DEST_FILE}"

echo "Backup escrito en ${DEST_FILE}.gz"

# Retención: borra backups de más de 14 días para no llenar el volumen sin límite.
find "${DEST_DIR}" -name 'eos-tool-*.sql.gz' -mtime +14 -delete
