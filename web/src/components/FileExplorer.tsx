import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, File, FilePlus2, FileText, Folder, FolderPlus, Home, ShieldCheck, Upload } from "lucide-react";
import { api } from "@/lib/api";
import type { Arquivo, Documento, Pasta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { usePromptDialog } from "@/components/ui/prompt-dialog";
import { extractTitle, formatBytes, formatDate } from "@/lib/utils";

export type ExplorerScope = { type: "projeto" | "area" | "workspace"; id: string };

// Explorador de arquivos genérico — a mesma grade estilo Drive (breadcrumb +
// pastas/arquivos/documentos) serve os três escopos que a Pasta/Arquivo/
// Documento agora aceitam (ver backend/prisma/schema.prisma): dentro de um
// Projeto, dentro de uma Área ("Marketing" reunindo os projetos da área) ou
// no nível Workspace ("Recursos": Logos/Templates/Prompts). Só muda qual
// endpoint é chamado — a UI é a mesma em todo lugar, por design ("gerenciar
// a empresa inteira com esses campos").
function adapterFor(scope: ExplorerScope) {
  const { type, id } = scope;
  if (type === "area") {
    return {
      pastas: (pastaPaiId?: string) => api.pastas.listarPorArea(id, pastaPaiId),
      criarPasta: (nome: string, pastaPaiId?: string) => api.pastas.criarEmArea(id, nome, pastaPaiId),
      arquivos: (pastaId?: string) => api.arquivos.listarPorArea(id, pastaId),
      enviarArquivo: (file: File, pastaId?: string) => api.arquivos.enviarEmArea(id, file, pastaId),
      documentos: (pastaId?: string) => api.documentos.listarPorArea(id, pastaId),
      criarDocumento: (nome: string, pastaId?: string) => api.documentos.criarEmArea(id, nome, pastaId),
    };
  }
  if (type === "workspace") {
    return {
      pastas: (pastaPaiId?: string) => api.pastas.listarPorWorkspace(id, pastaPaiId),
      criarPasta: (nome: string, pastaPaiId?: string) => api.pastas.criarEmWorkspace(id, nome, pastaPaiId),
      arquivos: (pastaId?: string) => api.arquivos.listarPorWorkspace(id, pastaId),
      enviarArquivo: (file: File, pastaId?: string) => api.arquivos.enviarEmWorkspace(id, file, pastaId),
      documentos: (pastaId?: string) => api.documentos.listarPorWorkspace(id, pastaId),
      criarDocumento: (nome: string, pastaId?: string) => api.documentos.criarEmWorkspace(id, nome, pastaId),
    };
  }
  return {
    pastas: (pastaPaiId?: string) => api.pastas.listarPorProjeto(id, pastaPaiId),
    criarPasta: (nome: string, pastaPaiId?: string) => api.pastas.criar(id, nome, pastaPaiId),
    arquivos: (pastaId?: string) => api.arquivos.listarPorProjeto(id, pastaId),
    enviarArquivo: (file: File, pastaId?: string) => api.arquivos.enviar(id, file, pastaId),
    documentos: (pastaId?: string) => api.documentos.listarPorProjeto(id, pastaId),
    criarDocumento: (nome: string, pastaId?: string) => api.documentos.criar(id, nome, pastaId),
  };
}

export function FileExplorer({ scope, podeCriar = true }: { scope: ExplorerScope; podeCriar?: boolean }) {
  const [trilha, setTrilha] = useState<Pasta[]>([]);
  const pastaAtual = trilha[trilha.length - 1];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const adapter = adapterFor(scope);
  const chaveBase = [scope.type, scope.id, pastaAtual?.id] as const;
  const { ask, dialog: promptDialog } = usePromptDialog();

  const { data: pastas } = useQuery({
    queryKey: ["pastas", ...chaveBase],
    queryFn: () => adapter.pastas(pastaAtual?.id),
  });

  const { data: arquivos } = useQuery({
    queryKey: ["arquivos", ...chaveBase],
    queryFn: () => adapter.arquivos(pastaAtual?.id),
  });

  const { data: documentos } = useQuery({
    queryKey: ["documentos", ...chaveBase],
    queryFn: () => adapter.documentos(pastaAtual?.id),
  });

  const criarPasta = useMutation({
    mutationFn: async () => {
      const nome = await ask("Nome da pasta");
      if (!nome) return Promise.reject(new Error("cancelado"));
      return adapter.criarPasta(nome, pastaAtual?.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pastas", ...chaveBase] }),
  });

  const criarDocumento = useMutation({
    mutationFn: async () => {
      const nome = await ask("Nome do documento");
      if (!nome) return Promise.reject(new Error("cancelado"));
      return adapter.criarDocumento(nome, pastaAtual?.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos", ...chaveBase] }),
  });

  const enviarArquivo = useMutation({
    mutationFn: (file: File) => adapter.enviarArquivo(file, pastaAtual?.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arquivos", ...chaveBase] }),
  });

  const vazio = (pastas?.length ?? 0) === 0 && (arquivos?.length ?? 0) === 0 && (documentos?.length ?? 0) === 0;

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <button
          onClick={() => setTrilha([])}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent hover:text-foreground"
        >
          <Home className="h-3.5 w-3.5" /> Raiz
        </button>
        {trilha.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" />
            <button
              onClick={() => setTrilha(trilha.slice(0, i + 1))}
              className="rounded-md px-1.5 py-1 hover:bg-accent hover:text-foreground"
            >
              {p.nome}
            </button>
          </span>
        ))}
      </div>

      {podeCriar && (
        <div className="mb-4 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => criarPasta.mutate()}>
            <FolderPlus className="h-4 w-4" /> Nova pasta
          </Button>
          <Button size="sm" variant="outline" onClick={() => criarDocumento.mutate()}>
            <FilePlus2 className="h-4 w-4" /> Novo documento
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Enviar arquivo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) enviarArquivo.mutate(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {vazio && <p className="py-10 text-center text-sm text-muted-foreground">Esta pasta está vazia.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pastas?.map((pasta: Pasta) => (
          <button
            key={pasta.id}
            onDoubleClick={() => setTrilha([...trilha, pasta])}
            className="group flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-accent"
          >
            <Folder className="h-8 w-8 text-primary" />
            <span className="w-full truncate text-sm font-medium">{pasta.nome}</span>
            <span className="text-xs text-muted-foreground">{formatDate(pasta.criado_em)}</span>
          </button>
        ))}

        {documentos?.map((doc: Documento) => (
          <Link
            key={doc.id}
            to={`/documentos/${doc.id}`}
            className="group flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-accent"
          >
            <FileText className="h-8 w-8 text-muted-foreground" />
            <span className="w-full truncate text-sm font-medium">{extractTitle(doc.conteudo)}</span>
            <span className="text-xs text-muted-foreground">{formatDate(doc.atualizado_em)}</span>
          </Link>
        ))}

        {arquivos?.map((arquivo: Arquivo) => (
          <div
            key={arquivo.id}
            className="group flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-accent"
          >
            <File className="h-8 w-8 text-muted-foreground" />
            <span className="w-full truncate text-sm font-medium" title={arquivo.nome}>
              {arquivo.nome}
            </span>
            <span className="text-xs text-muted-foreground">{formatBytes(arquivo.tamanho)}</span>
            <span
              className="flex items-center gap-1 truncate text-[10px] text-muted-foreground"
              title={`hash SHA-256: ${arquivo.hash_sha256}`}
            >
              <ShieldCheck className="h-3 w-3 shrink-0 text-primary" />
              {arquivo.hash_sha256.slice(0, 10)}…
            </span>
          </div>
        ))}
      </div>

      {promptDialog}
    </div>
  );
}
