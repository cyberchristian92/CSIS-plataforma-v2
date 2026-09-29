import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { MinhaMissao, MissaoStatus } from "@/lib/types";
import { CartaoMissao } from "@/components/CartaoMissao";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/theme-constants";
import { cn } from "@/lib/utils";
import { ehDevolvida } from "./comum";

// Quadro de status de Minhas Missões — livre: dá para soltar o card em
// qualquer coluna. Quem decide o que cada movimento faz é a página (iniciar,
// entregar, autoaprovar, voltar de etapa, reabrir); tudo fica na auditoria.
// Distinto do board do projeto (BoardPage.tsx), onde a coluna não é o status.
const COLUNAS: MissaoStatus[] = ["PENDENTE", "EM_ANDAMENTO", "EM_REVISAO", "APROVADA"];

// Missão antiga com status REJEITADA mora junto das que voltaram para correção.
function colunaDe(m: MinhaMissao): MissaoStatus {
  return m.status === "REJEITADA" ? "EM_ANDAMENTO" : m.status;
}

export function QuadroMissoes({
  missoes,
  onAbrir,
  onMover,
}: {
  missoes: MinhaMissao[];
  onAbrir: (id: string) => void;
  onMover: (missao: MinhaMissao, destino: MissaoStatus) => void;
}) {
  const [arrastando, setArrastando] = useState<MinhaMissao | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragStart(e: DragStartEvent) {
    setArrastando(missoes.find((m) => m.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setArrastando(null);
    const missao = missoes.find((m) => m.id === e.active.id);
    if (!missao || !e.over) return;
    const destino = e.over.id as MissaoStatus;
    if (colunaDe(missao) !== destino) onMover(missao, destino);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex flex-1 items-start gap-3 overflow-x-auto pb-4">
        {COLUNAS.map((status) => {
          const daColuna = missoes.filter((m) => colunaDe(m) === status);
          // Devolvidas primeiro: alguém está esperando a correção.
          if (status === "EM_ANDAMENTO") daColuna.sort((a, b) => Number(ehDevolvida(b)) - Number(ehDevolvida(a)));
          return <Coluna key={status} status={status} missoes={daColuna} onAbrir={onAbrir} />;
        })}
      </div>
      <DragOverlay>{arrastando && <Cartao missao={arrastando} onAbrir={onAbrir} sobreposto />}</DragOverlay>
    </DndContext>
  );
}

function Coluna({
  status,
  missoes,
  onAbrir,
}: {
  status: MissaoStatus;
  missoes: MinhaMissao[];
  onAbrir: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Lista no formato do Trello: largura fixa, fundo próprio, cantos arredondados.
        "flex w-[272px] shrink-0 flex-col rounded-xl bg-muted/60 p-2",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-1.5 pt-0.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
        <span className="text-sm font-semibold">{STATUS_LABELS[status]}</span>
        <span className="text-xs text-muted-foreground">{missoes.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {missoes.map((m) => (
          <Cartao key={m.id} missao={m} onAbrir={onAbrir} />
        ))}
        {missoes.length === 0 && <p className="px-1.5 py-2 text-xs text-muted-foreground">Nada por aqui.</p>}
      </div>
    </div>
  );
}

function Cartao({
  missao,
  onAbrir,
  sobreposto,
}: {
  missao: MinhaMissao;
  onAbrir: (id: string) => void;
  sobreposto?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: missao.id });
  return (
    <CartaoMissao
      ref={sobreposto ? undefined : setNodeRef}
      style={sobreposto ? undefined : { transform: CSS.Translate.toString(transform) }}
      {...(sobreposto ? {} : { ...attributes, ...listeners })}
      onClick={() => onAbrir(missao.id)}
      missao={missao}
      projeto={missao.projeto.nome}
      devolvida={ehDevolvida(missao)}
      arrastando={isDragging}
      sobreposto={sobreposto}
    />
  );
}
