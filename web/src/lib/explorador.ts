import { api, ApiError } from "./api";
import type { Arquivo, Documento, EventoHistorico, Pasta } from "./types";

export type ExplorerScope = { type: "projeto" | "area" | "workspace"; id: string };

const BASE = "/api";

function prefixo(scope: ExplorerScope): string {
  const recurso = scope.type === "projeto" ? "projetos" : scope.type === "area" ? "areas" : "workspaces";
  return `/${recurso}/${scope.id}`;
}

async function obter<T>(caminho: string): Promise<T> {
  const res = await fetch(`${BASE}${caminho}`, { credentials: "include" });
  if (!res.ok) {
    const corpo = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, Array.isArray(corpo.message) ? corpo.message.join(" ") : corpo.message);
  }
  return res.json() as Promise<T>;
}

/// Acesso à API do explorador, igual para os três escopos (Projeto, Área e
/// Workspace/"Recursos") — só muda o prefixo da rota.
export function explorador(scope: ExplorerScope) {
  const base = prefixo(scope);
  const naPasta = (pastaId?: string) => `pastaId=${pastaId ?? "raiz"}`;
  return {
    pastas: (pastaPaiId?: string) =>
      obter<Pasta[]>(`${base}/pastas${pastaPaiId ? `?pastaPaiId=${pastaPaiId}` : ""}`),
    /// Árvore inteira (sem as pastas restritas): busca e caminho da URL.
    todasPastas: () => obter<Pasta[]>(`${base}/pastas?todas=true`),
    arquivos: (pastaId?: string) => obter<Arquivo[]>(`${base}/arquivos?${naPasta(pastaId)}`),
    todosArquivos: () => obter<Arquivo[]>(`${base}/arquivos`),
    documentos: (pastaId?: string) => obter<Documento[]>(`${base}/documentos?${naPasta(pastaId)}`),
    todosDocumentos: () => obter<Documento[]>(`${base}/documentos`),
    criarPasta: (nome: string, pastaPaiId?: string) =>
      scope.type === "projeto"
        ? api.pastas.criar(scope.id, nome, pastaPaiId)
        : scope.type === "area"
          ? api.pastas.criarEmArea(scope.id, nome, pastaPaiId)
          : api.pastas.criarEmWorkspace(scope.id, nome, pastaPaiId),
    criarDocumento: (nome: string, pastaId?: string) =>
      scope.type === "projeto"
        ? api.documentos.criar(scope.id, nome, pastaId)
        : scope.type === "area"
          ? api.documentos.criarEmArea(scope.id, nome, pastaId)
          : api.documentos.criarEmWorkspace(scope.id, nome, pastaId),
    urlEnvio: (pastaId?: string) => `${BASE}${base}/arquivos?${naPasta(pastaId)}`,
  };
}

export const historicoArquivo = (id: string) => obter<EventoHistorico[]>(`/arquivos/${id}/historico`);
export const historicoDocumento = (id: string) => obter<EventoHistorico[]>(`/documentos/${id}/historico`);
export const urlVisualizar = (arquivoId: string) => `${BASE}/arquivos/${arquivoId}/download?inline=1`;

/// Envio com progresso (fetch não informa progresso de upload; XHR sim).
export function enviarComProgresso(
  url: string,
  arquivo: File,
  aoProgredir: (fracao: number) => void,
): { promessa: Promise<Arquivo>; cancelar: () => void } {
  const xhr = new XMLHttpRequest();
  const promessa = new Promise<Arquivo>((resolve, reject) => {
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) aoProgredir(e.loaded / e.total);
    };
    xhr.onload = () => {
      let corpo: { message?: string | string[] } & Partial<Arquivo> = {};
      try {
        corpo = JSON.parse(xhr.responseText);
      } catch {
        // resposta sem JSON
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(corpo as Arquivo);
      else {
        const msg = Array.isArray(corpo.message) ? corpo.message.join(" ") : corpo.message;
        reject(new ApiError(xhr.status, msg ?? `Falha no envio (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Falha de conexão durante o envio."));
    xhr.onabort = () => reject(new ApiError(0, "Envio cancelado."));
    const form = new FormData();
    form.append("arquivo", arquivo);
    xhr.send(form);
  });
  return { promessa, cancelar: () => xhr.abort() };
}
