import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download, ExternalLink, File, FileText, Folder, ShieldCheck, X } from "lucide-react";
import { historicoArquivo, historicoDocumento, urlVisualizar } from "@/lib/explorador";
import type { Arquivo, Documento, EventoHistorico, Pasta } from "@/lib/types";
import { extractTitle, formatBytes } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

export type ItemSelecionado =
  | { tipo: "arquivo"; item: Arquivo }
  | { tipo: "documento"; item: Documento }
  | { tipo: "pasta"; item: Pasta };

/// Acima disso, a pré-visualização só carrega sob pedido: o servidor confere
/// o hash do arquivo inteiro antes de entregar.
const LIMITE_PREVIA_AUTOMATICA = 25 * 1024 * 1024;

const ACOES: Record<string, string> = {
  UPLOAD: "Enviou",
  CRIAR: "Criou",
  ATUALIZAR: "Editou",
  RENOMEAR: "Renomeou",
  DOWNLOAD: "Baixou",
  VISUALIZAR: "Visualizou",
  REMOVER: "Excluiu",
  COMPILAR_LAUDO: "Gerou o PDF do laudo",
  FALHA_INTEGRIDADE: "Falha de integridade detectada",
};

function tipoPrevia(arquivo: Arquivo): "imagem" | "pdf" | "texto" | null {
  const mime = arquivo.tipo_mime.toLowerCase();
  if (["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"].includes(mime)) return "imagem";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain" || /\.(txt|log|md|csv|json|xml|ya?ml|ini|cfg|conf)$/i.test(arquivo.nome)) return "texto";
  return null;
}

function Previa({ arquivo }: { arquivo: Arquivo }) {
  const tipo = tipoPrevia(arquivo);
  const texto = useQuery({
    queryKey: ["previa-texto", arquivo.id],
    queryFn: async () => {
      const res = await fetch(urlVisualizar(arquivo.id), { credentials: "include" });
      if (!res.ok) throw new Error();
      return (await res.text()).slice(0, 20000);
    },
    enabled: tipo === "texto" && arquivo.tamanho <= LIMITE_PREVIA_AUTOMATICA,
    staleTime: Infinity,
  });

  if (!tipo || arquivo.tamanho > LIMITE_PREVIA_AUTOMATICA) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md bg-secondary/40 text-center text-xs text-muted-foreground">
        <File className="h-10 w-10" />
        {tipo ? "Arquivo grande — baixe para ver o conteúdo." : "Sem pré-visualização para este tipo de arquivo."}
      </div>
    );
  }
  if (tipo === "imagem") {
    return (
      <img
        src={urlVisualizar(arquivo.id)}
        alt={arquivo.nome}
        className="max-h-64 w-full rounded-md bg-secondary/40 object-contain"
      />
    );
  }
  if (tipo === "pdf") {
    return <iframe src={urlVisualizar(arquivo.id)} title={arquivo.nome} className="h-80 w-full rounded-md bg-white" />;
  }
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-secondary/40 p-2 font-mono text-[11px]">
      {texto.isLoading ? "Carregando…" : texto.isError ? "Não foi possível carregar." : texto.data}
    </pre>
  );
}

function Historico({ tipo, id }: { tipo: "arquivo" | "documento"; id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["historico", tipo, id],
    queryFn: () => (tipo === "arquivo" ? historicoArquivo(id) : historicoDocumento(id)),
  });
  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando…</p>;
  if (!data?.length) return <p className="text-xs text-muted-foreground">Sem registros.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {[...data].reverse().map((e: EventoHistorico) => (
        <li key={e.id} className="text-xs">
          <p className={e.acao === "FALHA_INTEGRIDADE" ? "font-medium text-destructive" : ""}>
            <span className="font-medium">{e.user?.nome ?? "Sistema"}</span> {(ACOES[e.acao] ?? e.acao).toLowerCase()}
          </p>
          <p className="text-muted-foreground">
            {new Date(e.timestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Hash({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Linha rotulo={rotulo}>
      <span className="flex items-center gap-1">
        <code className="min-w-0 flex-1 truncate font-mono text-xs" title={valor}>
          {valor}
        </code>
        <CopyButton value={valor} />
      </span>
    </Linha>
  );
}

/// Painel lateral de detalhes (o "i" do Drive): pré-visualização, dados,
/// integridade e a trilha de custódia do item selecionado.
export function PainelDetalhes({
  selecionado,
  local,
  onFechar,
  onAbrirPasta,
  onBaixar,
  onVerificar,
}: {
  selecionado: ItemSelecionado;
  local: string;
  onFechar: () => void;
  onAbrirPasta: (pasta: Pasta) => void;
  onBaixar: (arquivo: Arquivo) => void;
  onVerificar: (arquivo: Arquivo) => void;
}) {
  const data = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const { tipo, item } = selecionado;
  const titulo = tipo === "documento" ? extractTitle(item.conteudo) : item.nome;
  const Icone = tipo === "pasta" ? Folder : tipo === "documento" ? FileText : File;

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border pl-4">
      <div className="flex items-start gap-2">
        <Icone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 break-words text-sm font-semibold">{titulo}</h2>
        <button onClick={onFechar} title="Fechar" className="rounded p-1 text-muted-foreground hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      {tipo === "arquivo" && <Previa arquivo={item} />}

      <div className="flex flex-wrap gap-2">
        {tipo === "arquivo" && (
          <>
            <Button size="sm" onClick={() => onBaixar(item)}>
              <Download className="h-3.5 w-3.5" /> Baixar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onVerificar(item)}>
              <ShieldCheck className="h-3.5 w-3.5" /> Verificar integridade
            </Button>
          </>
        )}
        {tipo === "documento" && (
          <Link to={`/documentos/${item.id}`} className={buttonVariants({ size: "sm" })}>
            <ExternalLink className="h-3.5 w-3.5" /> Abrir
          </Link>
        )}
        {tipo === "pasta" && (
          <Button size="sm" onClick={() => onAbrirPasta(item)}>
            <Folder className="h-3.5 w-3.5" /> Abrir pasta
          </Button>
        )}
      </div>

      <dl className="flex flex-col gap-2.5">
        <Linha rotulo="Local">{local}</Linha>
        {tipo === "arquivo" && (
          <>
            <Linha rotulo="Tipo">{item.tipo_mime || "—"}</Linha>
            <Linha rotulo="Tamanho">{formatBytes(item.tamanho)}</Linha>
            <Linha rotulo="Enviado por">{item.enviado_por_nome ?? "—"}</Linha>
            <Linha rotulo="Enviado em">{data(item.enviado_em)}</Linha>
            <Hash rotulo="SHA-256 (registrado no envio)" valor={item.hash_sha256} />
          </>
        )}
        {tipo === "documento" && (
          <>
            <Linha rotulo="Criado em">{data(item.criado_em)}</Linha>
            <Linha rotulo="Modificado em">{data(item.atualizado_em)}</Linha>
          </>
        )}
        {tipo === "pasta" && <Linha rotulo="Criada em">{data(item.criado_em)}</Linha>}
        {item.ipfs_cid && <Hash rotulo="CID (árvore de integridade)" valor={item.ipfs_cid} />}
      </dl>

      {tipo !== "pasta" && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atividade</h3>
          <Historico tipo={tipo} id={item.id} />
        </div>
      )}
    </aside>
  );
}
