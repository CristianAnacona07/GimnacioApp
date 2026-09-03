-- AlterTable
ALTER TABLE "sedes" ADD COLUMN     "es_principal" BOOLEAN NOT NULL DEFAULT false;

-- Una sola casa matriz por gimnasio. Prisma no expresa uniques parciales, así
-- que el índice va a mano, igual que el de usuarios superadmin y el de citas.
CREATE UNIQUE INDEX "sedes_una_principal_por_gym"
  ON "sedes" ("gym_id") WHERE "es_principal";

-- Las sedes que ya existen: la que se creó como "Principal" pasa a ser la matriz.
-- Si un gimnasio no tuviera ninguna con ese nombre, se marca la más antigua,
-- que es la que el sistema creó al abrirse el segundo local.
UPDATE "sedes" s SET "es_principal" = true
WHERE s."id" = (
  SELECT x."id" FROM "sedes" x
  WHERE x."gym_id" = s."gym_id"
  ORDER BY (x."nombre" = 'Principal') DESC, x."created_at" ASC
  LIMIT 1
);
