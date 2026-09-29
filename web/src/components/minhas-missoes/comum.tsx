import { Button } from "@/components/ui/button";
import type { MinhaMissao } from "@/lib/types";
import { cn, diasAtePrazo, formatDate, formatDateOnly } from "@/lib/utils";

// Peças usadas pelas duas visões de "Minhas Missões" (quadro e lista).

/// A última entrega foi rejeitada e a missão voltou para o especialista
/// corrigir. (REJEITADA como status da missão só existe em dados antigos.)
export function ehDevolvida(m: MinhaMissao): boolean {
  return m.status === "REJEITADA" || (m.status === "EM_ANDAMENTO" && m.ultima_entrega?.status === "REJEITADA");
}

/// Prazo só pesa enquanto o trabalho está com a pessoa.
export function prazoConta(m: MinhaMissao): boolean {
  return m.status === "PENDENTE" || m.status === "EM_ANDAMENTO" || m.status === "REJEITADA";
}

export function Prazo({ prazo, aberta }: { prazo: string | null; aberta: boolean }) {
  if (!prazo) return <span className="text-xs text-muted-foreground">Sem prazo</span>;
  const data = formatDateOnly(prazo);
  if (!aberta) return <span className="text-xs text-muted-foreground">{data}</span>;
  const dias = diasAtePrazo(prazo);
  if (dias < 0) return <span className="text-xs font-medium text-destructive">Atrasada · {data}</span>;
  if (dias === 0) return <span className="text-xs font-medium text-status-in-review">Vence hoje</span>;
  if (dias <= 2) {
    return (
      <span className="text-xs font-medium text-status-in-review">
        Vence em {dias} {dias === 1 ? "dia" : "dias"}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{data}</span>;
}

export function Progresso({ total, concluidos }: { total: number; concluidos: number }) {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div title={`${concluidos} de ${total} itens do checklist`}>
      <span className="font-mono text-xs">
        {concluidos}/{total}
      </span>
      <div className="mt-1 h-0.5 w-16 bg-border">
        <div className="h-full bg-primary" style={{ width: `${(concluidos / total) * 100}%` }} />
      </div>
    </div>
  );
}

/// "Devolvida por Ana em 29/09/2026: faltou o hash…"
export function AvisoDevolvida({ missao, className }: { missao: MinhaMissao; className?: string }) {
  const revisao = missao.ultima_entrega?.revisao;
  if (!ehDevolvida(missao) || !revisao) return null;
  return (
    <p className={cn("text-xs", className)}>
      <span className="text-destructive">
        Devolvida por {revisao.revisor.nome} em {formatDate(revisao.criado_em)}:
      </span>{" "}
      {revisao.comentario ?? "sem comentário"}
    </p>
  );
}

/// A próxima coisa que a pessoa pode fazer com a missão sem abri-la.
export function AcaoMissao({
  missao,
  onIniciar,
  iniciando,
  onEntregar,
}: {
  missao: MinhaMissao;
  onIniciar: () => void;
  iniciando: boolean;
  onEntregar: () => void;
}) {
  if (missao.status === "PENDENTE") {
    return (
      <Button size="sm" variant="outline" onClick={onIniciar} disabled={iniciando}>
        {iniciando ? "Iniciando…" : "Iniciar"}
      </Button>
    );
  }
  if (missao.status === "EM_ANDAMENTO") {
    return (
      <Button size="sm" onClick={onEntregar}>
        {ehDevolvida(missao) ? "Entregar correção" : "Entregar"}
      </Button>
    );
  }
  if (missao.status === "EM_REVISAO" && missao.ultima_entrega) {
    return <span className="text-xs text-muted-foreground">Entregue em {formatDate(missao.ultima_entrega.criado_em)}</span>;
  }
  if (missao.status === "APROVADA" && missao.ultima_entrega?.revisao) {
    return (
      <span className="text-xs text-muted-foreground">
        Aprovada em {formatDate(missao.ultima_entrega.revisao.criado_em)}
      </span>
    );
  }
  return null;
}
