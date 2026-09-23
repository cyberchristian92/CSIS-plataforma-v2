import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ImagePlus, Pencil, RefreshCw, ShieldCheck, Trash2, Video } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { resizeImageToDataUrl } from "@/lib/image-resize";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { formatDate, youtubeEmbedUrl } from "@/lib/utils";

export default function ProjectOverviewPage() {
  const { projetoId = "" } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const podeRecalcular = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";
  const podeEditarResumo = podeRecalcular;
  const inputCapaRef = useRef<HTMLInputElement>(null);
  const [editandoVideo, setEditandoVideo] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [erroResumo, setErroResumo] = useState<string | null>(null);

  const { data: projeto } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: () => api.projetos.buscar(projetoId),
    enabled: !!projetoId,
  });
  const { data: missoes } = useQuery({
    queryKey: ["missoes", projetoId],
    queryFn: () => api.missoes.listarPorProjeto(projetoId),
    enabled: !!projetoId,
  });
  const { data: integridade } = useQuery({
    queryKey: ["integridade", "projeto", projetoId],
    queryFn: () => api.integridade.consultar("projeto", projetoId),
    enabled: !!projetoId,
  });

  // Recalcular aqui roda a varredura completa (todo o Workspace) — ainda não
  // há um recálculo isolado por projeto, então o botão serve tanto pra
  // "atualizar o selo deste projeto" quanto pra populamento geral (ver
  // docs/adr/0002-motor-de-integridade-sem-daemon-ipfs.md).
  const recalcular = useMutation({
    mutationFn: api.integridade.recalcularTudo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integridade"] }),
  });

  const atualizarResumo = useMutation({
    mutationFn: (dto: { capa_url?: string | null; video_url?: string | null }) => api.projetos.atualizar(projetoId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
      setEditandoVideo(false);
      setErroResumo(null);
    },
    onError: (e: unknown) => setErroResumo(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  async function onSelecionarCapa(file: File) {
    try {
      // Capa é um banner largo (não um ícone quadrado) — maxSize maior que o
      // usado pra logo, senão a imagem sai borrada esticada na largura toda.
      const dataUrl = await resizeImageToDataUrl(file, 1600);
      atualizarResumo.mutate({ capa_url: dataUrl });
    } catch (e) {
      setErroResumo(e instanceof Error ? e.message : "Falha ao processar a imagem.");
    }
  }

  function salvarVideo() {
    const url = videoUrlInput.trim();
    if (!url) return;
    if (!youtubeEmbedUrl(url)) {
      setErroResumo("Isso não parece um link do YouTube (watch?v=, youtu.be/ ou shorts/).");
      return;
    }
    atualizarResumo.mutate({ video_url: url });
  }

  if (!projeto) return null;

  const embedUrl = projeto.video_url ? youtubeEmbedUrl(projeto.video_url) : null;

  return (
    <div className="flex flex-col gap-4 p-6">
      <input
        ref={inputCapaRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onSelecionarCapa(file);
        }}
      />

      {/* Capa — estilo capa do Notion: banner no topo da página. Sem capa
          definida, só aparece pra quem pode editar (convite discreto pra
          adicionar uma), nunca uma faixa vazia pra quem só visualiza. */}
      {projeto.capa_url ? (
        <div className="group relative h-40 w-full overflow-hidden rounded-lg sm:h-52">
          <img src={projeto.capa_url} alt="" className="h-full w-full object-cover" />
          {podeEditarResumo && (
            <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button size="sm" variant="outline" onClick={() => inputCapaRef.current?.click()} disabled={atualizarResumo.isPending}>
                <ImagePlus className="h-3.5 w-3.5" /> Trocar capa
              </Button>
              <Button size="sm" variant="outline" onClick={() => atualizarResumo.mutate({ capa_url: null })} disabled={atualizarResumo.isPending}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        podeEditarResumo && (
          <button
            onClick={() => inputCapaRef.current?.click()}
            disabled={atualizarResumo.isPending}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <ImagePlus className="h-4 w-4" /> Adicionar capa
          </button>
        )
      )}

      {erroResumo && <p className="text-xs text-destructive">{erroResumo}</p>}

      {/* Vídeo embutido — resumo do projeto em vídeo, estilo embed do Notion. */}
      {embedUrl ? (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Video className="h-4 w-4 text-primary" /> Vídeo
              </h2>
              {podeEditarResumo && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setVideoUrlInput(projeto.video_url ?? "");
                      setEditandoVideo(true);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Trocar vídeo"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => atualizarResumo.mutate({ video_url: null })}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remover vídeo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {editandoVideo ? (
              <div className="flex gap-2">
                <Input
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  autoFocus
                />
                <Button size="sm" onClick={salvarVideo} disabled={atualizarResumo.isPending}>
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditandoVideo(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="aspect-video w-full overflow-hidden rounded-md">
                <iframe
                  src={embedUrl}
                  title="Vídeo do projeto"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        podeEditarResumo &&
        (editandoVideo ? (
          <Card>
            <CardContent className="flex gap-2 p-5">
              <Input
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                autoFocus
              />
              <Button size="sm" onClick={salvarVideo} disabled={atualizarResumo.isPending}>
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditandoVideo(false)}>
                Cancelar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <button
            onClick={() => {
              setVideoUrlInput("");
              setEditandoVideo(true);
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <Video className="h-4 w-4" /> Adicionar vídeo do YouTube
          </button>
        ))
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardContent className="p-5">
          <h2 className="mb-3 text-base font-semibold">Descrição</h2>
          <p className="text-sm text-muted-foreground">{projeto.descricao || "Sem descrição."}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Status</p>
            <Badge variant={projeto.status === "ATIVO" ? "default" : projeto.status === "CONCLUIDO" ? "secondary" : "outline"}>
              {projeto.status}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Prazo</p>
            <p className="font-medium">{projeto.prazo ? formatDate(projeto.prazo) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Missões</p>
            <p className="font-medium">{missoes?.length ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-3">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Integridade
            </h2>
            {podeRecalcular && (
              <Button size="sm" variant="outline" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
                <RefreshCw className={`h-3.5 w-3.5 ${recalcular.isPending ? "animate-spin" : ""}`} />
                Recalcular
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Hash agregado (CID) de todo o conteúdo deste projeto — pastas, arquivos, documentos e missões. Muda
            automaticamente a qualquer alteração; qualquer adulteração fora da plataforma quebraria essa cadeia.
          </p>
          {integridade?.ipfs_cid ? (
            <div className="mt-2 flex items-start gap-1.5">
              <p className="break-all font-mono text-xs text-foreground">{integridade.ipfs_cid}</p>
              <CopyButton value={integridade.ipfs_cid} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Ainda não calculado — clique em Recalcular.</p>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
