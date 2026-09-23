-- Desativação de usuário e invalidação de sessão no servidor.
ALTER TABLE "User" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "sessao_versao" INTEGER NOT NULL DEFAULT 0;

-- E-mail passa a ser comparado sem diferenciar maiúsculas: normaliza os
-- existentes (a aplicação grava sempre em minúsculas daqui em diante).
UPDATE "User" SET "email" = lower("email") WHERE "email" <> lower("email");
