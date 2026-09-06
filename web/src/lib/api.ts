import type {
  Area,
  Arquivo,
  ChecklistItem,
  Coluna,
  Comentario,
  Compartilhamento,
  Documento,
  Entrega,
  Lista,
  LogAuditoria,
  Missao,
  MissaoLabel,
  Pasta,
  Projeto,
  Revisao,
  TipoRecursoRestringivel,
  User,
  Workspace,
} from "./types";

// A API roda atrás de cookie HttpOnly (ver backend/src/auth/auth.controller.ts) —
// nunca guardamos token manualmente, só mandamos `credentials: "include"`.
const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

export const api = {
  auth: {
    login: (email: string, senha: string) => post<User>("/auth/login", { email, senha }),
    logout: () => post<{ ok: boolean }>("/auth/logout"),
    me: () => get<User>("/auth/me"),
    listarUsuarios: () => get<User[]>("/auth/usuarios"),
    atualizarPapel: (id: string, papelGlobal: User["papel_global"]) =>
      patch<User>(`/auth/usuarios/${id}/papel`, { papelGlobal }),
    registrar: (nome: string, email: string, senha: string, papelGlobal?: User["papel_global"]) =>
      post<User>("/auth/register", { nome, email, senha, papelGlobal }),
    esqueciSenha: (email: string) => post<{ ok: boolean }>("/auth/esqueci-senha", { email }),
    redefinirSenha: (token: string, novaSenha: string) =>
      post<{ ok: boolean }>("/auth/redefinir-senha", { token, novaSenha }),
  },

  workspaces: {
    listar: () => get<Workspace[]>("/workspaces"),
    buscar: (id: string) => get<Workspace>(`/workspaces/${id}`),
    criar: (nome: string, descricao?: string) => post<Workspace>("/workspaces", { nome, descricao }),
    atualizar: (id: string, dto: { nome?: string; descricao?: string; logo_data_url?: string | null }) =>
      patch<Workspace>(`/workspaces/${id}`, dto),
  },

  // Sem autenticação — usado pela tela de Login e por qualquer lugar que
  // precise mostrar nome/logo antes de existir sessão.
  branding: {
    obter: () => get<{ nome: string | null; logo_data_url: string | null }>("/branding"),
  },

  areas: {
    listarPorWorkspace: (workspaceId: string) => get<Area[]>(`/workspaces/${workspaceId}/areas`),
    criar: (workspaceId: string, nome: string, tipo: string) =>
      post<Area>(`/workspaces/${workspaceId}/areas`, { nome, tipo }),
    listarTodas: async (): Promise<Area[]> => {
      const workspaces = await get<Workspace[]>("/workspaces");
      const areasPorWorkspace = await Promise.all(
        workspaces.map((ws) => get<Area[]>(`/workspaces/${ws.id}/areas`)),
      );
      return areasPorWorkspace.flat();
    },
  },

  projetos: {
    listarPorArea: (areaId: string) => get<Projeto[]>(`/areas/${areaId}/projetos`),
    buscar: (id: string) => get<Projeto>(`/projetos/${id}`),
    criar: (areaId: string, nome: string, descricao?: string) =>
      post<Projeto>(`/areas/${areaId}/projetos`, { nome, descricao }),
    // Sem endpoint agregado no backend (projetos vivem só sob uma Área) —
    // agrega no cliente: workspace(s) -> áreas -> projetos de cada área.
    listarTodos: async (): Promise<Projeto[]> => {
      const workspaces = await get<Workspace[]>("/workspaces");
      const areasPorWorkspace = await Promise.all(
        workspaces.map((ws) => get<Area[]>(`/workspaces/${ws.id}/areas`)),
      );
      const areas = areasPorWorkspace.flat();
      const projetosPorArea = await Promise.all(
        areas.map((area) => get<Projeto[]>(`/areas/${area.id}/projetos`)),
      );
      return projetosPorArea.flat();
    },
  },

  missoes: {
    listarPorProjeto: (projetoId: string) => get<Missao[]>(`/projetos/${projetoId}/missoes`),
    minhas: () => get<Missao[]>("/missoes/minhas"),
    emRevisao: () => get<Missao[]>("/missoes/em-revisao"),
    buscar: (id: string) => get<Missao>(`/missoes/${id}`),
    criar: (projetoId: string, dto: { titulo: string; descricao?: string; valor_bounty?: number; colunaId?: string }) =>
      post<Missao>(`/projetos/${projetoId}/missoes`, dto),
    mover: (id: string, colunaId: string | null, ordem: number) =>
      patch<Missao>(`/missoes/${id}/mover`, { colunaId, ordem }),
    atualizarCapa: (id: string, corCapa: string | null) => patch<Missao>(`/missoes/${id}/capa`, { corCapa }),
    atualizarLabels: (id: string, labelIds: string[]) => patch<Missao>(`/missoes/${id}/labels`, { labelIds }),
    atualizarTags: (id: string, tags: string[]) => patch<Missao>(`/missoes/${id}/tags`, { tags }),
    atribuir: (id: string, responsavelIds: string[]) => patch<Missao>(`/missoes/${id}/atribuir`, { responsavelIds }),
    iniciar: (id: string) => patch<Missao>(`/missoes/${id}/iniciar`, {}),
    remover: (id: string) => del<void>(`/missoes/${id}`),
  },

  colunas: {
    listarPorProjeto: (projetoId: string) => get<Coluna[]>(`/projetos/${projetoId}/colunas`),
    criar: (projetoId: string, nome: string, limiteWip?: number) =>
      post<Coluna>(`/projetos/${projetoId}/colunas`, { nome, limiteWip }),
    atualizar: (id: string, dto: { nome?: string; limiteWip?: number | null }) =>
      patch<Coluna>(`/colunas/${id}`, dto),
    remover: (id: string) => del<void>(`/colunas/${id}`),
  },

  missaoLabels: {
    listarPorProjeto: (projetoId: string) => get<MissaoLabel[]>(`/projetos/${projetoId}/labels`),
    criar: (projetoId: string, nome: string, cor: string) =>
      post<MissaoLabel>(`/projetos/${projetoId}/labels`, { nome, cor }),
    atualizar: (id: string, dto: { nome?: string; cor?: string }) => patch<MissaoLabel>(`/labels/${id}`, dto),
    remover: (id: string) => del<void>(`/labels/${id}`),
  },

  entregas: {
    listarPorMissao: (missaoId: string) => get<Entrega[]>(`/missoes/${missaoId}/entregas`),
    criar: (missaoId: string, conteudo?: string) => post<Entrega>(`/missoes/${missaoId}/entregas`, { conteudo }),
    buscar: (id: string) => get<Entrega>(`/entregas/${id}`),
  },

  revisoes: {
    listarPorEntrega: (entregaId: string) => get<Revisao[]>(`/entregas/${entregaId}/revisoes`),
    criar: (entregaId: string, status: "APROVADO" | "REJEITADO", comentario?: string) =>
      post<Revisao>(`/entregas/${entregaId}/revisoes`, { status, comentario }),
  },

  comentarios: {
    listarPorMissao: (missaoId: string) => get<Comentario[]>(`/missoes/${missaoId}/comentarios`),
    criar: (missaoId: string, texto: string) => post<Comentario>(`/missoes/${missaoId}/comentarios`, { texto }),
    remover: (id: string) => del<void>(`/comentarios/${id}`),
  },

  checklist: {
    listarPorMissao: (missaoId: string) => get<ChecklistItem[]>(`/missoes/${missaoId}/checklist`),
    criar: (missaoId: string, texto: string) => post<ChecklistItem>(`/missoes/${missaoId}/checklist`, { texto }),
    atualizar: (id: string, dto: { texto?: string; concluido?: boolean }) =>
      patch<ChecklistItem>(`/checklist/${id}`, dto),
    remover: (id: string) => del<void>(`/checklist/${id}`),
  },

  pastas: {
    listarPorProjeto: (projetoId: string, pastaPaiId?: string) =>
      get<Pasta[]>(`/projetos/${projetoId}/pastas${pastaPaiId ? `?pastaPaiId=${pastaPaiId}` : ""}`),
    criar: (projetoId: string, nome: string, pastaPaiId?: string) =>
      post<Pasta>(`/projetos/${projetoId}/pastas`, { nome, pastaPaiId }),
    listarPorWorkspace: (workspaceId: string, pastaPaiId?: string) =>
      get<Pasta[]>(`/workspaces/${workspaceId}/pastas${pastaPaiId ? `?pastaPaiId=${pastaPaiId}` : ""}`),
    criarEmWorkspace: (workspaceId: string, nome: string, pastaPaiId?: string) =>
      post<Pasta>(`/workspaces/${workspaceId}/pastas`, { nome, pastaPaiId }),
    listarPorArea: (areaId: string, pastaPaiId?: string) =>
      get<Pasta[]>(`/areas/${areaId}/pastas${pastaPaiId ? `?pastaPaiId=${pastaPaiId}` : ""}`),
    criarEmArea: (areaId: string, nome: string, pastaPaiId?: string) =>
      post<Pasta>(`/areas/${areaId}/pastas`, { nome, pastaPaiId }),
    remover: (id: string) => del<void>(`/pastas/${id}`),
  },

  arquivos: {
    listarPorProjeto: (projetoId: string, pastaId?: string) =>
      get<Arquivo[]>(`/projetos/${projetoId}/arquivos${pastaId ? `?pastaId=${pastaId}` : "?pastaId=raiz"}`),
    enviar: (projetoId: string, file: File, pastaId?: string) => {
      const form = new FormData();
      form.append("arquivo", file);
      return request<Arquivo>(`/projetos/${projetoId}/arquivos?pastaId=${pastaId ?? "raiz"}`, {
        method: "POST",
        body: form,
      });
    },
    listarPorWorkspace: (workspaceId: string, pastaId?: string) =>
      get<Arquivo[]>(`/workspaces/${workspaceId}/arquivos${pastaId ? `?pastaId=${pastaId}` : "?pastaId=raiz"}`),
    enviarEmWorkspace: (workspaceId: string, file: File, pastaId?: string) => {
      const form = new FormData();
      form.append("arquivo", file);
      return request<Arquivo>(`/workspaces/${workspaceId}/arquivos?pastaId=${pastaId ?? "raiz"}`, {
        method: "POST",
        body: form,
      });
    },
    listarPorArea: (areaId: string, pastaId?: string) =>
      get<Arquivo[]>(`/areas/${areaId}/arquivos${pastaId ? `?pastaId=${pastaId}` : "?pastaId=raiz"}`),
    enviarEmArea: (areaId: string, file: File, pastaId?: string) => {
      const form = new FormData();
      form.append("arquivo", file);
      return request<Arquivo>(`/areas/${areaId}/arquivos?pastaId=${pastaId ?? "raiz"}`, {
        method: "POST",
        body: form,
      });
    },
    verificarIntegridade: (id: string) => get<{ integro: boolean; hash_original: string; hash_atual: string }>(
      `/arquivos/${id}/verificar`,
    ),
    renomear: (id: string, nome: string) => patch<Arquivo>(`/arquivos/${id}`, { nome }),
  },

  listas: {
    listarPorWorkspace: (workspaceId: string) => get<Lista[]>(`/workspaces/${workspaceId}/listas`),
    criar: (workspaceId: string, nome: string) => post<Lista>(`/workspaces/${workspaceId}/listas`, { nome }),
    renomear: (id: string, nome: string) => patch<Lista>(`/listas/${id}`, { nome }),
    remover: (id: string) => del<void>(`/listas/${id}`),
    adicionarMembro: (listaId: string, userId: string) => post<{ ok: boolean }>(`/listas/${listaId}/membros`, { userId }),
    removerMembro: (listaId: string, userId: string) => del<{ ok: boolean }>(`/listas/${listaId}/membros/${userId}`),
  },

  compartilhamento: {
    obter: (tipo: TipoRecursoRestringivel, id: string) => get<Compartilhamento>(`/compartilhamento/${tipo}/${id}`),
    definir: (tipo: TipoRecursoRestringivel, id: string, dto: { restrito: boolean; listaIds: string[]; userIds: string[] }) =>
      put<Compartilhamento>(`/compartilhamento/${tipo}/${id}`, dto),
  },

  integridade: {
    consultar: (tipo: "workspace" | "area" | "projeto" | "missao" | "pasta", id: string) =>
      get<{ id: string; ipfs_cid: string | null }>(`/integridade/${tipo}/${id}`),
    recalcularTudo: () =>
      post<{ arquivos: number; documentos: number; pastas: number; missoes: number; projetos: number; areas: number; workspaces: number }>(
        "/integridade/recalcular-tudo",
      ),
  },

  auditoria: {
    listar: (pageSize = 8) => get<{ items: LogAuditoria[]; total: number }>(`/auditoria?pageSize=${pageSize}`),
  },

  documentos: {
    listarPorProjeto: (projetoId: string, pastaId?: string) =>
      get<Documento[]>(`/projetos/${projetoId}/documentos${pastaId ? `?pastaId=${pastaId}` : "?pastaId=raiz"}`),
    buscar: (id: string) => get<Documento>(`/documentos/${id}`),
    criar: (projetoId: string, nome: string, pastaId?: string) =>
      post<Documento>(`/projetos/${projetoId}/documentos`, { conteudo: `# ${nome}\n`, pastaId }),
    listarPorWorkspace: (workspaceId: string, pastaId?: string) =>
      get<Documento[]>(`/workspaces/${workspaceId}/documentos${pastaId ? `?pastaId=${pastaId}` : "?pastaId=raiz"}`),
    criarEmWorkspace: (workspaceId: string, nome: string, pastaId?: string) =>
      post<Documento>(`/workspaces/${workspaceId}/documentos`, { conteudo: `# ${nome}\n`, pastaId }),
    listarPorArea: (areaId: string, pastaId?: string) =>
      get<Documento[]>(`/areas/${areaId}/documentos${pastaId ? `?pastaId=${pastaId}` : "?pastaId=raiz"}`),
    criarEmArea: (areaId: string, nome: string, pastaId?: string) =>
      post<Documento>(`/areas/${areaId}/documentos`, { conteudo: `# ${nome}\n`, pastaId }),
    atualizar: (id: string, conteudo: string) => patch<Documento>(`/documentos/${id}`, { conteudo }),
    remover: (id: string) => del<void>(`/documentos/${id}`),
  },
};
