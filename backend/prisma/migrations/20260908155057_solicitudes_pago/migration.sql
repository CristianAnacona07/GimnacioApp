-- El socio avisa que pagó un plan; el gimnasio lo confirma.
--
-- El botón "Adquirir" del socio no puede extender la membresía por su cuenta:
-- sin una pasarela que confirme el pago, cualquiera se regalaría meses tocando
-- un botón. Queda como aviso hasta que alguien del gimnasio lo apruebe.
--
-- monto y dias se copian del plan al crear la solicitud, no se leen al
-- aprobarla: si el gimnasio cambia el precio entre medio, se respeta lo que el
-- socio vio cuando decidió pagar.
CREATE TYPE "EstadoSolicitud" AS ENUM ('pendiente', 'aprobada', 'rechazada');

CREATE TABLE "solicitudes_pago" (
    "id" CHAR(24) NOT NULL,
    "gym_id" CHAR(24) NOT NULL,
    "socio_id" CHAR(24) NOT NULL,
    "plan_id" CHAR(24) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "dias" INTEGER NOT NULL,
    -- La referencia que viaja a la pasarela y vuelve en el evento: es el hilo
    -- que une "el socio tocó pagar" con "Wompi dice que el pago entró".
    "referencia" VARCHAR(64) NOT NULL,
    "metodo_id" CHAR(24),
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'pendiente',
    "resuelta_por" CHAR(24),
    "resuelta_en" TIMESTAMP(3),
    "transaccion_id" CHAR(24),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_pago_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "solicitudes_pago_referencia_key" ON "solicitudes_pago"("referencia");
CREATE INDEX "solicitudes_pago_gym_id_estado_idx" ON "solicitudes_pago"("gym_id", "estado");
CREATE INDEX "solicitudes_pago_socio_id_estado_idx" ON "solicitudes_pago"("socio_id", "estado");

-- Un socio con un aviso pendiente no puede dejar otro: si no, tocando el botón
-- diez veces llenaría la bandeja de recepción.
CREATE UNIQUE INDEX "solicitudes_pago_socio_pendiente_key"
  ON "solicitudes_pago"("socio_id") WHERE "estado" = 'pendiente';

ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_gym_id_fkey"
  FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_socio_id_fkey"
  FOREIGN KEY ("socio_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT en el plan: borrar un plan no puede dejar avisos sin precio de
-- referencia mientras estén pendientes.
ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_metodo_id_fkey"
  FOREIGN KEY ("metodo_id") REFERENCES "metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "solicitudes_pago" ADD CONSTRAINT "solicitudes_pago_resuelta_por_fkey"
  FOREIGN KEY ("resuelta_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
