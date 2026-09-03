import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { api } from "@/lib/api";
import { markdownToHtml } from "@/lib/markdown";
import { Button } from "@/components/ui/button";

export default function DocumentEditorPage() {
  const { documentoId = "" } = useParams();
  const navigate = useNavigate();
  const { data: documento } = useQuery({
    queryKey: ["documento", documentoId],
    queryFn: () => api.documentos.buscar(documentoId),
    enabled: !!documentoId,
  });
  const [conteudo, setConteudo] = useState("");

  useEffect(() => {
    if (documento) setConteudo(documento.conteudo);
  }, [documento]);

  const salvar = useMutation({
    mutationFn: () => api.documentos.atualizar(documentoId, conteudo),
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-primary">Editor de Documento</h1>
        </div>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          <Save className="h-4 w-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2">
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          spellCheck={false}
          className="h-full resize-none border-r border-border bg-card p-6 font-mono text-sm text-foreground focus:outline-none"
        />
        <div
          className="h-full overflow-auto p-6 prose-invert [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-2 [&_p]:text-sm [&_p]:text-foreground [&_ul]:ml-5 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(conteudo) }}
        />
      </div>
    </div>
  );
}
