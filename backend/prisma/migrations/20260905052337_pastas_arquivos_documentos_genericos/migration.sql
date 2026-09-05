-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "ipfs_cid" TEXT;

-- AlterTable
ALTER TABLE "Arquivo" ADD COLUMN     "area_id" TEXT,
ADD COLUMN     "ipfs_cid" TEXT,
ADD COLUMN     "workspace_id" TEXT,
ALTER COLUMN "projeto_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "area_id" TEXT,
ADD COLUMN     "ipfs_cid" TEXT,
ADD COLUMN     "workspace_id" TEXT,
ALTER COLUMN "projeto_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Missao" ADD COLUMN     "ipfs_cid" TEXT;

-- AlterTable
ALTER TABLE "Pasta" ADD COLUMN     "area_id" TEXT,
ADD COLUMN     "ipfs_cid" TEXT,
ADD COLUMN     "workspace_id" TEXT,
ALTER COLUMN "projeto_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Projeto" ADD COLUMN     "ipfs_cid" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "ipfs_cid" TEXT;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasta" ADD CONSTRAINT "Pasta_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasta" ADD CONSTRAINT "Pasta_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
