-- AlterTable
ALTER TABLE "TokenRecuperacaoSenha" ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'RECUPERACAO';

-- AlterTable
-- Situação do usuário substitui o booleano "ativo" (convite, cadastro
-- pendente, aprovação...). Converte ANTES de apagar a coluna antiga, para
-- quem estava desativado continuar desativado.
ALTER TABLE "User" ADD COLUMN "situacao" TEXT NOT NULL DEFAULT 'ATIVO',
ADD COLUMN "ultimo_acesso" TIMESTAMP(3);
UPDATE "User" SET "situacao" = 'DESATIVADO' WHERE "ativo" = false;
ALTER TABLE "User" DROP COLUMN "ativo";

-- CreateTable
CREATE TABLE "CampoInscricao" (
    "id" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "ajuda" TEXT,
    "tipo" TEXT NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "opcoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "arquivado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampoInscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscricao" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "respostas" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidido_por_id" TEXT,
    "decidido_em" TIMESTAMP(3),
    "observacao" TEXT,

    CONSTRAINT "Inscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnexoInscricao" (
    "id" TEXT NOT NULL,
    "inscricao_id" TEXT NOT NULL,
    "campo_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "tipo_mime" TEXT NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnexoInscricao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inscricao_user_id_key" ON "Inscricao"("user_id");

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_decidido_por_id_fkey" FOREIGN KEY ("decidido_por_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnexoInscricao" ADD CONSTRAINT "AnexoInscricao_inscricao_id_fkey" FOREIGN KEY ("inscricao_id") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnexoInscricao" ADD CONSTRAINT "AnexoInscricao_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "CampoInscricao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


