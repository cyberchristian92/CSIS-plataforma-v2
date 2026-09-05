import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Paperclip, Plus, Tag, Trash2, Users, X } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar } from "./ui/avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn, formatDate } from "@/lib/utils";
import { LABEL_PALETTE, STATUS_COLORS, STATUS_LABELS } from "@/lib/theme-constants";
import type { User } from "@/lib/types";

// Painel de detalhe da Missão — reúne tudo que no Flutter original vivia
// espalhado (status, capa, labels, responsáveis, checklist, Entrega+Revisão,
// comentários) num só lugar. As transições de status (Iniciar / Fazer
// Entrega / Aprovar / Rejeitar) não escondem botões por papel — o servidor
// é a fonte de verdade (SoD em revisoes.service.ts) e o erro aparece inline,
// replicando o comportamento do app original.

export function MissionDialog({ missaoId, onClose }: { missaoId: string | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [novoComentario, setNovoComentario] = useState("");
  const [novoItemChecklist, setNovoItemChecklist] = useState("");
  const [conteudoEntrega, setConteudoEntrega] = useState("");
  const [mostrarEntrega, setMostrarEntrega] = useState(false);
  const [mostrarAtribuir, setMostrarAtribuir] = useState(false);
  const [novaTag, setNovaTag] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [novaLabel, setNovaLabel] = useState(false);
  const [nomeLabel, setNomeLabel] = useState("");
  const [corLabel, setCorLabel] = useState<string>(LABEL_PALETTE[0]);

  const open = !!missaoId;

  const { data: missao } = useQuery({
    queryKey: ["missao", missaoId],
    queryFn: () => api.missoes.buscar(missaoId!),
    enabled: open,
  });

  const { data: entregas } = useQuery({
    queryKey: ["entregas", missaoId],
    queryFn: () => api.entregas.listarPorMissao(missaoId!),
    enabled: open,
  });

  const { data: checklist } = useQuery({
    queryKey: ["checklist", missaoId],
    queryFn: () => api.checklist.listarPorMissao(missaoId!),
    enabled: open,
  });

  const { data: comentarios } = useQuery({
    queryKey: ["comentarios", missaoId],
    queryFn: () => api.comentarios.listarPorMissao(missaoId!),
    enabled: open,
  });

  const { data: projectLabels } = useQuery({
    queryKey: ["missao-labels", missao?.projeto_id],
    queryFn: () => api.missaoLabels.listarPorProjeto(missao!.projeto_id),
    enabled: !!missao?.projeto_id,
  });

  const podeGerenciar = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";
  const podeRevisar = podeGerenciar || user?.papel_global === "REVISOR";
  const ehResponsavel = !!missao?.responsaveis?.some((r) => r.user.id === user?.id);

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios"],
    queryFn: api.auth.listarUsuarios,
    enabled: mostrarAtribuir && podeGerenciar,
  });

  function invalidarMissao() {
    qc.invalidateQueries({ queryKey: ["missao", missaoId] });
    qc.invalidateQueries({ queryKey: ["missoes-minhas"] });
    qc.invalidateQueries({ queryKey: ["missoes-em-revisao"] });
    qc.invalidateQueries({ queryKey: ["missoes", missao?.projeto_id] });
  }

  function runOrShowError(fn: () => Promise<unknown>) {
    setErro(null);
    fn().then(invalidarMissao).catch((e) => setErro(e.message ?? "Falha na operação."));
  }

  const iniciar = useMutation({ mutationFn: () => api.missoes.iniciar(missaoId!), onSuccess: invalidarMissao });

  const enviarEntrega = useMutation({
    mutationFn: () => api.entregas.criar(missaoId!, conteudoEntrega || undefined),
    onSuccess: () => {
      setConteudoEntrega("");
      setMostrarEntrega(false);
      invalidarMissao();
      qc.invalidateQueries({ queryKey: ["entregas", missaoId] });
    },
  });

  const revisar = useMutation({
    mutationFn: ({ entregaId, status }: { entregaId: string; status: "APROVADO" | "REJEITADO" }) =>
      api.revisoes.criar(entregaId, status),
    onSuccess: () => {
      invalidarMissao();
      qc.invalidateQueries({ queryKey: ["entregas", missaoId] });
    },
    onError: (e: any) => setErro(e.message ?? "Falha ao revisar."),
  });

  const toggleLabel = useMutation({
    mutationFn: (labelIds: string[]) => api.missoes.atualizarLabels(missaoId!, labelIds),
    onSuccess: invalidarMissao,
  });

  const criarLabel = useMutation({
    mutationFn: () => api.missaoLabels.criar(missao!.projeto_id, nomeLabel, corLabel),
    onSuccess: () => {
      setNovaLabel(false);
      setNomeLabel("");
      qc.invalidateQueries({ queryKey: ["missao-labels", missao?.projeto_id] });
    },
  });

  const atualizarCapa = useMutation({
    mutationFn: (cor: string | null) => api.missoes.atualizarCapa(missaoId!, cor),
    onSuccess: invalidarMissao,
  });

  const atualizarTags = useMutation({
    mutationFn: (tags: string[]) => api.missoes.atualizarTags(missaoId!, tags),
    onSuccess: invalidarMissao,
  });

  const atribuir = useMutation({
    mutationFn: (ids: string[]) => api.missoes.atribuir(missaoId!, ids),
    onSuccess: () => {
      invalidarMissao();
      setMostrarAtribuir(false);
    },
  });

  const addChecklist = useMutation({
    mutationFn: (texto: string) => api.checklist.criar(missaoId!, texto),
    onSuccess: () => {
      setNovoItemChecklist("");
      qc.invalidateQueries({ queryKey: ["checklist", missaoId] });
    },
  });

  const toggleChecklist = useMutation({
    mutationFn: ({ id, concluido }: { id: string; concluido: boolean }) => api.checklist.atualizar(id, { concluido }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", missaoId] }),
  });

  const removerChecklist = useMutation({
    mutationFn: (id: string) => api.checklist.remover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", missaoId] }),
  });

  const addComentario = useMutation({
    mutationFn: (texto: string) => api.comentarios.criar(missaoId!, texto),
    onSuccess: () => {
      setNovoComentario("");
      qc.invalidateQueries({ queryKey: ["comentarios", missaoId] });
    },
  });

  const removerComentario = useMutation({
    mutationFn: (id: string) => api.comentarios.remover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comentarios", missaoId] }),
  });

  if (!missao) {
    if (!open) return null;
    return (
      <Dialog open={open} onClose={onClose} className="max-w-2xl">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </Dialog>
    );
  }

  const ultimaEntrega = entregas?.[0];
  const podeAprovarRejeitar = ultimaEntrega?.status === "EM_REVISAO" && missao.status === "EM_REVISAO";

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <div className="flex items-start justify-between gap-3 pr-6">
        <h2 className="text-lg font-bold">{missao.titulo}</h2>
        <Badge style={{ backgroundColor: STATUS_COLORS[missao.status], color: "#050F1C", borderColor: "transparent" }}>
          {STATUS_LABELS[missao.status] ?? missao.status}
        </Badge>
      </div>
      {missao.descricao && <p className="mt-2 text-sm text-muted-foreground">{missao.descricao}</p>}

      {erro && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {erro}
        </div>
      )}

      {/* Capa */}
      <Section title="Cor da capa">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => atualizarCapa.mutate(null)}
            className={cn(
              "h-6 w-6 rounded-full border-2 border-dashed border-border",
              !missao.cor_capa && "ring-2 ring-primary ring-offset-1 ring-offset-card",
            )}
            title="Sem capa"
          />
          {LABEL_PALETTE.map((cor) => (
            <button
              key={cor}
              onClick={() => atualizarCapa.mutate(cor)}
              className={cn(
                "h-6 w-6 rounded-full",
                missao.cor_capa === cor && "ring-2 ring-primary ring-offset-1 ring-offset-card",
              )}
              style={{ backgroundColor: cor }}
            />
          ))}
        </div>
      </Section>

      {/* Labels */}
      <Section title="Labels">
        <div className="flex flex-wrap gap-1.5">
          {projectLabels?.map((label) => {
            const ativa = missao.labels?.some((l) => l.label.id === label.id);
            return (
              <button
                key={label.id}
                onClick={() => {
                  const atuais = missao.labels?.map((l) => l.label.id) ?? [];
                  toggleLabel.mutate(ativa ? atuais.filter((id) => id !== label.id) : [...atuais, label.id]);
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium text-white/90",
                  !ativa && "opacity-40 hover:opacity-70",
                )}
                style={{ backgroundColor: label.cor }}
              >
                {label.nome}
              </button>
            );
          })}
          {(!projectLabels || projectLabels.length === 0) && !novaLabel && (
            <p className="text-xs text-muted-foreground">Nenhuma label criada neste projeto ainda.</p>
          )}
          <button
            onClick={() => setNovaLabel((v) => !v)}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            + nova label
          </button>
        </div>
        {novaLabel && (
          <div className="mt-2 flex items-center gap-2">
            <input
              value={nomeLabel}
              onChange={(e) => setNomeLabel(e.target.value)}
              placeholder="Nome da label"
              className="h-7 flex-1 rounded border border-border bg-transparent px-1.5 text-xs focus:outline-none"
            />
            <div className="flex gap-1">
              {LABEL_PALETTE.map((cor) => (
                <button
                  key={cor}
                  onClick={() => setCorLabel(cor)}
                  className={cn("h-5 w-5 rounded-full", corLabel === cor && "ring-2 ring-primary ring-offset-1 ring-offset-card")}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
            <Button size="sm" disabled={!nomeLabel.trim() || criarLabel.isPending} onClick={() => criarLabel.mutate()}>
              Criar
            </Button>
          </div>
        )}
      </Section>

      {/* Tags */}
      <Section title="Tags">
        <div className="flex flex-wrap items-center gap-1.5">
          {missao.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="gap-1">
              <Tag className="h-2.5 w-2.5" />
              {tag}
              <button onClick={() => atualizarTags.mutate(missao.tags.filter((t) => t !== tag))}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          <input
            value={novaTag}
            onChange={(e) => setNovaTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && novaTag.trim()) {
                atualizarTags.mutate([...(missao.tags ?? []), novaTag.trim()]);
                setNovaTag("");
              }
            }}
            placeholder="+ tag"
            className="h-6 w-20 rounded border border-border bg-transparent px-1.5 text-xs focus:outline-none"
          />
        </div>
      </Section>

      {/* Responsáveis */}
      <Section title="Responsáveis">
        <div className="flex flex-wrap items-center gap-2">
          {missao.responsaveis?.map((r) => (
            <div key={r.user.id} className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs">
              <Avatar nome={r.user.nome} className="h-5 w-5 text-[9px]" />
              {r.user.nome}
            </div>
          ))}
          {podeGerenciar && (
            <Button size="sm" variant="outline" onClick={() => setMostrarAtribuir((v) => !v)}>
              <Users className="h-3.5 w-3.5" /> Atribuir
            </Button>
          )}
        </div>
        {mostrarAtribuir && podeGerenciar && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border p-2">
            {usuarios?.map((u: User) => {
              const marcado = missao.responsaveis?.some((r) => r.user.id === u.id);
              return (
                <label key={u.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={(e) => {
                      const atuais = missao.responsaveis?.map((r) => r.user.id) ?? [];
                      atribuir.mutate(e.target.checked ? [...atuais, u.id] : atuais.filter((id) => id !== u.id));
                    }}
                  />
                  {u.nome}
                </label>
              );
            })}
          </div>
        )}
      </Section>

      {/* Transições de status */}
      <Section title="Ações">
        <div className="flex flex-wrap gap-2">
          {missao.status === "PENDENTE" && (podeRevisar || ehResponsavel) && (
            <Button size="sm" onClick={() => runOrShowError(() => iniciar.mutateAsync())}>
              Iniciar missão
            </Button>
          )}
          {missao.status === "EM_ANDAMENTO" && (
            <Button size="sm" onClick={() => setMostrarEntrega((v) => !v)}>
              Fazer Entrega
            </Button>
          )}
        </div>
        {mostrarEntrega && (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              value={conteudoEntrega}
              onChange={(e) => setConteudoEntrega(e.target.value)}
              placeholder="Descreva o que está sendo entregue…"
              className="min-h-20 rounded-md border border-border bg-background p-2 text-sm focus:outline-none"
            />
            <Button size="sm" onClick={() => enviarEntrega.mutate()} disabled={enviarEntrega.isPending}>
              Enviar entrega
            </Button>
          </div>
        )}
        {podeAprovarRejeitar && (
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => revisar.mutate({ entregaId: ultimaEntrega.id, status: "APROVADO" })}>
              <Check className="h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => revisar.mutate({ entregaId: ultimaEntrega.id, status: "REJEITADO" })}
            >
              <X className="h-3.5 w-3.5" /> Rejeitar
            </Button>
          </div>
        )}
      </Section>

      {/* Checklist */}
      <Section title="Checklist">
        <div className="flex flex-col gap-1">
          {checklist?.map((item) => (
            <div key={item.id} className="group flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.concluido}
                onChange={(e) => toggleChecklist.mutate({ id: item.id, concluido: e.target.checked })}
              />
              <span className={cn("flex-1", item.concluido && "text-muted-foreground line-through")}>{item.texto}</span>
              <button
                onClick={() => removerChecklist.mutate(item.id)}
                className="opacity-0 text-muted-foreground hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="mt-1 flex gap-2">
            <input
              value={novoItemChecklist}
              onChange={(e) => setNovoItemChecklist(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && novoItemChecklist.trim()) addChecklist.mutate(novoItemChecklist.trim());
              }}
              placeholder="Novo item…"
              className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm focus:outline-none"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => novoItemChecklist.trim() && addChecklist.mutate(novoItemChecklist.trim())}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Section>

      {/* Histórico de Entregas + Revisões */}
      {entregas && entregas.length > 0 && (
        <Section title="Histórico de Entregas">
          <div className="flex flex-col gap-3">
            {entregas.map((entrega) => (
              <div key={entrega.id} className="rounded-md border border-border p-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{entrega.autor?.nome}</span>
                  <span>{formatDate(entrega.criado_em)}</span>
                </div>
                {entrega.conteudo && <p className="mt-1 text-sm">{entrega.conteudo}</p>}
                <Badge
                  variant={entrega.status === "APROVADA" ? "default" : entrega.status === "REJEITADA" ? "destructive" : "outline"}
                  className="mt-1.5"
                >
                  {entrega.status}
                </Badge>
                {entrega.revisoes?.map((rev) => (
                  <div key={rev.id} className="mt-1.5 border-t border-border pt-1.5 text-xs text-muted-foreground">
                    <span className="font-medium">{rev.revisor?.nome}</span> — {rev.status}
                    {rev.comentario && `: ${rev.comentario}`}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Comentários */}
      <Section title="Comentários">
        <div className="flex flex-col gap-2">
          {comentarios?.map((c) => (
            <div key={c.id} className="group flex items-start justify-between gap-2 text-sm">
              <div>
                <span className="font-medium">{c.autor?.nome}</span>{" "}
                <span className="text-xs text-muted-foreground">{formatDate(c.criado_em)}</span>
                <p>{c.texto}</p>
              </div>
              {(c.autor_id === user?.id || podeGerenciar) && (
                <button
                  onClick={() => removerComentario.mutate(c.id)}
                  className="opacity-0 text-muted-foreground hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <div className="mt-1 flex gap-2">
            <input
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && novoComentario.trim()) addComentario.mutate(novoComentario.trim());
              }}
              placeholder="Escrever um comentário…"
              className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm focus:outline-none"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => novoComentario.trim() && addComentario.mutate(novoComentario.trim())}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Section>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
