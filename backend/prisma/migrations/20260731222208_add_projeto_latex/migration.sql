-- CreateTable
CREATE TABLE "ProjetoLatex" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "arquivado" BOOLEAN NOT NULL DEFAULT false,
    "dono_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjetoLatex_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProjetoLatex" ADD CONSTRAINT "ProjetoLatex_dono_id_fkey" FOREIGN KEY ("dono_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
