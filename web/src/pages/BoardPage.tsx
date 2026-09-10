import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Pencil, Plus, Tag } from "lucide-react";
import { api } from "@/lib/api";
import type { Coluna, Missao } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePromptDialog } from "@/components/ui/prompt-dialog";
import { cn, formatDateOnly } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { MissionDialog } from "@/components/MissionDialog";

// Board Kanban livre — tão amplo quanto o Trello: colunas e cards podem ser
// reorganizados sem restrição visual. Mover um card aqui só atualiza a
// posição organizacional (coluna_id/ordem); nunca aciona aprovação/reprovação
// de uma Entrega — essas transições continuam sendo ações explícitas em outro
// lugar da interface, validadas no servidor (ver backend/prisma/schema.prisma
// e o Cap. 4 do TCC sobre segregação de funções).

export default function BoardPage() {
  const { projetoId = "" } = useParams();
  const qc = useQueryClient();
  const [activeMissao, setActiveMissao] = useState<Missao | null>(null);
  const [colunaEditando, setColunaEditando] = useState<Coluna | null>(null);
  const [missaoAberta, setMissaoAberta] = useState<string | null>(null);
  const { user } = useAuth();
  const podeGerenciarMissoes = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";
  const { ask, dialog: promptDialog } = usePromptDialog();

  const { data: colunas } = useQuery({
    queryKey: ["colunas", projetoId],
    queryFn: () => api.colunas.listarPorProjeto(projetoId),
    enabled: !!projetoId,
  });

  const { data: missoes } = useQuery({
    queryKey: ["missoes", projetoId],
    queryFn: () => api.missoes.listarPorProjeto(projetoId),
    enabled: !!projetoId,
  });

  const mover = useMutation({
    mutationFn: ({ id, colunaId, ordem }: { id: string; colunaId: string | null; ordem: number }) =>
      api.missoes.mover(id, colunaId, ordem),
    onMutate: async ({ id, colunaId, ordem }) => {
      await qc.cancelQueries({ queryKey: ["missoes", projetoId] });
      const anteriores = qc.getQueryData<Missao[]>(["missoes", projetoId]);
      qc.setQueryData<Missao[]>(["missoes", projetoId], (old) =>
        old?.map((m) => (m.id === id ? { ...m, coluna_id: colunaId, ordem } : m)),
      );
      return { anteriores };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.anteriores) qc.setQueryData(["missoes", projetoId], ctx.anteriores);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["missoes", projetoId] }),
  });

  const criarColuna = useMutation({
    mutationFn: async () => {
      const nome = await ask("Nome da coluna");
      if (!nome) return Promise.reject(new Error("cancelado"));
      return api.colunas.criar(projetoId, nome);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colunas", projetoId] }),
  });

  const criarMissao = useMutation({
    mutationFn: async (colunaId?: string) => {
      const titulo = await ask("Título da missão");
      if (!titulo) return Promise.reject(new Error("cancelado"));
      return api.missoes.criar(projetoId, { titulo, colunaId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes", projetoId] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragStart(e: DragStartEvent) {
    const m = missoes?.find((m) => m.id === e.active.id);
    setActiveMissao(m ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveMissao(null);
    const { active, over } = e;
    if (!over || !missoes) return;

    const missao = missoes.find((m) => m.id === active.id);
    if (!missao) return;

    // over.id é ou o id de uma coluna (drop numa área vazia) ou o id de outro card
    const overColuna = colunas?.find((c) => c.id === over.id);
    const overMissao = missoes.find((m) => m.id === over.id);

    const destinoColunaId = overColuna ? overColuna.id : (overMissao?.coluna_id ?? null);
    const irmaos = missoes
      .filter((m) => m.coluna_id === destinoColunaId && m.id !== missao.id)
      .sort((a, b) => a.ordem - b.ordem);

    let novaOrdem = irmaos.length;
    if (overMissao) {
      const idx = irmaos.findIndex((m) => m.id === overMissao.id);
      novaOrdem = idx === -1 ? irmaos.length : idx;
    }

    if (missao.coluna_id === destinoColunaId && missao.ordem === novaOrdem) return;
    mover.mutate({ id: missao.id, colunaId: destinoColunaId, ordem: novaOrdem });
  }

  const semColuna = missoes?.filter((m) => !m.coluna_id) ?? [];

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => criarColuna.mutate()}>
          <Plus className="h-4 w-4" /> Nova coluna
        </Button>
        {podeGerenciarMissoes && (
          <Button onClick={() => criarMissao.mutate(colunas?.[0]?.id)}>
            <Plus className="h-4 w-4" /> Nova Missão
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 items-start gap-4 overflow-x-auto pb-4">
          {colunas?.map((coluna) => (
            <ColunaColumn
              key={coluna.id}
              coluna={coluna}
              missoes={(missoes ?? []).filter((m) => m.coluna_id === coluna.id).sort((a, b) => a.ordem - b.ordem)}
              onNovaMissao={podeGerenciarMissoes ? () => criarMissao.mutate(coluna.id) : undefined}
              onEditar={() => setColunaEditando(coluna)}
              onAbrirMissao={setMissaoAberta}
            />
          ))}

          {semColuna.length > 0 && (
            <ColunaColumn
              coluna={{ id: "__sem_coluna__", nome: "Sem coluna", ordem: -1, limite_wip: null, projeto_id: projetoId }}
              missoes={semColuna}
              onNovaMissao={undefined}
              onEditar={() => {}}
              onAbrirMissao={setMissaoAberta}
            />
          )}
        </div>

        <DragOverlay>{activeMissao && <MissaoCard missao={activeMissao} overlay />}</DragOverlay>
      </DndContext>

      <EditarColunaDialog coluna={colunaEditando} onClose={() => setColunaEditando(null)} />
      <MissionDialog missaoId={missaoAberta} onClose={() => setMissaoAberta(null)} />
      {promptDialog}
    </div>
  );
}

function ColunaColumn({
  coluna,
  missoes,
  onNovaMissao,
  onEditar,
  onAbrirMissao,
}: {
  coluna: Coluna;
  missoes: Missao[];
  onNovaMissao: (() => void) | undefined;
  onEditar: () => void;
  onAbrirMissao: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const acimaDoLimite = !!coluna.limite_wip && missoes.length > coluna.limite_wip;
  const editavel = coluna.id !== "__sem_coluna__";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/40 p-2",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{coluna.nome}</span>
          <span className={cn("text-xs text-muted-foreground", acimaDoLimite && "font-semibold text-destructive")}>
            {missoes.length}
            {coluna.limite_wip ? `/${coluna.limite_wip}` : ""}
          </span>
        </div>
        {editavel && (
          <button onClick={onEditar} className="text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <SortableContext items={missoes.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {missoes.map((missao) => (
            <MissaoCard key={missao.id} missao={missao} onAbrir={() => onAbrirMissao(missao.id)} />
          ))}
        </div>
      </SortableContext>

      {onNovaMissao && (
        <button
          onClick={onNovaMissao}
          className="mt-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar missão
        </button>
      )}
    </div>
  );
}

function EditarColunaDialog({ coluna, onClose }: { coluna: Coluna | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [limiteWip, setLimiteWip] = useState("");

  useEffect(() => {
    if (coluna) {
      setNome(coluna.nome);
      setLimiteWip(coluna.limite_wip?.toString() ?? "");
    }
  }, [coluna]);

  const salvar = useMutation({
    mutationFn: () =>
      api.colunas.atualizar(coluna!.id, { nome, limiteWip: limiteWip.trim() ? Number(limiteWip) : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colunas", coluna?.projeto_id] });
      onClose();
    },
  });

  const remover = useMutation({
    mutationFn: () => api.colunas.remover(coluna!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colunas", coluna?.projeto_id] });
      qc.invalidateQueries({ queryKey: ["missoes", coluna?.projeto_id] });
      onClose();
    },
  });

  return (
    <Dialog open={!!coluna} onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold">Editar coluna</h2>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Limite de WIP (vazio = sem limite)</label>
          <Input type="number" min={1} value={limiteWip} onChange={(e) => setLimiteWip(e.target.value)} />
        </div>
        <div className="mt-2 flex justify-between">
          <Button variant="destructive" size="sm" onClick={() => remover.mutate()}>
            Excluir coluna
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={!nome.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

const STATUS_LABEL: Record<Missao["status"], string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  EM_REVISAO: "Em revisão",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
};

const STATUS_VARIANT: Record<Missao["status"], "secondary" | "outline" | "default" | "destructive"> = {
  PENDENTE: "outline",
  EM_ANDAMENTO: "secondary",
  EM_REVISAO: "default",
  APROVADA: "secondary",
  REJEITADA: "destructive",
};

function MissaoCard({ missao, overlay, onAbrir }: { missao: Missao; overlay?: boolean; onAbrir?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: missao.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeft: missao.cor_capa ? `3px solid ${missao.cor_capa}` : undefined,
  };

  const atrasada =
    !!missao.prazo && new Date(missao.prazo) < new Date() && !["APROVADA", "REJEITADA"].includes(missao.status);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={overlay ? undefined : onAbrir}
      className={cn(
        "cursor-grab rounded-md border border-border bg-card p-2.5 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-lg",
      )}
    >
      {missao.labels && missao.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {missao.labels.map((l) => (
            <span
              key={l.label.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white/90"
              style={{ backgroundColor: l.label.cor }}
            >
              {l.label.nome}
            </span>
          ))}
        </div>
      )}
      <p className="text-sm font-medium leading-snug">{missao.titulo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={STATUS_VARIANT[missao.status]}>{STATUS_LABEL[missao.status]}</Badge>
        {missao.prazo && (
          <Badge variant="outline" className={cn("gap-1", atrasada && "border-destructive text-destructive")}>
            <Calendar className="h-2.5 w-2.5" /> {formatDateOnly(missao.prazo)}
          </Badge>
        )}
        {missao.tags?.map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1">
            <Tag className="h-2.5 w-2.5" />
            {tag}
          </Badge>
        ))}
      </div>
      {missao.valor_bounty != null && (
        <p className="mt-1.5 text-xs font-medium text-primary">
          R$ {missao.valor_bounty.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}
