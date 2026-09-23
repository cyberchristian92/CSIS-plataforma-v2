// Tipos espelhando as entidades do backend (prisma/schema.prisma).
// ipfs_cid aparece nos nós de pasta e nos nós de conteúdo — ver
// backend/prisma/schema.prisma e docs/adr/0001-sem-blockchain-postgres-ipfs.md.

export type PapelGlobal = "ADMIN" | "LIDER" | "REVISOR" | "COLABORADOR";

export interface User {
  id: string;
  nome: string;
  email: string;
  papel_global: PapelGlobal;
  criado_em: string;
}

export interface Workspace {
  id: string;
  nome: string;
  descricao: string | null;
  logo_data_url: string | null;
  ipfs_cid: string | null;
}

export interface Area {
  id: string;
  workspace_id: string;
  nome: string;
  tipo: string;
  ipfs_cid: string | null;
  restrito: boolean;
  criado_por_id: string | null;
}

export type ProjetoStatus = "ATIVO" | "ARQUIVADO" | "CONCLUIDO";

export interface Projeto {
  id: string;
  area_id: string;
  nome: string;
  descricao: string | null;
  status: ProjetoStatus;
  prazo: string | null;
  ipfs_cid: string | null;
  restrito: boolean;
  criado_por_id: string | null;
  capa_url: string | null;
  video_url: string | null;
}

export type MissaoStatus = "PENDENTE" | "EM_ANDAMENTO" | "EM_REVISAO" | "APROVADA" | "REJEITADA";

export interface Missao {
  id: string;
  projeto_id: string;
  titulo: string;
  descricao: string | null;
  status: MissaoStatus;
  prazo: string | null;
  criterio_aceite: string | null;
  valor_bounty: number | null;
  tags: string[];
  ipfs_cid: string | null;
  coluna_id: string | null;
  ordem: number;
  cor_capa: string | null;
  responsaveis?: { user: User }[];
  labels?: { label: MissaoLabel }[];
  projeto?: { id: string; nome: string };
  entregas?: Entrega[];
}

export interface Coluna {
  id: string;
  projeto_id: string;
  nome: string;
  ordem: number;
  limite_wip: number | null;
}

export interface MissaoLabel {
  id: string;
  projeto_id: string;
  nome: string;
  cor: string;
}

// Escopo mutuamente exclusivo: exatamente um de projeto_id/area_id/workspace_id
// é preenchido (ver backend/prisma/schema.prisma e pastas.service.ts) — assim
// a mesma entidade Pasta serve Projetos, Áreas ("Marketing" etc) e Recursos
// (nível Workspace, ex: Logos/Templates/Prompts).
export interface Pasta {
  id: string;
  projeto_id: string | null;
  area_id: string | null;
  workspace_id: string | null;
  missao_id: string | null;
  pasta_pai_id: string | null;
  nome: string;
  ipfs_cid: string | null;
  criado_em: string;
}

export interface Arquivo {
  id: string;
  projeto_id: string | null;
  area_id: string | null;
  workspace_id: string | null;
  missao_id: string | null;
  pasta_id: string | null;
  nome: string;
  hash_sha256: string;
  ipfs_cid: string | null;
  tamanho: number;
  tipo_mime: string;
  enviado_em: string;
}

export interface LogAuditoria {
  id: string;
  user_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string;
  timestamp: string;
  user?: { id: string; nome: string; email: string } | null;
}

export interface Documento {
  id: string;
  projeto_id: string | null;
  area_id: string | null;
  workspace_id: string | null;
  missao_id: string | null;
  pasta_id: string | null;
  autor_id: string;
  tipo: string;
  conteudo: string;
  tags: string[];
  ipfs_cid: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type EntregaStatus = "EM_REVISAO" | "APROVADA" | "REJEITADA";

export interface Entrega {
  id: string;
  missao_id: string;
  autor_id: string;
  conteudo: string;
  status: EntregaStatus;
  criado_em: string;
  autor?: { id: string; nome: string; email: string };
  revisoes?: Revisao[];
}

export type RevisaoStatus = "APROVADO" | "REJEITADO";

export interface Revisao {
  id: string;
  entrega_id: string;
  revisor_id: string;
  status: RevisaoStatus;
  comentario: string | null;
  criado_em: string;
  revisor?: { id: string; nome: string; email: string };
}

export interface Comentario {
  id: string;
  missao_id: string;
  autor_id: string;
  texto: string;
  criado_em: string;
  autor?: { id: string; nome: string };
}

export interface ChecklistItem {
  id: string;
  missao_id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
}

// Listas de Acesso — grupos de nome livre usados só pra RESTRINGIR a
// visibilidade de um Projeto/Área/Pasta específico (estilo "compartilhar"
// do Drive). Por padrão nada é restrito; ver SettingsPage e o botão
// "Compartilhar" nas páginas de Projeto/Área.
export interface Lista {
  id: string;
  workspace_id: string;
  nome: string;
  criado_em: string;
  membros?: { user: User }[];
}

export type TipoRecursoRestringivel = "projeto" | "area" | "pasta";

export interface Compartilhamento {
  restrito: boolean;
  listas: { id: string; nome: string }[];
  usuarios: { id: string; nome: string; email: string }[];
}
