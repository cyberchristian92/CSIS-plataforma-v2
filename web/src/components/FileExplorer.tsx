import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Download,
  File,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  FolderUp,
  Home,
  Info,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { explorador, type ExplorerScope } from "@/lib/explorador";
import type { Arquivo, Documento, Pasta } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { usePromptDialog } from "@/components/ui/prompt-dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, extractTitle, formatBytes, formatDate } from "@/lib/utils";
import { lerArrastados, lerSelecaoDePasta } from "./explorador/arrastar";
import { useEnvios } from "./explorador/envios";
import { PainelDetalhes, type ItemSelecionado } from "./explorador/PainelDetalhes";

export type { ExplorerScope } from "@/lib/explorador";

type Visao = "grade" | "lista";
type CampoOrdem = "nome" | "modificado" | "tamanho";

/// Uma linha do explorador — pasta, documento ou arquivo — normalizada para
/// ordenar e exibir do mesmo jeito.
interface Entrada {
  chave: string;
  sel: ItemSelecionado;
  nome: string;
  modificado: string;
  tamanho: number | null;
  dono: string | null;
  pastaId: string | null;
}

const CHAVE_VISAO = "csis.explorador.visao";
const CHAVE_PAINEL = "csis.explorador.detalhes";

function lerPainel(): boolean {
  try {
    return localStorage.getItem(CHAVE_PAINEL) === "1";
  } catch {
    return false;
  }
}

function lerVisao(): Visao {
  try {
    return localStorage.getItem(CHAVE_VISAO) === "lista" ? "lista" : "grade";
  } catch {
    return "grade";
  }
}

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function entradas(pastas: Pasta[] = [], documentos: Documento[] = [], arquivos: Arquivo[] = []): Entrada[] {
  return [
    ...pastas.map((p) => ({
      chave: `p-${p.id}`,
      sel: { tipo: "pasta" as const, item: p },
      nome: p.nome,
      modificado: p.criado_em,
      tamanho: null,
      dono: null,
      pastaId: p.pasta_pai_id,
    })),
    ...documentos.map((d) => ({
      chave: `d-${d.id}`,
      sel: { tipo: "documento" as const, item: d },
      nome: extractTitle(d.conteudo),
      modificado: d.atualizado_em,
      tamanho: null,
      dono: null,
      pastaId: d.pasta_id,
    })),
    ...arquivos.map((a) => ({
      chave: `a-${a.id}`,
      sel: { tipo: "arquivo" as const, item: a },
      nome: a.nome,
      modificado: a.enviado_em,
      tamanho: a.tamanho,
      dono: a.enviado_por_nome ?? null,
      pastaId: a.pasta_id,
    })),
  ];
}

function IconeEntrada({ tipo, className }: { tipo: ItemSelecionado["tipo"]; className?: string }) {
  if (tipo === "pasta") return <Folder className={cn("text-primary", className)} />;
  if (tipo === "documento") return <FileText className={cn("text-muted-foreground", className)} />;
  return <File className={cn("text-muted-foreground", className)} />;
}

// Explorador de arquivos no estilo Google Drive: lista/grade, busca, pasta
// atual na URL, painel de detalhes com pré-visualização e cadeia de custódia,
// e envio arrastando arquivos e pastas inteiras do computador. A mesma tela
// serve os três escopos (Projeto, Área e "Recursos" do Workspace).
export function FileExplorer({ scope, podeCriar = true }: { scope: ExplorerScope; podeCriar?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  // Depende só de tipo+id: `scope` costuma ser um objeto literal novo a cada render.
  const api2 = useMemo(() => explorador({ type: scope.type, id: scope.id }), [scope.type, scope.id]);
  const chave = useMemo(() => ["explorador", scope.type, scope.id] as const, [scope.type, scope.id]);
  const [params, setParams] = useSearchParams();
  const pastaAtualId = params.get("pasta") ?? undefined;
  const { ask, dialog: promptDialog } = usePromptDialog();
  const { ask: confirmar, dialog: confirmDialog } = useConfirmDialog();

  const [visao, setVisao] = useState<Visao>(lerVisao);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({ campo: "nome", asc: true });
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<ItemSelecionado | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [menuNovo, setMenuNovo] = useState(false);
  const [painelAberto, setPainelAberto] = useState(lerPainel);
  const [arrastando, setArrastando] = useState(false);
  const [verificacao, setVerificacao] = useState<{ nome: string; integro: boolean; original: string; atual: string } | null>(
    null,
  );
  const inputArquivos = useRef<HTMLInputElement>(null);
  const inputPasta = useRef<HTMLInputElement>(null);
  const profundidadeArraste = useRef(0);

  const invalidar = useCallback(() => qc.invalidateQueries({ queryKey: chave }), [qc, chave]);
  const { enviar, painel: painelEnvios } = useEnvios(scope, invalidar);

  const todasPastas = useQuery({ queryKey: [...chave, "todas-pastas"], queryFn: api2.todasPastas });
  const pastas = useQuery({ queryKey: [...chave, "pastas", pastaAtualId], queryFn: () => api2.pastas(pastaAtualId) });
  const documentos = useQuery({
    queryKey: [...chave, "documentos", pastaAtualId],
    queryFn: () => api2.documentos(pastaAtualId),
  });
  const arquivos = useQuery({ queryKey: [...chave, "arquivos", pastaAtualId], queryFn: () => api2.arquivos(pastaAtualId) });
  const buscando = busca.trim().length > 0;
  const todosDocumentos = useQuery({
    queryKey: [...chave, "todos-documentos"],
    queryFn: api2.todosDocumentos,
    enabled: buscando,
  });
  const todosArquivos = useQuery({ queryKey: [...chave, "todos-arquivos"], queryFn: api2.todosArquivos, enabled: buscando });

  const pastaPorId = useMemo(() => new Map((todasPastas.data ?? []).map((p) => [p.id, p])), [todasPastas.data]);

  /// Caminho de uma pasta até a raiz (para breadcrumb e "Local").
  const caminhoDe = useCallback(
    (pastaId: string | null | undefined): Pasta[] => {
      const caminho: Pasta[] = [];
      const vistos = new Set<string>();
      for (let atual = pastaId ? pastaPorId.get(pastaId) : undefined; atual && !vistos.has(atual.id); ) {
        vistos.add(atual.id);
        caminho.unshift(atual);
        atual = atual.pasta_pai_id ? pastaPorId.get(atual.pasta_pai_id) : undefined;
      }
      return caminho;
    },
    [pastaPorId],
  );
  const trilha = caminhoDe(pastaAtualId);
  const local = (pastaId: string | null) => ["Raiz", ...caminhoDe(pastaId).map((p) => p.nome)].join(" / ");

  const abrirPasta = (pastaId?: string) => {
    const novos = new URLSearchParams(params);
    if (pastaId) novos.set("pasta", pastaId);
    else novos.delete("pasta");
    setParams(novos);
    setSelecionado(null);
    setBusca("");
  };

  const lista = useMemo(() => {
    const base = buscando
      ? entradas(todasPastas.data, todosDocumentos.data, todosArquivos.data).filter((e) =>
          normalizar(e.nome).includes(normalizar(busca.trim())),
        )
      : entradas(pastas.data, documentos.data, arquivos.data);
    const fator = ordem.asc ? 1 : -1;
    return [...base].sort((a, b) => {
      // Pastas sempre primeiro, como no Drive.
      const pa = a.sel.tipo === "pasta" ? 0 : 1;
      const pb = b.sel.tipo === "pasta" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (ordem.campo === "tamanho") return ((a.tamanho ?? -1) - (b.tamanho ?? -1)) * fator;
      if (ordem.campo === "modificado") return a.modificado.localeCompare(b.modificado) * fator;
      return a.nome.localeCompare(b.nome, "pt-BR", { numeric: true, sensitivity: "base" }) * fator;
    });
  }, [buscando, busca, ordem, todasPastas.data, todosDocumentos.data, todosArquivos.data, pastas.data, documentos.data, arquivos.data]);

  const carregando = pastas.isLoading || documentos.isLoading || arquivos.isLoading;

  // --- Ações (as mesmas de antes, agora a partir da lista ou do painel) ------

  const criarPasta = useMutation({
    mutationFn: async () => {
      const nome = await ask("Nome da pasta");
      if (!nome) return Promise.reject(new Error("cancelado"));
      return api2.criarPasta(nome, pastaAtualId);
    },
    onSuccess: invalidar,
  });

  const criarDocumento = useMutation({
    mutationFn: async () => {
      const nome = await ask("Nome do documento");
      if (!nome) return Promise.reject(new Error("cancelado"));
      return api2.criarDocumento(nome, pastaAtualId);
    },
    onSuccess: invalidar,
  });

  const renomearPasta = useMutation({
    mutationFn: async (pasta: Pasta) => {
      const nome = await ask("Renomear pasta", pasta.nome);
      if (!nome || nome === pasta.nome) return Promise.reject(new Error("cancelado"));
      return api.pastas.renomear(pasta.id, nome);
    },
    onSuccess: invalidar,
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
      setSelecionado(null);
      invalidar();
    },
  });

  const renomearArquivo = useMutation({
    mutationFn: async (arquivo: Arquivo) => {
      const nome = await ask("Renomear arquivo", arquivo.nome);
      if (!nome || nome === arquivo.nome) return Promise.reject(new Error("cancelado"));
      return api.arquivos.renomear(arquivo.id, nome);
    },
    onSuccess: invalidar,
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
    onSuccess: () => {
      setSelecionado(null);
      invalidar();
    },
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
    onSuccess: () => {
      setSelecionado(null);
      invalidar();
    },
  });

  const resultadoVerificacao = (r: { arquivo: Arquivo; integro: boolean; hash_original: string; hash_atual: string | null }) =>
    setVerificacao({
      nome: r.arquivo.nome,
      integro: r.integro,
      original: r.hash_original,
      atual: r.hash_atual ?? "conteúdo ausente do servidor",
    });
  const erroVerificacao = (e: unknown, padrao: string) =>
    setVerificacao({ nome: "Erro", integro: false, original: "", atual: e instanceof ApiError ? e.message : padrao });

  const verificarArquivo = useMutation({
    mutationFn: (arquivo: Arquivo) => api.arquivos.verificarIntegridade(arquivo.id).then((r) => ({ arquivo, ...r })),
    onSuccess: (r) => {
      resultadoVerificacao(r);
      qc.invalidateQueries({ queryKey: ["historico", "arquivo", r.arquivo.id] });
    },
    onError: (e) => erroVerificacao(e, "Falha ao verificar."),
  });

  // Confere o hash antes de baixar: se o arquivo em disco foi adulterado, o
  // servidor recusaria o download de qualquer forma — aqui a pessoa vê o
  // mesmo aviso da verificação em vez de um erro cru do navegador.
  const baixarArquivo = useMutation({
    mutationFn: (arquivo: Arquivo) => api.arquivos.verificarIntegridade(arquivo.id).then((r) => ({ arquivo, ...r })),
    onSuccess: (r) => {
      if (!r.integro) return resultadoVerificacao(r);
      const link = document.createElement("a");
      link.href = api.arquivos.urlDownload(r.arquivo.id);
      link.download = r.arquivo.nome;
      link.click();
      setTimeout(() => qc.invalidateQueries({ queryKey: ["historico", "arquivo", r.arquivo.id] }), 1500);
    },
    onError: (e) => erroVerificacao(e, "Falha ao baixar."),
  });

  const abrir = (sel: ItemSelecionado) => {
    if (sel.tipo === "pasta") abrirPasta(sel.item.id);
    else if (sel.tipo === "documento") navigate(`/documentos/${sel.item.id}`);
    else {
      setSelecionado(sel);
      alternarPainel(true);
    }
  };

  const acoes = (sel: ItemSelecionado): ItemMenuAction[] => {
    if (sel.tipo === "pasta") {
      return podeCriar
        ? [
            { label: "Renomear", icon: Pencil, onClick: () => renomearPasta.mutate(sel.item) },
            { label: "Excluir", icon: Trash2, destrutivo: true, onClick: () => removerPasta.mutate(sel.item) },
          ]
        : [];
    }
    if (sel.tipo === "documento") {
      return podeCriar
        ? [{ label: "Excluir", icon: Trash2, destrutivo: true, onClick: () => removerDocumento.mutate(sel.item) }]
        : [];
    }
    return [
      { label: "Baixar", icon: Download, onClick: () => baixarArquivo.mutate(sel.item) },
      { label: "Verificar integridade", icon: ShieldCheck, onClick: () => verificarArquivo.mutate(sel.item) },
      ...(podeCriar
        ? [
            { label: "Renomear", icon: Pencil, onClick: () => renomearArquivo.mutate(sel.item) },
            { label: "Excluir", icon: Trash2, destrutivo: true, onClick: () => removerArquivo.mutate(sel.item) },
          ]
        : []),
    ];
  };

  // --- Arrastar e soltar do computador --------------------------------------

  const aoArrastarEntrar = (e: React.DragEvent) => {
    if (!podeCriar || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    profundidadeArraste.current += 1;
    setArrastando(true);
  };
  const aoArrastarSair = () => {
    profundidadeArraste.current = Math.max(0, profundidadeArraste.current - 1);
    if (profundidadeArraste.current === 0) setArrastando(false);
  };
  const aoSoltar = async (e: React.DragEvent) => {
    if (!podeCriar) return;
    e.preventDefault();
    profundidadeArraste.current = 0;
    setArrastando(false);
    const itens = await lerArrastados(e.dataTransfer);
    void enviar(itens, pastaAtualId);
  };

  const nomePastaAtual = trilha[trilha.length - 1]?.nome ?? "Raiz";
  const alternarOrdem = (campo: CampoOrdem) =>
    setOrdem((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: campo === "nome" }));
  const alternarPainel = (aberto: boolean) => {
    setPainelAberto(aberto);
    try {
      localStorage.setItem(CHAVE_PAINEL, aberto ? "1" : "0");
    } catch {
      // preferência só desta sessão
    }
  };
  const mudarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(CHAVE_VISAO, v);
    } catch {
      // preferência só desta sessão
    }
  };

  return (
    <div
      className="relative flex min-h-[60vh] gap-4"
      onClick={() => {
        setMenuAberto(null);
        setMenuNovo(false);
      }}
      onDragEnter={aoArrastarEntrar}
      onDragOver={(e) => podeCriar && e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDragLeave={aoArrastarSair}
      onDrop={aoSoltar}
    >
      <div className="min-w-0 flex-1">
        {/* Caminho */}
        <div className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <button
            onClick={() => abrirPasta(undefined)}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" /> Raiz
          </button>
          {trilha.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" />
              <button
                onClick={() => abrirPasta(p.id)}
                className="rounded-md px-1.5 py-1 hover:bg-accent hover:text-foreground"
              >
                {p.nome}
              </button>
            </span>
          ))}
        </div>

        {/* Barra de ferramentas: "+ Novo" (menu, como no Drive), busca, visão e detalhes */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {podeCriar && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={() => setMenuNovo((v) => !v)}>
                <Plus className="h-4 w-4" /> Novo
              </Button>
              {menuNovo && (
                <div className="absolute left-0 top-10 z-20 w-52 rounded-md border border-border bg-card py-1 shadow-lg">
                  <ItemNovo icone={FolderPlus} rotulo="Nova pasta" onClick={() => { setMenuNovo(false); criarPasta.mutate(); }} />
                  <ItemNovo icone={FilePlus2} rotulo="Novo documento" onClick={() => { setMenuNovo(false); criarDocumento.mutate(); }} />
                  <div className="my-1 border-t border-border" />
                  <ItemNovo icone={Upload} rotulo="Enviar arquivos" onClick={() => { setMenuNovo(false); inputArquivos.current?.click(); }} />
                  <ItemNovo icone={FolderUp} rotulo="Enviar pasta" onClick={() => { setMenuNovo(false); inputPasta.current?.click(); }} />
                </div>
              )}
              <input
                ref={inputArquivos}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const itens = [...(e.target.files ?? [])].map((arquivo) => ({ arquivo, pastas: [] }));
                  void enviar(itens, pastaAtualId);
                  e.target.value = "";
                }}
              />
              <input
                ref={inputPasta}
                type="file"
                className="hidden"
                {...{ webkitdirectory: "", directory: "" }}
                onChange={(e) => {
                  if (e.target.files) void enviar(lerSelecaoDePasta(e.target.files), pastaAtualId);
                  e.target.value = "";
                }}
              />
            </div>
          )}
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar em todas as pastas"
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm"
            />
            {buscando && (
              <button
                onClick={() => setBusca("")}
                title="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex rounded-md border border-input">
            <button
              onClick={() => mudarVisao("lista")}
              title="Lista"
              className={cn("rounded-l-md p-2", visao === "lista" ? "bg-accent text-primary" : "text-muted-foreground")}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => mudarVisao("grade")}
              title="Grade"
              className={cn("rounded-r-md p-2", visao === "grade" ? "bg-accent text-primary" : "text-muted-foreground")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => alternarPainel(!painelAberto)}
            title={painelAberto ? "Ocultar detalhes" : "Ver detalhes"}
            className={cn(
              "rounded-md border border-input p-2",
              painelAberto ? "bg-accent text-primary" : "text-muted-foreground",
            )}
          >
            <Info className="h-4 w-4" />
          </button>
        </div>

        {buscando && (
          <p className="mb-2 text-xs text-muted-foreground">
            {lista.length} {lista.length === 1 ? "resultado" : "resultados"} para “{busca.trim()}” em todas as pastas
          </p>
        )}

        {!carregando && lista.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
            {buscando ? (
              "Nada encontrado."
            ) : (
              <>
                <Upload className="h-8 w-8" />
                Esta pasta está vazia.
                {podeCriar && <span className="text-xs">Arraste arquivos ou pastas do computador para cá.</span>}
              </>
            )}
          </div>
        )}

        {visao === "grade" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {lista.map((e) => (
              <div
                key={e.chave}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelecionado(e.sel);
                }}
                onDoubleClick={() => abrir(e.sel)}
                className={cn(
                  "group relative flex cursor-default select-none flex-col items-start gap-2 rounded-lg border p-3 text-left hover:bg-accent",
                  selecionado?.item.id === e.sel.item.id ? "border-primary bg-accent" : "border-border",
                )}
              >
                <IconeEntrada tipo={e.sel.tipo} className="h-8 w-8" />
                <span className="w-full truncate text-sm font-medium" title={e.nome}>
                  {e.nome}
                </span>
                <span className="text-xs text-muted-foreground">
                  {buscando ? local(e.pastaId) : e.tamanho !== null ? formatBytes(e.tamanho) : formatDate(e.modificado)}
                </span>
                <ItemMenu
                  aberto={menuAberto === e.chave}
                  onAbrir={() => setMenuAberto(e.chave)}
                  itens={acoes(e.sel)}
                />
              </div>
            ))}
          </div>
        ) : (
          lista.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[32rem] table-fixed text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <Coluna titulo="Nome" campo="nome" ordem={ordem} onClick={alternarOrdem} className="w-[42%]" />
                    <th className="px-3 py-2 font-medium">{buscando ? "Local" : "Enviado por"}</th>
                    <Coluna titulo="Modificado" campo="modificado" ordem={ordem} onClick={alternarOrdem} />
                    <Coluna titulo="Tamanho" campo="tamanho" ordem={ordem} onClick={alternarOrdem} />
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((e) => (
                    <tr
                      key={e.chave}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelecionado(e.sel);
                      }}
                      onDoubleClick={() => abrir(e.sel)}
                      className={cn(
                        "group cursor-default select-none border-b border-border last:border-0 hover:bg-accent",
                        selecionado?.item.id === e.sel.item.id && "bg-accent",
                      )}
                    >
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <IconeEntrada tipo={e.sel.tipo} className="h-4 w-4 shrink-0" />
                          <span className="truncate" title={e.nome}>
                            {e.nome}
                          </span>
                        </span>
                      </td>
                      <td className="truncate px-3 py-2 text-muted-foreground">
                        {buscando ? local(e.pastaId) : (e.dono ?? "—")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(e.modificado)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {e.tamanho !== null ? formatBytes(e.tamanho) : "—"}
                      </td>
                      <td className="relative px-1">
                        <ItemMenu
                          aberto={menuAberto === e.chave}
                          onAbrir={() => setMenuAberto(e.chave)}
                          itens={acoes(e.sel)}
                          estatico
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {painelAberto && !selecionado && (
        <aside className="flex w-80 shrink-0 flex-col items-center justify-center gap-2 border-l border-border pl-4 text-center text-sm text-muted-foreground">
          <Info className="h-8 w-8" />
          Selecione um item para ver os detalhes, a pré-visualização e o histórico de atividade.
        </aside>
      )}
      {painelAberto && selecionado && (
        <PainelDetalhes
          key={selecionado.item.id}
          selecionado={selecionado}
          local={local(
            selecionado.tipo === "pasta"
              ? selecionado.item.pasta_pai_id
              : (selecionado.item.pasta_id ?? null),
          )}
          onFechar={() => alternarPainel(false)}
          onAbrirPasta={(p) => abrirPasta(p.id)}
          onBaixar={(a) => baixarArquivo.mutate(a)}
          onVerificar={(a) => verificarArquivo.mutate(a)}
        />
      )}

      {arrastando && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10">
          <p className="rounded-md bg-card px-4 py-2 text-sm font-medium shadow">
            Solte para enviar para <strong>{nomePastaAtual}</strong>
          </p>
        </div>
      )}

      {painelEnvios}
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

function ItemNovo({ icone: Icone, rotulo, onClick }: { icone: typeof Plus; rotulo: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent">
      <Icone className="h-4 w-4 text-muted-foreground" /> {rotulo}
    </button>
  );
}

function Coluna({
  titulo,
  campo,
  ordem,
  onClick,
  className,
}: {
  titulo: string;
  campo: CampoOrdem;
  ordem: { campo: CampoOrdem; asc: boolean };
  onClick: (campo: CampoOrdem) => void;
  className?: string;
}) {
  const ativa = ordem.campo === campo;
  return (
    <th className={cn("px-3 py-2 font-medium", className)}>
      <button onClick={() => onClick(campo)} className={cn("flex items-center gap-1 hover:text-foreground", ativa && "text-foreground")}>
        {titulo}
        {ativa && (ordem.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

interface ItemMenuAction {
  label: string;
  icon: typeof Pencil;
  onClick: () => void;
  destrutivo?: boolean;
}

function ItemMenu({
  aberto,
  onAbrir,
  itens,
  estatico = false,
}: {
  aberto: boolean;
  onAbrir: () => void;
  itens: ItemMenuAction[];
  estatico?: boolean;
}): ReactNode {
  if (itens.length === 0) return null;
  return (
    <div className={estatico ? "relative" : "absolute right-1.5 top-1.5"} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => onAbrir()}
        className="rounded-md p-1 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {aberto && (
        <div className="absolute right-0 top-7 z-20 w-48 rounded-md border border-border bg-card py-1 shadow-lg">
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

