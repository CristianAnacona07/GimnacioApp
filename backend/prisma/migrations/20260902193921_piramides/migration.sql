-- CreateTable
CREATE TABLE "piramides" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "usuario_id" CHAR(24) NOT NULL,
    "ejercicio_nombre" TEXT NOT NULL,
    "series" JSONB NOT NULL DEFAULT '[]',
    "nota" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "piramides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "piramides_gym_id_usuario_id_idx" ON "piramides"("gym_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "piramides_usuario_id_ejercicio_nombre_key" ON "piramides"("usuario_id", "ejercicio_nombre");

-- AddForeignKey
ALTER TABLE "piramides" ADD CONSTRAINT "piramides_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piramides" ADD CONSTRAINT "piramides_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
