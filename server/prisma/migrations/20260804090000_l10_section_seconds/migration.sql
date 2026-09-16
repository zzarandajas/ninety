-- AlterTable: reemplaza el contador único de sección por un mapa de segundos
-- acumulados por sección (clave = id de sección), para que cada pestaña de la
-- reunión L10 mantenga su propio tiempo al cambiar de sección.
ALTER TABLE "l10_meetings" ADD COLUMN "section_seconds" JSONB NOT NULL DEFAULT '{}';

-- Preserva el tiempo ya acumulado de la sección activa en el nuevo mapa
UPDATE "l10_meetings"
SET "section_seconds" = jsonb_build_object("current_section_id", "current_section_accumulated_seconds")
WHERE "current_section_id" IS NOT NULL;

ALTER TABLE "l10_meetings" DROP COLUMN "current_section_accumulated_seconds";
