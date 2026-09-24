-- CreateTable
CREATE TABLE "ConfiguracaoInscricao" (
    "id" TEXT NOT NULL DEFAULT 'padrao',
    "link_externo" TEXT,
    "instrucao_externa" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoInscricao_pkey" PRIMARY KEY ("id")
);

