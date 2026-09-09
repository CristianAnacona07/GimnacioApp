-- Qué plan se cobró, y en qué plan quedó el socio.
--
-- Hasta ahora el plan no se guardaba en ninguna parte: el registro de pago solo
-- anotaba monto y días, así que "cuánto paga cada socio" había que deducirlo del
-- último monto cobrado. Ambas columnas quedan nulas en lo ya registrado y en los
-- pagos sueltos que el admin escribe a mano, que no salen de un plan.
ALTER TABLE "transacciones" ADD COLUMN "plan_id" CHAR(24);
ALTER TABLE "users" ADD COLUMN "plan_id" CHAR(24);

-- SET NULL y no CASCADE: borrar un plan no puede llevarse por delante el
-- historial de pagos ni tocar a los socios.
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "transacciones_plan_id_idx" ON "transacciones"("plan_id");
