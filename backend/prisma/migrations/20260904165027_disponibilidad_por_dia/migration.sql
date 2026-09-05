-- CreateTable
CREATE TABLE "disponibilidad_dias" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "profesional_id" CHAR(24) NOT NULL,
    "fecha" VARCHAR(10) NOT NULL,
    "desde" VARCHAR(5) NOT NULL,
    "hasta" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disponibilidad_dias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disponibilidad_dias_profesional_id_fecha_idx" ON "disponibilidad_dias"("profesional_id", "fecha");

-- CreateIndex
CREATE INDEX "disponibilidad_dias_gym_id_fecha_idx" ON "disponibilidad_dias"("gym_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidad_dias_profesional_id_fecha_desde_key" ON "disponibilidad_dias"("profesional_id", "fecha", "desde");

-- AddForeignKey
ALTER TABLE "disponibilidad_dias" ADD CONSTRAINT "disponibilidad_dias_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidad_dias" ADD CONSTRAINT "disponibilidad_dias_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sin traspaso del horario semanal viejo (User.disponibilidad): la tabla
-- arranca vacía y cada profesional carga sus días desde el calendario. Se
-- decidió así a propósito — un traspaso automático publicaría días que nadie
-- confirmó bajo el modelo nuevo. El JSON viejo no se borra ni se lee más.
