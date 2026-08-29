-- Una plantilla pasa de ser "una lista de ejercicios" a ser una SEMANA
-- completa: se intercala `rutina_plantilla_dias` entre la plantilla y sus
-- ejercicios, y `enfoque` baja de la plantilla al día (cada día tiene el
-- suyo).
--
-- Escrita a mano y no por `prisma migrate dev` porque la generada borraba
-- los ejercicios ya cargados: acá cada plantilla existente conserva los
-- suyos, movidos a un día "Lunes" que se crea para ella.

-- CreateTable
CREATE TABLE "rutina_plantilla_dias" (
    "id" CHAR(24) NOT NULL,
    "plantilla_id" CHAR(24) NOT NULL,
    "dia" "DiaSemana" NOT NULL,
    "enfoque" TEXT,

    CONSTRAINT "rutina_plantilla_dias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rutina_plantilla_dias_plantilla_id_dia_key" ON "rutina_plantilla_dias"("plantilla_id", "dia");

-- AddForeignKey
ALTER TABLE "rutina_plantilla_dias" ADD CONSTRAINT "rutina_plantilla_dias_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "rutina_plantillas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un día "Lunes" por cada plantilla que ya existía, heredando su enfoque.
-- El id sigue el formato de 24 hex del resto del sistema (ver la extensión
-- objectId): se deriva del id de la plantilla, que ya lo cumple.
INSERT INTO "rutina_plantilla_dias" ("id", "plantilla_id", "dia", "enfoque")
SELECT
    substr(md5("id" || '-dia-lunes'), 1, 24),
    "id",
    'Lunes'::"DiaSemana",
    "enfoque"
FROM "rutina_plantillas";

-- Los ejercicios cuelgan ahora del día, no de la plantilla.
ALTER TABLE "rutina_plantilla_ejercicios" ADD COLUMN "dia_id" CHAR(24);

UPDATE "rutina_plantilla_ejercicios" e
SET "dia_id" = d."id"
FROM "rutina_plantilla_dias" d
WHERE d."plantilla_id" = e."plantilla_id";

ALTER TABLE "rutina_plantilla_ejercicios" ALTER COLUMN "dia_id" SET NOT NULL;

-- DropForeignKey / DropIndex / DropColumn del vínculo viejo
ALTER TABLE "rutina_plantilla_ejercicios" DROP CONSTRAINT "rutina_plantilla_ejercicios_plantilla_id_fkey";
DROP INDEX "rutina_plantilla_ejercicios_plantilla_id_orden_key";
ALTER TABLE "rutina_plantilla_ejercicios" DROP COLUMN "plantilla_id";

-- CreateIndex
CREATE UNIQUE INDEX "rutina_plantilla_ejercicios_dia_id_orden_key" ON "rutina_plantilla_ejercicios"("dia_id", "orden");

-- AddForeignKey
ALTER TABLE "rutina_plantilla_ejercicios" ADD CONSTRAINT "rutina_plantilla_ejercicios_dia_id_fkey" FOREIGN KEY ("dia_id") REFERENCES "rutina_plantilla_dias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- El enfoque ya vive en el día
ALTER TABLE "rutina_plantillas" DROP COLUMN "enfoque";
