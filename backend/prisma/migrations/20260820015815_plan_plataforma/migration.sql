-- AlterTable
ALTER TABLE "gyms" ADD COLUMN     "plan_plataforma_id" TEXT;

-- CreateTable
CREATE TABLE "planes_plataforma" (
    "id" CHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio_mensual" DECIMAL(10,2) NOT NULL,
    "precio_por_suscriptor" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "planes_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planes_plataforma_deleted_at_idx" ON "planes_plataforma"("deleted_at");

-- CreateIndex
CREATE INDEX "gyms_plan_plataforma_id_idx" ON "gyms"("plan_plataforma_id");

-- AddForeignKey
ALTER TABLE "gyms" ADD CONSTRAINT "gyms_plan_plataforma_id_fkey" FOREIGN KEY ("plan_plataforma_id") REFERENCES "planes_plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
