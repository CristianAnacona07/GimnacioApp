-- CreateTable
CREATE TABLE "rutina_plantillas" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "enfoque" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rutina_plantillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutina_plantilla_ejercicios" (
    "id" CHAR(24) NOT NULL,
    "plantilla_id" CHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "series" INTEGER NOT NULL DEFAULT 0,
    "repeticiones" TEXT NOT NULL DEFAULT '0',
    "instrucciones" TEXT,
    "imagen_url" TEXT,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "rutina_plantilla_ejercicios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rutina_plantillas_gym_id_idx" ON "rutina_plantillas"("gym_id");

-- CreateIndex
CREATE INDEX "rutina_plantillas_deleted_at_idx" ON "rutina_plantillas"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "rutina_plantilla_ejercicios_plantilla_id_orden_key" ON "rutina_plantilla_ejercicios"("plantilla_id", "orden");

-- AddForeignKey
ALTER TABLE "rutina_plantillas" ADD CONSTRAINT "rutina_plantillas_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutina_plantilla_ejercicios" ADD CONSTRAINT "rutina_plantilla_ejercicios_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "rutina_plantillas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
