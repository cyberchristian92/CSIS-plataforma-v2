-- AlterTable
ALTER TABLE "Arquivo" ADD COLUMN     "missao_id" TEXT;

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "missao_id" TEXT;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "Missao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "Missao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
