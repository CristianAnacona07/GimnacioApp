-- Reparte los pagos anteriores a que el plan se guardara.
--
-- La columna plan_id nació hace un rato, así que todo lo cobrado antes quedó
-- sin clasificar y la facturación lo mostraba junto en "Sin plan". Estos pagos
-- sí salieron de un plan: lo que falta es la etiqueta, no el dato.
--
-- Se empareja por monto Y días a la vez, y solo cuando UN único plan del
-- gimnasio coincide con los dos. Si dos planes valen lo mismo o duran lo mismo,
-- el pago se queda sin plan: es preferible una fila sin clasificar a una
-- clasificada mal.
UPDATE "transacciones" t
SET "plan_id" = p."id"
FROM "planes" p
WHERE t."plan_id" IS NULL
  AND p."gym_id" = t."gym_id"
  AND p."deleted_at" IS NULL
  AND p."precio" = t."monto"
  AND p."dias" = t."dias_agregados"
  AND (
    SELECT count(*) FROM "planes" p2
    WHERE p2."gym_id" = t."gym_id"
      AND p2."deleted_at" IS NULL
      AND p2."precio" = t."monto"
      AND p2."dias" = t."dias_agregados"
  ) = 1;

-- Y cada socio queda en el plan de su último pago ya clasificado, que es lo que
-- el registro de pago viene escribiendo desde ahora.
UPDATE "users" u
SET "plan_id" = ultimo."plan_id"
FROM (
  SELECT DISTINCT ON ("usuario_id") "usuario_id", "plan_id"
  FROM "transacciones"
  WHERE "plan_id" IS NOT NULL
  ORDER BY "usuario_id", "fecha" DESC
) ultimo
WHERE u."id" = ultimo."usuario_id"
  AND u."plan_id" IS NULL;
