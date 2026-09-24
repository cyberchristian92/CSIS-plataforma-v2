-- AlterTable
ALTER TABLE "Revisao" ADD COLUMN     "autoaprovacao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "justificativa" TEXT;

