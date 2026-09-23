import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  File,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Home,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Arquivo, Documento, Pasta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePromptDialog } from "@/components/ui/prompt-dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const { ask: confirmar, dialog: confirmDialog } = useConfirmDialog();
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [verificacao, setVerificacao] = useState<{ nome: string; integro: boolean; original: string; atual: string } | null>(
    null,
  );

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

  const renomearPasta = useMutation({
    mutationFn: async (pasta: Pasta) => {
      const nome = await ask("Renomear pasta", pasta.nome);
      if (!nome || nome === pasta.nome) return Promise.reject(new Error("cancelado"));
      return api.pastas.renomear(pasta.id, nome);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pastas", ...chaveBase] }),
  });

  const removerPasta = useMutation({
    mutationFn: async (pasta: Pasta) => {
      const ok = await confirmar({
        titulo: `Excluir "${pasta.nome}"?`,
        descricao: "Sub-pastas, arquivos e documentos dentro dela sobem um nível — nada mais é apagado.",
        textoConfirmar: "Excluir",
        destrutivo: true,
      });
      if (!ok) return Promise.reject(new Error("cancelado"));
      return api.pastas.remover(pasta.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pastas", ...chaveBase] });
      qc.invalidateQueries({ queryKey: ["arquivos", ...chaveBase] });
      qc.invalidateQueries({ queryKey: ["documentos", ...chaveBase] });
    },
  });

  const renomearArquivo = useMutation({
    mutationFn: async (arquivo: Arquivo) => {
      const nome = await ask("Renomear arquivo", arquivo.nome);
      if (!nome || nome === arquivo.nome) return Promise.reject(new Error("cancelado"));
      return api.arquivos.renomear(arquivo.id, nome);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arquivos", ...chaveBase] }),
  });

  const removerArquivo = useMutation({
    mutationFn: async (arquivo: Arquivo) => {
      const ok = await confirmar({
        titulo: `Excluir "${arquivo.nome}"?`,
        descricao: "O arquivo é apagado do disco — essa ação não pode ser desfeita.",
        textoConfirmar: "Excluir",
        destrutivo: true,
      });
      if (!ok) return Promise.reject(new Error("cancelado"));
      return api.arquivos.remover(arquivo.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arquivos", ...chaveBase] }),
  });

  const verificarArquivo = useMutation({
    mutationFn: (arquivo: Arquivo) => api.arquivos.verificarIntegridade(arquivo.id).then((r) => ({ arquivo, ...r })),
    onSuccess: (r) =>
      setVerificacao({ nome: r.arquivo.nome, integro: r.integro, original: r.hash_original, atual: r.hash_atual }),
    onError: (e: unknown) =>
      setVerificacao({
        nome: "Erro",
        integro: false,
        original: "",
        atual: e instanceof ApiError ? e.message : "Falha ao verificar.",
      }),
  });

  const removerDocumento = useMutation({
    mutationFn: async (doc: Documento) => {
      const ok = await confirmar({
        titulo: `Excluir "${extractTitle(doc.conteudo)}"?`,
        descricao: "Essa ação não pode ser desfeita.",
        textoConfirmar: "Excluir",
        destrutivo: true,
      });
      if (!ok) return Promise.reject(new Error("cancelado"));
      return api.documentos.remover(doc.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos", ...chaveBase] }),
  });

  const vazio = (pastas?.length ?? 0) === 0 && (arquivos?.length ?? 0) === 0 && (documentos?.length ?? 0) === 0;

  return (
    <div onClick={() => setMenuAberto(null)}>
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
          <div
            key={pasta.id}
            onDoubleClick={() => setTrilha([...trilha, pasta])}
            className="group relative flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-accent"
          >
            <Folder className="h-8 w-8 text-primary" />
            <span className="w-full truncate text-sm font-medium">{pasta.nome}</span>
            <span className="text-xs text-muted-foreground">{formatDate(pasta.criado_em)}</span>
            {podeCriar && (
              <ItemMenu
                aberto={menuAberto === pasta.id}
                onAbrir={() => setMenuAberto(pasta.id)}
                itens={[
                  { label: "Renomear", icon: Pencil, onClick: () => renomearPasta.mutate(pasta) },
                  { label: "Excluir", icon: Trash2, destrutivo: true, onClick: () => removerPasta.mutate(pasta) },
                ]}
              />
            )}
          </div>
        ))}

        {documentos?.map((doc: Documento) => (
          <div
            key={doc.id}
            className="group relative flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-accent"
          >
            <Link to={`/documentos/${doc.id}`} className="flex w-full flex-col items-start gap-2">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <span className="w-full truncate text-sm font-medium">{extractTitle(doc.conteudo)}</span>
              <span className="text-xs text-muted-foreground">{formatDate(doc.atualizado_em)}</span>
            </Link>
            {podeCriar && (
              <ItemMenu
                aberto={menuAberto === doc.id}
                onAbrir={() => setMenuAberto(doc.id)}
                itens={[{ label: "Excluir", icon: Trash2, destrutivo: true, onClick: () => removerDocumento.mutate(doc) }]}
              />
            )}
          </div>
        ))}

        {arquivos?.map((arquivo: Arquivo) => (
          <div
            key={arquivo.id}
            className="group relative flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-accent"
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
            <ItemMenu
              aberto={menuAberto === arquivo.id}
              onAbrir={() => setMenuAberto(arquivo.id)}
              itens={[
                { label: "Verificar integridade", icon: ShieldCheck, onClick: () => verificarArquivo.mutate(arquivo) },
                ...(podeCriar
                  ? [
                      { label: "Renomear", icon: Pencil, onClick: () => renomearArquivo.mutate(arquivo) },
                      { label: "Excluir", icon: Trash2, destrutivo: true, onClick: () => removerArquivo.mutate(arquivo) },
                    ]
                  : []),
              ]}
            />
          </div>
        ))}
      </div>

      {promptDialog}
      {confirmDialog}

      <Dialog open={!!verificacao} onClose={() => setVerificacao(null)} className="max-w-md">
        <h2 className="mb-1 text-lg font-bold">Integridade — {verificacao?.nome}</h2>
        {verificacao && (
          <>
            <p className={`mb-3 text-sm font-medium ${verificacao.integro ? "text-status-approved" : "text-destructive"}`}>
              {verificacao.integro ? "✓ Íntegro — o hash bate com o momento do upload." : "✗ Não bate — o arquivo mudou."}
            </p>
            <div className="space-y-1 font-mono text-xs text-muted-foreground">
              <p className="break-all">Original: {verificacao.original}</p>
              <p className="break-all">Atual: {verificacao.atual}</p>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}

interface ItemMenuAction {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
  destrutivo?: boolean;
}

function ItemMenu({ aberto, onAbrir, itens }: { aberto: boolean; onAbrir: () => void; itens: ItemMenuAction[] }) {
  return (
    <div className="absolute right-1.5 top-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => onAbrir()}
        className="rounded-md p-1 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {aberto && (
        <div className="absolute right-0 top-7 z-10 w-44 rounded-md border border-border bg-card py-1 shadow-lg">
          {itens.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent ${
                item.destrutivo ? "text-destructive" : "text-foreground"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
