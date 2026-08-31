-- DropIndex
DROP INDEX "feedbacks_gym_id_created_at_idx";

-- AlterTable
ALTER TABLE "feedbacks" ADD COLUMN     "anonimo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "destino" TEXT NOT NULL DEFAULT 'plataforma';

-- CreateIndex
CREATE INDEX "feedbacks_gym_id_destino_created_at_idx" ON "feedbacks"("gym_id", "destino", "created_at" DESC);
