-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "criado_por_id" TEXT,
ADD COLUMN     "restrito" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Pasta" ADD COLUMN     "criado_por_id" TEXT,
ADD COLUMN     "restrito" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Projeto" ADD COLUMN     "criado_por_id" TEXT,
ADD COLUMN     "restrito" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Lista" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaMembro" (
    "lista_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "ListaMembro_pkey" PRIMARY KEY ("lista_id","user_id")
);

-- CreateTable
CREATE TABLE "AcessoRecurso" (
    "id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lista_id" TEXT,
    "user_id" TEXT,
    "projeto_id" TEXT,
    "area_id" TEXT,
    "pasta_id" TEXT,

    CONSTRAINT "AcessoRecurso_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projeto" ADD CONSTRAINT "Projeto_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasta" ADD CONSTRAINT "Pasta_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lista" ADD CONSTRAINT "Lista_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaMembro" ADD CONSTRAINT "ListaMembro_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "Lista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaMembro" ADD CONSTRAINT "ListaMembro_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoRecurso" ADD CONSTRAINT "AcessoRecurso_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "Lista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoRecurso" ADD CONSTRAINT "AcessoRecurso_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoRecurso" ADD CONSTRAINT "AcessoRecurso_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoRecurso" ADD CONSTRAINT "AcessoRecurso_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoRecurso" ADD CONSTRAINT "AcessoRecurso_pasta_id_fkey" FOREIGN KEY ("pasta_id") REFERENCES "Pasta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
