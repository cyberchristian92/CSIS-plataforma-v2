import type { SituacaoUsuario } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROTULOS: Record<SituacaoUsuario, { texto: string; classe: string }> = {
  ATIVO: { texto: "Ativo", classe: "bg-status-approved/15 text-status-approved" },
  CONVIDADO: { texto: "Convite pendente", classe: "bg-status-pending/15 text-status-pending" },
  AGUARDANDO_EMAIL: { texto: "Aguardando e-mail", classe: "bg-status-pending/15 text-status-pending" },
  // Âmbar: depende de uma ação da equipe.
  PENDENTE: { texto: "Aguardando aprovação", classe: "bg-status-in-review/15 text-status-in-review" },
  RECUSADO: { texto: "Recusado", classe: "bg-status-rejected/15 text-status-rejected" },
  DESATIVADO: { texto: "Desativado", classe: "bg-status-archived/15 text-status-archived" },
};

export function SituacaoBadge({ situacao }: { situacao: SituacaoUsuario }) {
  const { texto, classe } = ROTULOS[situacao] ?? { texto: situacao, classe: "bg-secondary" };
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", classe)}>{texto}</span>;
}
