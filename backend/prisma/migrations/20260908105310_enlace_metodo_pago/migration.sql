-- Enlace de cobro del método de pago (link de Nequi Negocios, QR de Wompi,
-- lo que el gimnasio tenga). Opcional: un método en efectivo no lleva enlace,
-- y los que ya existen quedan en NULL y siguen mostrando solo el número.
ALTER TABLE "metodos_pago" ADD COLUMN "enlace" TEXT;
