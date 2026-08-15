-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('superadmin', 'admin', 'entrenador', 'empleado', 'socio');

-- CreateEnum
CREATE TYPE "Cargo" AS ENUM ('recepcionista', 'limpieza', 'nutricionista');

-- CreateEnum
CREATE TYPE "MetodoAsistencia" AS ENUM ('codigo', 'qr', 'huella', 'manual');

-- CreateEnum
CREATE TYPE "MarcaDispositivo" AS ENUM ('zkteco', 'hikvision', 'suprema', 'anviz', 'otro');

-- CreateEnum
CREATE TYPE "TipoMetodoPago" AS ENUM ('digital', 'efectivo');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo');

-- CreateTable
CREATE TABLE "gyms" (
    "id" CHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "slogan" TEXT NOT NULL DEFAULT '',
    "color_primario" TEXT NOT NULL DEFAULT '#f97316',
    "color_secundario" TEXT NOT NULL DEFAULT '#1d4ed8',
    "color_fondo" TEXT NOT NULL DEFAULT '#eef3ff',
    "color_navbar" TEXT NOT NULL DEFAULT '#0f172a',
    "color_menu" TEXT NOT NULL DEFAULT '#1e293b',
    "color_dias" TEXT NOT NULL DEFAULT '#1d4ed8',
    "modulo_rutinas" BOOLEAN NOT NULL DEFAULT true,
    "modulo_progreso" BOOLEAN NOT NULL DEFAULT true,
    "modulo_medidas" BOOLEAN NOT NULL DEFAULT true,
    "modulo_pagos" BOOLEAN NOT NULL DEFAULT true,
    "modulo_noticias" BOOLEAN NOT NULL DEFAULT true,
    "modulo_cronometro" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "spotify_playlist" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "gyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24),
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'socio',
    "cargo" "Cargo",
    "entrenador_id" CHAR(24),
    "codigo_acceso" TEXT NOT NULL DEFAULT '',
    "foto_url" TEXT NOT NULL DEFAULT '',
    "mensaje_motivador" TEXT NOT NULL DEFAULT 'HAZ QUE SUCEDA',
    "identificacion" TEXT NOT NULL DEFAULT '',
    "fecha_nacimiento" TEXT NOT NULL DEFAULT '',
    "sexo" TEXT NOT NULL DEFAULT '',
    "peso_actual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "altura" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "telefono" TEXT NOT NULL DEFAULT '',
    "racha" INTEGER NOT NULL DEFAULT 0,
    "asistencias_mes" INTEGER NOT NULL DEFAULT 0,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" TIMESTAMP(3),
    "reset_token" TEXT,
    "reset_token_expiry" TIMESTAMP(3),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "verify_token" TEXT,
    "verify_token_expiry" TIMESTAMP(3),
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "two_factor_backup_codes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencias" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "usuario_id" CHAR(24) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo" "MetodoAsistencia" NOT NULL DEFAULT 'codigo',
    "registrado_por" CHAR(24),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24),
    "actor_id" CHAR(24),
    "actor_role" TEXT,
    "accion" TEXT NOT NULL,
    "recurso" TEXT,
    "recurso_id" CHAR(24),
    "detalle" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "marca" "MarcaDispositivo" NOT NULL DEFAULT 'zkteco',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultima_conexion" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispositivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" CHAR(24) NOT NULL,
    "usuario_id" CHAR(24) NOT NULL,
    "nombre_usuario" TEXT,
    "gym_id" CHAR(24) NOT NULL,
    "gym_nombre" TEXT,
    "mensaje" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medidas" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "usuario_id" CHAR(24) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peso" DOUBLE PRECISION,
    "cintura" DOUBLE PRECISION,
    "cadera" DOUBLE PRECISION,
    "pecho" DOUBLE PRECISION,
    "brazo" DOUBLE PRECISION,
    "muslo" DOUBLE PRECISION,

    CONSTRAINT "medidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progresos" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24),
    "usuario_id" CHAR(24) NOT NULL,
    "ejercicio_nombre" TEXT NOT NULL,
    "peso_kg" DOUBLE PRECISION,
    "repeticiones" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "noticias" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24),
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "dia" "DiaSemana",
    "hora_inicio" TEXT,
    "hora_fin" TEXT,
    "image_url" TEXT NOT NULL DEFAULT '',
    "whatsapp_url" TEXT NOT NULL DEFAULT '',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "noticias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metodos_pago" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoMetodoPago" NOT NULL DEFAULT 'digital',
    "imagen_url" TEXT,
    "descripcion" TEXT,
    "datos_clave" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24),
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "dias" INTEGER NOT NULL DEFAULT 30,
    "descripcion" TEXT NOT NULL,
    "caracteristicas" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutinas" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "usuario_id" CHAR(24) NOT NULL,
    "nombre" TEXT,
    "dia" "DiaSemana" NOT NULL,
    "enfoque" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rutinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutina_ejercicios" (
    "id" CHAR(24) NOT NULL,
    "rutina_id" CHAR(24) NOT NULL,
    "nombre" TEXT NOT NULL,
    "series" INTEGER NOT NULL DEFAULT 0,
    "repeticiones" TEXT NOT NULL DEFAULT '0',
    "instrucciones" TEXT,
    "imagen_url" TEXT,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "rutina_ejercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "usuario_id" CHAR(24) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo_id" CHAR(24),
    "concepto" TEXT NOT NULL DEFAULT 'Membresía',
    "dias_agregados" INTEGER NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrado_por" CHAR(24),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "transacciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gyms_slug_key" ON "gyms"("slug");

-- CreateIndex
CREATE INDEX "gyms_deleted_at_idx" ON "gyms"("deleted_at");

-- CreateIndex
CREATE INDEX "users_gym_id_idx" ON "users"("gym_id");

-- CreateIndex
CREATE INDEX "users_entrenador_id_idx" ON "users"("entrenador_id");

-- CreateIndex
CREATE INDEX "users_codigo_acceso_idx" ON "users"("codigo_acceso");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_gym_id_key" ON "users"("email", "gym_id");

-- CreateIndex
CREATE INDEX "asistencias_gym_id_fecha_idx" ON "asistencias"("gym_id", "fecha" DESC);

-- CreateIndex
CREATE INDEX "asistencias_gym_id_usuario_id_fecha_idx" ON "asistencias"("gym_id", "usuario_id", "fecha" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_gym_id_created_at_idx" ON "audit_logs"("gym_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_serie_key" ON "dispositivos"("serie");

-- CreateIndex
CREATE INDEX "dispositivos_gym_id_created_at_idx" ON "dispositivos"("gym_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "feedbacks_usuario_id_idx" ON "feedbacks"("usuario_id");

-- CreateIndex
CREATE INDEX "feedbacks_gym_id_created_at_idx" ON "feedbacks"("gym_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "medidas_gym_id_usuario_id_fecha_idx" ON "medidas"("gym_id", "usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "progresos_gym_id_usuario_id_ejercicio_nombre_idx" ON "progresos"("gym_id", "usuario_id", "ejercicio_nombre");

-- CreateIndex
CREATE INDEX "progresos_gym_id_usuario_id_fecha_idx" ON "progresos"("gym_id", "usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "noticias_gym_id_idx" ON "noticias"("gym_id");

-- CreateIndex
CREATE INDEX "noticias_deleted_at_idx" ON "noticias"("deleted_at");

-- CreateIndex
CREATE INDEX "metodos_pago_gym_id_created_at_idx" ON "metodos_pago"("gym_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "metodos_pago_deleted_at_idx" ON "metodos_pago"("deleted_at");

-- CreateIndex
CREATE INDEX "planes_gym_id_idx" ON "planes"("gym_id");

-- CreateIndex
CREATE INDEX "planes_deleted_at_idx" ON "planes"("deleted_at");

-- CreateIndex (reemplazado más abajo por un índice único parcial que respeta el soft-delete)
CREATE INDEX "rutinas_gym_id_usuario_id_dia_idx" ON "rutinas"("gym_id", "usuario_id", "dia");

-- CreateIndex
CREATE INDEX "rutinas_deleted_at_idx" ON "rutinas"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "rutina_ejercicios_rutina_id_orden_key" ON "rutina_ejercicios"("rutina_id", "orden");

-- CreateIndex
CREATE INDEX "transacciones_gym_id_created_at_idx" ON "transacciones"("gym_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transacciones_gym_id_idx" ON "transacciones"("gym_id");

-- CreateIndex
CREATE INDEX "transacciones_usuario_id_idx" ON "transacciones"("usuario_id");

-- CreateIndex
CREATE INDEX "transacciones_deleted_at_idx" ON "transacciones"("deleted_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_entrenador_id_fkey" FOREIGN KEY ("entrenador_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progresos" ADD CONSTRAINT "progresos_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progresos" ADD CONSTRAINT "progresos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "noticias" ADD CONSTRAINT "noticias_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes" ADD CONSTRAINT "planes_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutinas" ADD CONSTRAINT "rutinas_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutinas" ADD CONSTRAINT "rutinas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutina_ejercicios" ADD CONSTRAINT "rutina_ejercicios_rutina_id_fkey" FOREIGN KEY ("rutina_id") REFERENCES "rutinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_metodo_id_fkey" FOREIGN KEY ("metodo_id") REFERENCES "metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manual edit 1/2 (Prisma no expresa uniques compuestos con NULL distinto de forma nativa):
-- Postgres trata cada NULL como distinto en un índice único compuesto, así que
-- users_email_gym_id_key por sí solo no evita que dos superadmins (gym_id IS NULL)
-- compartan el mismo email. Este índice parcial cierra ese hueco.
CREATE UNIQUE INDEX "users_superadmin_email_key" ON "users"("email") WHERE "gym_id" IS NULL;

-- Manual edit 2/2 (Prisma no expresa índices únicos parciales de forma nativa):
-- Reemplaza el índice plano de arriba por uno único parcial que solo mira filas
-- activas, para permitir recrear una rutina en el mismo slot (gym,usuario,día)
-- después de haber borrado (soft-delete) la anterior.
DROP INDEX "rutinas_gym_id_usuario_id_dia_idx";
CREATE UNIQUE INDEX "rutinas_active_slot_key" ON "rutinas"("gym_id", "usuario_id", "dia") WHERE "deleted_at" IS NULL;
