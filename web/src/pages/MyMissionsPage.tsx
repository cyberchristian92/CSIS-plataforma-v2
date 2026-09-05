import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { Tag } from "lucide-react";
import { api } from "@/lib/api";
import type { Missao, MissaoStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { MissionDialog } from "@/components/MissionDialog";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/theme-constants";
import { cn } from "@/lib/utils";

// Kanban de status FIXO (Pendente/Em Andamento/Em Revisão/Aprovada) — distinto
// do board livre (BoardPage.tsx). Aqui a coluna É o `Missao.status`, e a
// única transição feita por arrastar é Pendente -> Em Andamento (equivalente
// a apertar "Iniciar"). As demais transições (Em Andamento -> Em Revisão via
// Entrega, Em Revisão -> Aprovada via Revisão) só acontecem por ações
// explícitas dentro do MissionDialog, porque exigem conteúdo (a entrega) ou
// checagem de Segregação de Funções (a revisão) — não fazem sentido como um
// simples "soltar o card aqui".
const COLUNAS: MissaoStatus[] = ["PENDENTE", "EM_ANDAMENTO", "EM_REVISAO", "APROVADA"];

export default function MyMissionsPage() {
  const qc = useQueryClient();
  const [missaoAberta, setMissaoAberta] = useState<string | null>(null);
  const [activeMissao, setActiveMissao] = useState<Missao | null>(null);

  const { data: missoes } = useQuery({ queryKey: ["missoes-minhas"], queryFn: api.missoes.minhas });

  const iniciar = useMutation({
    mutationFn: (id: string) => api.missoes.iniciar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes-minhas"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragStart(e: DragStartEvent) {
    setActiveMissao(missoes?.find((m) => m.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveMissao(null);
    const { active, over } = e;
    if (!over) return;
    const missao = missoes?.find((m) => m.id === active.id);
    if (!missao) return;
    const destino = over.id as MissaoStatus;
    if (missao.status === "PENDENTE" && destino === "EM_ANDAMENTO") {
      iniciar.mutate(missao.id);
    }
    // Qualquer outra combinação de origem/destino não corresponde a uma
    // transição válida por arrastar — o card simplesmente volta pro lugar.
  }

  return (
    <div className="flex h-full flex-col p-6">
      <h1 className="mb-4 text-lg font-semibold">Minhas Missões</h1>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 items-start gap-4 overflow-x-auto pb-4">
          {COLUNAS.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              missoes={(missoes ?? []).filter((m) => m.status === status)}
              onCardClick={setMissaoAberta}
            />
          ))}
        </div>
        <DragOverlay>{activeMissao && <MissaoCard missao={activeMissao} onClick={() => {}} overlay />}</DragOverlay>
      </DndContext>

      <MissionDialog missaoId={missaoAberta} onClose={() => setMissaoAberta(null)} />
    </div>
  );
}

function StatusColumn({
  status,
  missoes,
  onCardClick,
}: {
  status: MissaoStatus;
  missoes: Missao[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/40 p-2",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
        <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
        <span className="text-xs text-muted-foreground">{missoes.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {missoes.map((missao) => (
          <MissaoCard key={missao.id} missao={missao} onClick={() => onCardClick(missao.id)} />
        ))}
        {missoes.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Nada por aqui.</p>}
      </div>
    </div>
  );
}

function MissaoCard({ missao, onClick, overlay }: { missao: Missao; onClick: () => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: missao.id });
  const style = { transform: CSS.Translate.toString(transform), borderLeft: missao.cor_capa ? `3px solid ${missao.cor_capa}` : undefined };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-lg",
      )}
    >
      <p className="text-sm font-medium leading-snug">{missao.titulo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {missao.labels?.map((l) => (
          <span key={l.label.id} className="h-2 w-6 rounded-full" style={{ backgroundColor: l.label.cor }} title={l.label.nome} />
        ))}
        {missao.tags?.map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1">
            <Tag className="h-2.5 w-2.5" />
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
