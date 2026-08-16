-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('agendada', 'cumplida', 'cancelada', 'ausente');

-- AlterTable
ALTER TABLE "gyms" ADD COLUMN     "agenda_activa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "agenda_dias_visibles" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "agenda_duracion_min" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "agenda_horas_minimas_cancelacion" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "agenda_horas_minimas_reserva" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "agenda_precio" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "landing" JSONB NOT NULL DEFAULT '{"activa":false}';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "disponibilidad" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "citas" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "socio_id" CHAR(24) NOT NULL,
    "profesional_id" CHAR(24) NOT NULL,
    "fecha" VARCHAR(10) NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "duracion_min" INTEGER NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'agendada',
    "precio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nota" TEXT NOT NULL DEFAULT '',
    "cancelada_por" CHAR(24),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitaciones" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "token" TEXT NOT NULL,
    "creada_por" CHAR(24) NOT NULL,
    "usada" BOOLEAN NOT NULL DEFAULT false,
    "usada_por" CHAR(24),
    "expira_en" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "citas_gym_id_fecha_idx" ON "citas"("gym_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "invitaciones_token_key" ON "invitaciones"("token");

-- CreateIndex
CREATE INDEX "invitaciones_gym_id_idx" ON "invitaciones"("gym_id");

-- CreateIndex
CREATE INDEX "invitaciones_expira_en_idx" ON "invitaciones"("expira_en");

-- Manual edit (Prisma no expresa índices únicos parciales condicionados por
-- otra columna): dos personas no pueden reservar al mismo profesional a la
-- misma hora, pero solo cuenta si la cita sigue viva — una cancelada libera
-- el hueco. Reemplaza al índice plano que hubiera generado `prisma migrate`.
CREATE UNIQUE INDEX "citas_slot_activo_key" ON "citas"("profesional_id", "fecha", "hora")
  WHERE "estado" IN ('agendada', 'cumplida');

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_cancelada_por_fkey" FOREIGN KEY ("cancelada_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_creada_por_fkey" FOREIGN KEY ("creada_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_usada_por_fkey" FOREIGN KEY ("usada_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
