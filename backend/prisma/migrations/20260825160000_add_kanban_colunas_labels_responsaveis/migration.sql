-- Kanban rework: colunas livres (estilo Trello), labels, múltiplos responsáveis.
-- Ordem importa: cria as tabelas novas primeiro, migra os dados existentes
-- (responsavel_id -> MissaoResponsavel; status -> coluna 1:1) e só depois
-- derruba a coluna antiga `responsavel_id`.

-- CreateTable
CREATE TABLE "Coluna" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "limite_wip" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coluna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissaoLabel" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,

    CONSTRAINT "MissaoLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissaoLabelMissao" (
    "missao_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,

    CONSTRAINT "MissaoLabelMissao_pkey" PRIMARY KEY ("missao_id","label_id")
);

-- CreateTable
CREATE TABLE "MissaoResponsavel" (
    "id" TEXT NOT NULL,
    "missao_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "atribuido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissaoResponsavel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissaoResponsavel_missao_id_user_id_key" ON "MissaoResponsavel"("missao_id", "user_id");

-- AddForeignKey
ALTER TABLE "Coluna" ADD CONSTRAINT "Coluna_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissaoLabel" ADD CONSTRAINT "MissaoLabel_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissaoLabelMissao" ADD CONSTRAINT "MissaoLabelMissao_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "Missao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissaoLabelMissao" ADD CONSTRAINT "MissaoLabelMissao_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "MissaoLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissaoResponsavel" ADD CONSTRAINT "MissaoResponsavel_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "Missao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissaoResponsavel" ADD CONSTRAINT "MissaoResponsavel_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (só adiciona as colunas novas, ainda não mexe em responsavel_id)
ALTER TABLE "Missao"
  ADD COLUMN "coluna_id" TEXT,
  ADD COLUMN "cor_capa" TEXT,
  ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Missao" ADD CONSTRAINT "Missao_coluna_id_fkey" FOREIGN KEY ("coluna_id") REFERENCES "Coluna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: todo projeto existente ganha as 5 colunas que existiam como
-- status antes (texto exato de missaoStatusLabel() no frontend).
INSERT INTO "Coluna" (id, projeto_id, nome, ordem)
SELECT gen_random_uuid(), id, 'Pendente', 0 FROM "Projeto"
UNION ALL
SELECT gen_random_uuid(), id, 'Em Andamento', 1 FROM "Projeto"
UNION ALL
SELECT gen_random_uuid(), id, 'Em Revisão', 2 FROM "Projeto"
UNION ALL
SELECT gen_random_uuid(), id, 'Aprovada', 3 FROM "Projeto"
UNION ALL
SELECT gen_random_uuid(), id, 'Rejeitada', 4 FROM "Projeto";

-- Data migration: cada missão existente cai 1:1 na coluna com o nome do seu
-- status atual (mapeamento sem perda, board nasce organizado).
UPDATE "Missao" m
SET coluna_id = c.id
FROM "Coluna" c
WHERE c.projeto_id = m.projeto_id
  AND c.nome = (
    CASE m.status
      WHEN 'PENDENTE' THEN 'Pendente'
      WHEN 'EM_ANDAMENTO' THEN 'Em Andamento'
      WHEN 'EM_REVISAO' THEN 'Em Revisão'
      WHEN 'APROVADA' THEN 'Aprovada'
      WHEN 'REJEITADA' THEN 'Rejeitada'
      ELSE 'Pendente'
    END
  );

-- Data migration: posição dentro da coluna (Missao não tem timestamp de
-- criação, então a ordem inicial é só determinística por id).
WITH numerado AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY coluna_id ORDER BY id) - 1 AS rn
  FROM "Missao"
)
UPDATE "Missao" m
SET ordem = numerado.rn
FROM numerado
WHERE m.id = numerado.id;

-- Data migration: responsável único vira o primeiro (e único) registro na
-- nova tabela de múltiplos responsáveis.
INSERT INTO "MissaoResponsavel" (id, missao_id, user_id, atribuido_em)
SELECT gen_random_uuid(), id, responsavel_id, now()
FROM "Missao"
WHERE responsavel_id IS NOT NULL;

-- Só agora remove a coluna antiga de responsável único.
ALTER TABLE "Missao" DROP CONSTRAINT "Missao_responsavel_id_fkey";
ALTER TABLE "Missao" DROP COLUMN "responsavel_id";
