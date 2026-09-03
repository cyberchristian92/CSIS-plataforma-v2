import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, File, FilePlus2, FileText, Folder, FolderPlus, Home, ShieldCheck, Upload } from "lucide-react";
import { api } from "@/lib/api";
import type { Pasta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate } from "@/lib/utils";

// Explorador de arquivos no espírito do Google Drive: breadcrumb no topo,
// grade de pastas/arquivos/documentos, upload por botão. Cada nível de pasta
// carrega o CID IPFS quando disponível (ver backend/prisma/schema.prisma).

export default function ExplorerPage() {
  const { projetoId = "" } = useParams();
  const [trilha, setTrilha] = useState<Pasta[]>([]);
  const pastaAtual = trilha[trilha.length - 1];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: pastas } = useQuery({
    queryKey: ["pastas", projetoId, pastaAtual?.id],
    queryFn: () => api.pastas.listarPorProjeto(projetoId, pastaAtual?.id),
    enabled: !!projetoId,
  });

  const { data: arquivos } = useQuery({
    queryKey: ["arquivos", projetoId, pastaAtual?.id],
    queryFn: () => api.arquivos.listarPorProjeto(projetoId, pastaAtual?.id),
    enabled: !!projetoId,
  });

  const { data: documentos } = useQuery({
    queryKey: ["documentos", projetoId, pastaAtual?.id],
    queryFn: () => api.documentos.listarPorProjeto(projetoId, pastaAtual?.id),
    enabled: !!projetoId,
  });

  const criarPasta = useMutation({
    mutationFn: () => {
      const nome = window.prompt("Nome da pasta:");
      if (!nome) return Promise.reject(new Error("cancelado"));
      return api.pastas.criar(projetoId, nome, pastaAtual?.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pastas", projetoId, pastaAtual?.id] }),
  });

  const criarDocumento = useMutation({
    mutationFn: () => {
      const nome = window.prompt("Nome do documento:");
      if (!nome) return Promise.reject(new Error("cancelado"));
      return api.documentos.criar(projetoId, nome, pastaAtual?.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos", projetoId, pastaAtual?.id] }),
  });

  const enviarArquivo = useMutation({
    mutationFn: (file: File) => api.arquivos.enviar(projetoId, file, pastaAtual?.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["arquivos", projetoId, pastaAtual?.id] }),
  });

  const vazio = (pastas?.length ?? 0) === 0 && (arquivos?.length ?? 0) === 0 && (documentos?.length ?? 0) === 0;

  return (
    <div className="p-6">
      {/* Breadcrumb */}
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

      {/* Toolbar */}
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

      {vazio && <p className="py-10 text-center text-sm text-muted-foreground">Esta pasta está vazia.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pastas?.map((pasta) => (
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

        {documentos?.map((doc) => (
          <Link
            key={doc.id}
            to={`/documentos/${doc.id}`}
            className="group flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-accent"
          >
            <FileText className="h-8 w-8 text-muted-foreground" />
            <span className="w-full truncate text-sm font-medium">Documento</span>
            <span className="text-xs text-muted-foreground">{formatDate(doc.atualizado_em)}</span>
          </Link>
        ))}

        {arquivos?.map((arquivo) => (
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
    </div>
  );
}
