import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bold,
  Check,
  Code,
  FileOutput,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  Save,
  Table,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { markdownToHtml } from "@/lib/markdown";
import { extractTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Editor split (markdown | preview) — a conversão em si mora em lib/markdown.ts
// (marked + DOMPurify, ver o comentário lá sobre por que o parser anterior
// não era 100% funcional). A barra de ferramentas insere sintaxe no cursor;
// não depende de nenhuma seleção rica, só de textarea + posição do caret.
export default function DocumentEditorPage() {
  const { documentoId = "" } = useParams();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: documento } = useQuery({
    queryKey: ["documento", documentoId],
    queryFn: () => api.documentos.buscar(documentoId),
    enabled: !!documentoId,
  });
  const [conteudo, setConteudo] = useState("");
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [resultadoLaudo, setResultadoLaudo] = useState<{ sucesso: boolean; log: string } | null>(null);

  useEffect(() => {
    if (documento) setConteudo(documento.conteudo);
  }, [documento]);

  const salvar = useMutation({
    mutationFn: () => api.documentos.atualizar(documentoId, conteudo),
    onSuccess: () => setSalvoEm(new Date()),
  });

  // Compila o Markdown atual em PDF (Pandoc + LaTeX/Eisvogel, ver
  // backend/src/laudo) — só existe pra documentos vinculados a um Projeto;
  // salva antes de compilar pra nunca gerar PDF de um conteúdo que ainda não
  // foi persistido.
  const compilarLaudo = useMutation({
    mutationFn: async () => {
      await api.documentos.atualizar(documentoId, conteudo);
      return api.laudo.compilar(documentoId);
    },
    onSuccess: (resultado) => {
      setSalvoEm(new Date());
      setResultadoLaudo(resultado);
    },
    onError: (e: unknown) => setResultadoLaudo({ sucesso: false, log: e instanceof ApiError ? e.message : "Falha ao compilar." }),
  });

  function inserirNoCursor(antes: string, depois = "", placeholder = "") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const inicio = textarea.selectionStart;
    const fim = textarea.selectionEnd;
    const selecionado = conteudo.slice(inicio, fim) || placeholder;
    const novo = conteudo.slice(0, inicio) + antes + selecionado + depois + conteudo.slice(fim);
    setConteudo(novo);
    requestAnimationFrame(() => {
      textarea.focus();
      const posicao = inicio + antes.length + selecionado.length;
      textarea.setSelectionRange(posicao, posicao);
    });
  }

  function inserirLinha(prefixo: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const inicio = textarea.selectionStart;
    const inicioLinha = conteudo.lastIndexOf("\n", inicio - 1) + 1;
    const novo = conteudo.slice(0, inicioLinha) + prefixo + conteudo.slice(inicioLinha);
    setConteudo(novo);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(inicio + prefixo.length, inicio + prefixo.length);
    });
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-primary">{extractTitle(conteudo, "Editor de Documento")}</h1>
        </div>
        <div className="flex items-center gap-3">
          {salvoEm && (
            <span className="text-xs text-muted-foreground">
              Salvo às {salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {documento?.projeto_id && (
            <Button variant="outline" onClick={() => compilarLaudo.mutate()} disabled={compilarLaudo.isPending}>
              <FileOutput className="h-4 w-4" /> {compilarLaudo.isPending ? "Compilando…" : "Compilar Laudo"}
            </Button>
          )}
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            <Save className="h-4 w-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </header>

      {resultadoLaudo && (
        <div
          className={`flex items-start gap-2 border-b border-border px-4 py-2 text-sm ${
            resultadoLaudo.sucesso ? "bg-status-approved/10" : "bg-destructive/10"
          }`}
        >
          {resultadoLaudo.sucesso ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-approved" />
          ) : (
            <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            {resultadoLaudo.sucesso ? (
              <a
                href={api.laudo.pdfUrl(documentoId)}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Laudo compilado com sucesso — abrir PDF
              </a>
            ) : (
              <>
                <p className="font-medium text-destructive">Falha ao compilar o laudo.</p>
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                  {resultadoLaudo.log}
                </pre>
              </>
            )}
          </div>
          <button onClick={() => setResultadoLaudo(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1 border-b border-border px-4 py-1.5">
        <ToolbarButton title="Negrito" onClick={() => inserirNoCursor("**", "**", "negrito")}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Itálico" onClick={() => inserirNoCursor("*", "*", "itálico")}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Título" onClick={() => inserirLinha("## ")}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Lista" onClick={() => inserirLinha("- ")}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Checklist" onClick={() => inserirLinha("- [ ] ")}>
          <ListChecks className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Código" onClick={() => inserirNoCursor("`", "`", "código")}>
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Tabela" onClick={() => inserirNoCursor("\n| Coluna 1 | Coluna 2 |\n| --- | --- |\n| valor | valor |\n")}>
          <Table className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Link" onClick={() => inserirNoCursor("[", "](https://)", "texto")}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2">
        <textarea
          ref={textareaRef}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          spellCheck={false}
          className="h-full resize-none border-r border-border bg-card p-6 font-mono text-sm text-foreground focus:outline-none"
        />
        <div
          className="prose prose-sm dark:prose-invert h-full max-w-none overflow-auto p-6"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(conteudo) }}
        />
      </div>
    </div>
  );
}

function ToolbarButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      type="button"
      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
