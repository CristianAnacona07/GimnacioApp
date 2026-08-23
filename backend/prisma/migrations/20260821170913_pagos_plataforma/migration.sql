-- CreateTable
CREATE TABLE "pagos_plataforma" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "metodo" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'pagada',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_plataforma_gym_id_idx" ON "pagos_plataforma"("gym_id");

-- CreateIndex
CREATE INDEX "pagos_plataforma_estado_idx" ON "pagos_plataforma"("estado");

-- CreateIndex
CREATE INDEX "pagos_plataforma_fecha_idx" ON "pagos_plataforma"("fecha");

-- AddForeignKey
ALTER TABLE "pagos_plataforma" ADD CONSTRAINT "pagos_plataforma_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
