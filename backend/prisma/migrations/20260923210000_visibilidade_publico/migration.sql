-- Visibilidade padrão restrita para Colaboradores: projetos/áreas só ficam
-- abertos a todos quando marcados explicitamente como públicos.
ALTER TABLE "Area" ADD COLUMN "publico" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Projeto" ADD COLUMN "publico" BOOLEAN NOT NULL DEFAULT false;
