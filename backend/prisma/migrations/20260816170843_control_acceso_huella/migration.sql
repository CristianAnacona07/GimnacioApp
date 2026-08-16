/*
  Warnings:

  - Added the required column `api_key_hash` to the `dispositivos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dispositivos" ADD COLUMN     "api_key_hash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "huellas" (
    "id" CHAR(24) NOT NULL,
    "dispositivo_id" CHAR(24) NOT NULL,
    "huella_id" INTEGER NOT NULL,
    "usuario_id" CHAR(24) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "huellas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "huellas_usuario_id_idx" ON "huellas"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "huellas_dispositivo_id_huella_id_key" ON "huellas"("dispositivo_id", "huella_id");

-- CreateIndex
CREATE INDEX "citas_profesional_id_fecha_hora_idx" ON "citas"("profesional_id", "fecha", "hora");

-- CreateIndex
CREATE INDEX "rutinas_gym_id_usuario_id_dia_idx" ON "rutinas"("gym_id", "usuario_id", "dia");

-- AddForeignKey
ALTER TABLE "huellas" ADD CONSTRAINT "huellas_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "huellas" ADD CONSTRAINT "huellas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
