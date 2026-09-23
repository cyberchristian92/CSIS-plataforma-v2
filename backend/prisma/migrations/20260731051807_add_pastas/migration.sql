-- AlterTable
ALTER TABLE "Arquivo" ADD COLUMN     "pasta_id" TEXT;

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "pasta_id" TEXT;

-- CreateTable
CREATE TABLE "Pasta" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "missao_id" TEXT,
    "pasta_pai_id" TEXT,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pasta_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_pasta_id_fkey" FOREIGN KEY ("pasta_id") REFERENCES "Pasta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_pasta_id_fkey" FOREIGN KEY ("pasta_id") REFERENCES "Pasta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasta" ADD CONSTRAINT "Pasta_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasta" ADD CONSTRAINT "Pasta_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "Missao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasta" ADD CONSTRAINT "Pasta_pasta_pai_id_fkey" FOREIGN KEY ("pasta_pai_id") REFERENCES "Pasta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
