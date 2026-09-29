import { useState, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
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
import { ListChecks, Tag } from "lucide-react";
import type { MinhaMissao, MissaoStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/theme-constants";
import { cn } from "@/lib/utils";
import { AcaoMissao, AvisoDevolvida, Prazo, ehDevolvida, prazoConta } from "./comum";

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

// Botões e links dentro do card não devem iniciar o arrasto nem abrir a missão.
function naoPropagar(e: SyntheticEvent) {
  e.stopPropagation();
}

export function QuadroMissoes({
  missoes,
  onAbrir,
  onIniciar,
  iniciandoId,
  onEntregar,
  onAviso,
}: {
  missoes: MinhaMissao[];
  onAbrir: (id: string) => void;
  onIniciar: (id: string) => void;
  iniciandoId: string | null;
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

  const acoes = { onAbrir, onIniciar, iniciandoId, onEntregar };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-[repeat(4,minmax(13rem,1fr))] items-start gap-3 overflow-x-auto pb-4">
        {COLUNAS.map((status) => {
          const daColuna = missoes.filter((m) => colunaDe(m) === status);
          // Devolvidas primeiro: alguém está esperando a correção.
          if (status === "EM_ANDAMENTO") daColuna.sort((a, b) => Number(ehDevolvida(b)) - Number(ehDevolvida(a)));
          return <Coluna key={status} status={status} missoes={daColuna} {...acoes} />;
        })}
      </div>
      <DragOverlay>{arrastando && <Cartao missao={arrastando} {...acoes} sobreposto />}</DragOverlay>
    </DndContext>
  );
}

interface AcoesCartao {
  onAbrir: (id: string) => void;
  onIniciar: (id: string) => void;
  iniciandoId: string | null;
  onEntregar: (m: MinhaMissao) => void;
}

function Coluna({ status, missoes, ...acoes }: { status: MissaoStatus; missoes: MinhaMissao[] } & AcoesCartao) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 flex-col rounded-lg border border-border bg-muted/40 p-2",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
        <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
        <span className="text-xs text-muted-foreground">{missoes.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {missoes.map((m) => (
          <Cartao key={m.id} missao={m} {...acoes} />
        ))}
        {missoes.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Nada por aqui.</p>}
      </div>
    </div>
  );
}

function Cartao({
  missao,
  onAbrir,
  onIniciar,
  iniciandoId,
  onEntregar,
  sobreposto,
}: { missao: MinhaMissao; sobreposto?: boolean } & AcoesCartao) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: missao.id });
  const devolvida = ehDevolvida(missao);
  const estilo = {
    transform: CSS.Translate.toString(transform),
    borderLeft: missao.cor_capa ? `3px solid ${missao.cor_capa}` : undefined,
  };

  return (
    <div
      ref={sobreposto ? undefined : setNodeRef}
      style={sobreposto ? { borderLeft: estilo.borderLeft } : estilo}
      {...(sobreposto ? {} : { ...attributes, ...listeners })}
      onClick={() => onAbrir(missao.id)}
      className={cn(
        "cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-sm active:cursor-grabbing",
        devolvida && "border-destructive/60",
        isDragging && "opacity-40",
        sobreposto && "rotate-2 shadow-lg",
      )}
    >
      {devolvida && (
        <span className="mb-1 inline-block text-[11px] font-medium uppercase tracking-wide text-destructive">Devolvida</span>
      )}
      <p className="text-sm font-medium leading-snug">{missao.titulo}</p>
      <Link
        to={`/projetos/${missao.projeto.id}/board`}
        onClick={naoPropagar}
        onPointerDown={naoPropagar}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {missao.projeto.nome}
      </Link>

      {((missao.labels?.length ?? 0) > 0 || missao.tags.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {missao.labels?.map((l) => (
            <span key={l.label.id} className="h-2 w-6 rounded-full" style={{ backgroundColor: l.label.cor }} title={l.label.nome} />
          ))}
          {missao.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="gap-1">
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <Prazo prazo={missao.prazo} aberta={prazoConta(missao)} />
        {missao.checklist.total > 0 && (
          <span
            className="flex items-center gap-1 font-mono text-xs text-muted-foreground"
            title={`${missao.checklist.concluidos} de ${missao.checklist.total} itens do checklist`}
          >
            <ListChecks className="h-3 w-3" />
            {missao.checklist.concluidos}/{missao.checklist.total}
          </span>
        )}
      </div>

      <AvisoDevolvida missao={missao} className="mt-2 line-clamp-3 border-l-2 border-destructive pl-2" />

      <div className="mt-2" onClick={naoPropagar} onPointerDown={naoPropagar}>
        <AcaoMissao
          missao={missao}
          onIniciar={() => onIniciar(missao.id)}
          iniciando={iniciandoId === missao.id}
          onEntregar={() => onEntregar(missao)}
        />
      </div>
    </div>
  );
}
