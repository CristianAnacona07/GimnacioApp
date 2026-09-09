-- Cobro en línea con Wompi, una cuenta por gimnasio.
--
-- Las llaves van en el gimnasio y no en el .env de la plataforma porque cada
-- uno cobra a su propia cuenta: la plata cae directo donde tiene que caer y la
-- plataforma nunca queda de intermediaria de pagos ajenos.
--
-- Los dos secretos no salen nunca en una respuesta de la API: se esconden con
-- `omit` en prisma/client.js, igual que la contraseña de un usuario.
ALTER TABLE "gyms" ADD COLUMN "wompi_public_key" TEXT;
ALTER TABLE "gyms" ADD COLUMN "wompi_integrity_secret" TEXT;
ALTER TABLE "gyms" ADD COLUMN "wompi_events_secret" TEXT;
