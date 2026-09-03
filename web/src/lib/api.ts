import type {
  Area,
  Arquivo,
  Coluna,
  Documento,
  Missao,
  MissaoLabel,
  Pasta,
  Projeto,
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
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

export const api = {
  auth: {
    login: (email: string, senha: string) => post<User>("/auth/login", { email, senha }),
    logout: () => post<{ ok: boolean }>("/auth/logout"),
    me: () => get<User>("/auth/me"),
  },

  workspaces: {
    listar: () => get<Workspace[]>("/workspaces"),
    buscar: (id: string) => get<Workspace>(`/workspaces/${id}`),
    criar: (nome: string, descricao?: string) => post<Workspace>("/workspaces", { nome, descricao }),
  },

  areas: {
    listarPorWorkspace: (workspaceId: string) => get<Area[]>(`/workspaces/${workspaceId}/areas`),
    criar: (workspaceId: string, nome: string, tipo: string) =>
      post<Area>(`/workspaces/${workspaceId}/areas`, { nome, tipo }),
  },

  projetos: {
    listarPorArea: (areaId: string) => get<Projeto[]>(`/areas/${areaId}/projetos`),
    buscar: (id: string) => get<Projeto>(`/projetos/${id}`),
    criar: (areaId: string, nome: string, descricao?: string) =>
      post<Projeto>(`/areas/${areaId}/projetos`, { nome, descricao }),
  },

  missoes: {
    listarPorProjeto: (projetoId: string) => get<Missao[]>(`/projetos/${projetoId}/missoes`),
    minhas: () => get<Missao[]>("/missoes/minhas"),
    buscar: (id: string) => get<Missao>(`/missoes/${id}`),
    criar: (projetoId: string, dto: { titulo: string; descricao?: string; valor_bounty?: number; colunaId?: string }) =>
      post<Missao>(`/projetos/${projetoId}/missoes`, dto),
    mover: (id: string, colunaId: string | null, ordem: number) =>
      patch<Missao>(`/missoes/${id}/mover`, { colunaId, ordem }),
    atualizarCapa: (id: string, corCapa: string | null) => patch<Missao>(`/missoes/${id}/capa`, { corCapa }),
    atualizarTags: (id: string, tags: string[]) => patch<Missao>(`/missoes/${id}/tags`, { tags }),
    remover: (id: string) => del<void>(`/missoes/${id}`),
  },

  colunas: {
    listarPorProjeto: (projetoId: string) => get<Coluna[]>(`/projetos/${projetoId}/colunas`),
    criar: (projetoId: string, nome: string, limite_wip?: number) =>
      post<Coluna>(`/projetos/${projetoId}/colunas`, { nome, limite_wip }),
    remover: (id: string) => del<void>(`/colunas/${id}`),
  },

  missaoLabels: {
    listarPorProjeto: (_projetoId: string) => Promise.resolve<MissaoLabel[]>([]), // sem endpoint de listagem dedicado ainda
  },

  pastas: {
    listarPorProjeto: (projetoId: string, pastaPaiId?: string) =>
      get<Pasta[]>(`/projetos/${projetoId}/pastas${pastaPaiId ? `?pastaPaiId=${pastaPaiId}` : ""}`),
    criar: (projetoId: string, nome: string, pastaPaiId?: string) =>
      post<Pasta>(`/projetos/${projetoId}/pastas`, { nome, pastaPaiId }),
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
    verificarIntegridade: (id: string) => get<{ integro: boolean }>(`/arquivos/${id}/verificar`),
  },

  documentos: {
    listarPorProjeto: (projetoId: string, pastaId?: string) =>
      get<Documento[]>(`/projetos/${projetoId}/documentos${pastaId ? `?pastaId=${pastaId}` : "?pastaId=raiz"}`),
    criar: (projetoId: string, nome: string, pastaId?: string) =>
      post<Documento>(`/projetos/${projetoId}/documentos`, { conteudo: `# ${nome}\n`, pastaId }),
    atualizar: (id: string, conteudo: string) => patch<Documento>(`/documentos/${id}`, { conteudo }),
  },
};
