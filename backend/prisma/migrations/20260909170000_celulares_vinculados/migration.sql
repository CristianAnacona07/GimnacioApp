-- Celulares a los que el socio le dio permiso de entrar con su huella.
--
-- No confundir con la tabla `huellas`: aquella guarda dedos registrados en los
-- lectores físicos de la puerta. Acá no hay ningún dato biométrico — la huella
-- la valida el propio teléfono y el servidor nunca la ve. Lo único que se
-- guarda es el hash de una llave que el celular presenta para entrar.
CREATE TABLE "celulares_vinculados" (
    "id" CHAR(24) NOT NULL,
    "usuario_id" CHAR(24) NOT NULL,
    "llave_hash" CHAR(64) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso_en" TIMESTAMP(3),

    CONSTRAINT "celulares_vinculados_pkey" PRIMARY KEY ("id")
);

-- Único: es por donde se busca al entrar, y dos filas con la misma llave sería
-- un error que hay que hacer imposible, no detectar después.
CREATE UNIQUE INDEX "celulares_vinculados_llave_hash_key" ON "celulares_vinculados"("llave_hash");

CREATE INDEX "celulares_vinculados_usuario_id_idx" ON "celulares_vinculados"("usuario_id");

-- Cascade: si se borra la cuenta, sus llaves no tienen por qué sobrevivirla.
ALTER TABLE "celulares_vinculados"
    ADD CONSTRAINT "celulares_vinculados_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
