-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel_global" TEXT NOT NULL DEFAULT 'COLABORADOR',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projeto" (
    "id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "prazo" TIMESTAMP(3),

    CONSTRAINT "Projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Missao" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavel_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "prazo" TIMESTAMP(3),
    "criterio_aceite" TEXT,
    "valor_bounty" DOUBLE PRECISION,

    CONSTRAINT "Missao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'MARKDOWN',
    "conteudo" TEXT NOT NULL,
    "tags" TEXT[],
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arquivo" (
    "id" TEXT NOT NULL,
    "projeto_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "tipo_mime" TEXT NOT NULL,
    "enviado_por" TEXT NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entrega_id" TEXT,

    CONSTRAINT "Arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entrega" (
    "id" TEXT NOT NULL,
    "missao_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "conteudo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EM_REVISAO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revisao" (
    "id" TEXT NOT NULL,
    "entrega_id" TEXT NOT NULL,
    "revisor_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comentario" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revisao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permissao" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "workspace_id" TEXT,
    "projeto_id" TEXT,

    CONSTRAINT "Permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoProjeto" (
    "id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "TipoProjeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoMissao" (
    "id" TEXT NOT NULL,
    "tipo_projeto_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "TipoMissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampoCustomizado" (
    "id" TEXT NOT NULL,
    "nome_campo" TEXT NOT NULL,
    "tipo_dado" TEXT NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "tipo_projeto_id" TEXT,
    "tipo_missao_id" TEXT,

    CONSTRAINT "CampoCustomizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorCampo" (
    "id" TEXT NOT NULL,
    "entidade_tipo" TEXT NOT NULL,
    "projeto_id" TEXT,
    "missao_id" TEXT,
    "campo_id" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "ValorCampo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projeto" ADD CONSTRAINT "Projeto_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Missao" ADD CONSTRAINT "Missao_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Missao" ADD CONSTRAINT "Missao_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_entrega_id_fkey" FOREIGN KEY ("entrega_id") REFERENCES "Entrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "Missao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revisao" ADD CONSTRAINT "Revisao_entrega_id_fkey" FOREIGN KEY ("entrega_id") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revisao" ADD CONSTRAINT "Revisao_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permissao" ADD CONSTRAINT "Permissao_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permissao" ADD CONSTRAINT "Permissao_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permissao" ADD CONSTRAINT "Permissao_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipoProjeto" ADD CONSTRAINT "TipoProjeto_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipoMissao" ADD CONSTRAINT "TipoMissao_tipo_projeto_id_fkey" FOREIGN KEY ("tipo_projeto_id") REFERENCES "TipoProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoCustomizado" ADD CONSTRAINT "CampoCustomizado_tipo_projeto_id_fkey" FOREIGN KEY ("tipo_projeto_id") REFERENCES "TipoProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampoCustomizado" ADD CONSTRAINT "CampoCustomizado_tipo_missao_id_fkey" FOREIGN KEY ("tipo_missao_id") REFERENCES "TipoMissao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorCampo" ADD CONSTRAINT "ValorCampo_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "CampoCustomizado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorCampo" ADD CONSTRAINT "ValorCampo_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorCampo" ADD CONSTRAINT "ValorCampo_missao_id_fkey" FOREIGN KEY ("missao_id") REFERENCES "Missao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
