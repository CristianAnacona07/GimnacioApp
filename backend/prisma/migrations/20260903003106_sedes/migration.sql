-- AlterTable
ALTER TABLE "asistencias" ADD COLUMN     "sede_id" CHAR(24);

-- AlterTable
ALTER TABLE "dispositivos" ADD COLUMN     "sede_id" CHAR(24);

-- AlterTable
ALTER TABLE "invitaciones" ADD COLUMN     "sede_id" CHAR(24);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sede_id" CHAR(24);

-- CreateTable
CREATE TABLE "sedes" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sedes_gym_id_activa_idx" ON "sedes"("gym_id", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "sedes_gym_id_nombre_key" ON "sedes"("gym_id", "nombre");

-- CreateIndex
CREATE INDEX "asistencias_sede_id_fecha_idx" ON "asistencias"("sede_id", "fecha" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
