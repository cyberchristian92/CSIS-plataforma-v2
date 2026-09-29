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

// Kanban de status FIXO (Pendente/Em Andamento/Em Revisão/Aprovada) — distinto
// do board livre (BoardPage.tsx). Aqui a coluna É o `Missao.status`:
// - Pendente → Em Andamento por arrastar = "Iniciar".
// - Em Andamento → Em Revisão por arrastar abre a entrega (texto + anexos):
//   a revisão só existe com o que foi entregue.
// - Aprovar/rejeitar é do revisor, e nada volta de etapa pelo quadro — em vez
//   de o card voltar calado, a tela explica o porquê.
const COLUNAS: MissaoStatus[] = ["PENDENTE", "EM_ANDAMENTO", "EM_REVISAO", "APROVADA"];

// Missão antiga com status REJEITADA mora junto das que voltaram para correção.
function colunaDe(m: MinhaMissao): MissaoStatus {
  return m.status === "REJEITADA" ? "EM_ANDAMENTO" : m.status;
}

function motivoMovimentoInvalido(origem: MissaoStatus, destino: MissaoStatus): string {
  if (destino === "APROVADA") return "Quem aprova é o revisor, pela Fila de Revisão.";
  if (origem === "PENDENTE" && destino === "EM_REVISAO") return "Inicie a missão antes de entregar.";
  if (COLUNAS.indexOf(destino) < COLUNAS.indexOf(origem)) {
    return "Uma missão não volta de etapa pelo quadro. Se a entrega precisar de correção, o revisor a devolve.";
  }
  return "Esse movimento não muda o status da missão.";
}

export function QuadroMissoes({
  missoes,
  onAbrir,
  onIniciar,
  onEntregar,
  onAviso,
}: {
  missoes: MinhaMissao[];
  onAbrir: (id: string) => void;
  onIniciar: (id: string) => void;
  onEntregar: (m: MinhaMissao) => void;
  onAviso: (mensagem: string) => void;
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
    const origem = colunaDe(missao);
    const destino = e.over.id as MissaoStatus;
    if (origem === destino) return;
    if (missao.status === "PENDENTE" && destino === "EM_ANDAMENTO") return onIniciar(missao.id);
    if (missao.status === "EM_ANDAMENTO" && destino === "EM_REVISAO") return onEntregar(missao);
    onAviso(motivoMovimentoInvalido(origem, destino));
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
