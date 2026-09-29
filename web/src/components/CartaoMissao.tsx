import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { AlignLeft, Clock, MessageSquare, Paperclip, SquareCheck, Tag } from "lucide-react";
import { Avatar } from "./ui/avatar";
import type { Missao } from "@/lib/types";
import { cn, diasAtePrazo } from "@/lib/utils";

// Card de missão dos quadros (projeto e Minhas Missões), no modelo do Trello:
// capa colorida no topo, etiquetas, título e uma linha de selos (prazo,
// descrição, comentários, anexos, checklist) com os responsáveis à direita.
// Só desenha — quem usa liga o arrastar (useSortable/useDraggable) passando
// ref, style e listeners, como num <div>.

interface Props extends HTMLAttributes<HTMLDivElement> {
  missao: Missao;
  /// Nome do projeto sob o título (em Minhas Missões, como o "Meus cartões"
  /// do Trello mostra o quadro de origem).
  projeto?: string;
  devolvida?: boolean;
  /// Selo de status, para quadros em que a coluna não é o status.
  status?: ReactNode;
  /// Botões que aparecem ao passar o mouse (canto superior direito).
  acoesHover?: ReactNode;
  arrastando?: boolean;
  sobreposto?: boolean;
}

export const CartaoMissao = forwardRef<HTMLDivElement, Props>(function CartaoMissao(
  { missao, projeto, devolvida, status, acoesHover, arrastando, sobreposto, className, ...resto },
  ref,
) {
  const labels = missao.labels ?? [];
  const responsaveis = missao.responsaveis ?? [];
  const checklist = missao.checklist;
  const contagens = missao.contagens;
  const temSelos =
    !!status ||
    !!missao.prazo ||
    !!missao.descricao ||
    !!contagens?.comentarios ||
    !!contagens?.anexos ||
    !!checklist?.total ||
    missao.tags.length > 0 ||
    missao.valor_bounty != null ||
    responsaveis.length > 0;

  return (
    <div
      ref={ref}
      className={cn(
        "group/card relative cursor-pointer overflow-hidden rounded-lg bg-card text-card-foreground shadow-[0_1px_1px_rgba(0,0,0,0.3)] ring-1 ring-border hover:ring-primary/60 active:cursor-grabbing",
        arrastando && "opacity-40",
        sobreposto && "rotate-2 shadow-lg",
        className,
      )}
      {...resto}
    >
      {missao.cor_capa && <div className="h-8" style={{ backgroundColor: missao.cor_capa }} />}
      {acoesHover && (
        <div className="absolute right-1.5 top-1.5 opacity-0 group-hover/card:opacity-100">{acoesHover}</div>
      )}

      <div className="px-2.5 pb-2 pt-2">
        {(devolvida || labels.length > 0) && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {devolvida && (
              <span className="rounded bg-destructive px-1.5 text-[11px] font-semibold leading-4 text-destructive-foreground">
                Devolvida
              </span>
            )}
            {labels.map((l) => (
              <span
                key={l.label.id}
                className="rounded px-1.5 text-[11px] font-semibold leading-4 text-white"
                style={{ backgroundColor: l.label.cor }}
              >
                {l.label.nome}
              </span>
            ))}
          </div>
        )}

        <p className="break-words pr-5 text-sm leading-snug">{missao.titulo}</p>
        {projeto && <p className="mt-0.5 text-xs text-muted-foreground">{projeto}</p>}

        {temSelos && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            {status}
            {missao.prazo && <SeloPrazo prazo={missao.prazo} concluida={missao.status === "APROVADA"} />}
            {missao.descricao && (
              <span title="Esta missão tem descrição">
                <AlignLeft className="h-3.5 w-3.5" />
              </span>
            )}
            {!!contagens?.comentarios && (
              <span className="flex items-center gap-1" title="Comentários">
                <MessageSquare className="h-3.5 w-3.5" /> {contagens.comentarios}
              </span>
            )}
            {!!contagens?.anexos && (
              <span className="flex items-center gap-1" title="Anexos">
                <Paperclip className="h-3.5 w-3.5" /> {contagens.anexos}
              </span>
            )}
            {!!checklist?.total && (
              <span
                className={cn(
                  "flex items-center gap-1 rounded px-1",
                  checklist.concluidos === checklist.total && "bg-status-approved text-white",
                )}
                title="Checklist"
              >
                <SquareCheck className="h-3.5 w-3.5" /> {checklist.concluidos}/{checklist.total}
              </span>
            )}
            {missao.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-0.5">
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
            {missao.valor_bounty != null && (
              <span className="font-medium text-primary">
                R$ {missao.valor_bounty.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            )}
            {responsaveis.length > 0 && (
              <div className="ml-auto flex -space-x-1.5">
                {responsaveis.slice(0, 3).map((r) => (
                  <Avatar key={r.user.id} nome={r.user.nome} className="h-6 w-6 text-[10px] ring-2 ring-card" />
                ))}
                {responsaveis.length > 3 && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] ring-2 ring-card">
                    +{responsaveis.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// Prazo como no Trello: vermelho atrasado, amarelo vencendo (hoje/amanhã),
// verde quando a missão já foi aprovada.
function SeloPrazo({ prazo, concluida }: { prazo: string; concluida: boolean }) {
  const dias = diasAtePrazo(prazo);
  const data = new Date(prazo).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
  const [cor, titulo] = concluida
    ? ["bg-status-approved text-white", "Concluída"]
    : dias < 0
      ? ["bg-destructive text-destructive-foreground", "Atrasada"]
      : dias === 0
        ? ["bg-amber-400 text-black", "Vence hoje"]
        : dias === 1
          ? ["bg-amber-400 text-black", "Vence amanhã"]
          : ["", "Prazo"];
  return (
    <span className={cn("flex items-center gap-1 rounded px-1", cor)} title={titulo}>
      <Clock className="h-3.5 w-3.5" /> {data}
    </span>
  );
}
