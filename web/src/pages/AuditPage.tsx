import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { LogAuditoria } from "@/lib/types";

// Eventos que precisam saltar aos olhos numa auditoria pericial: a exceção à
// revisão por pares (TCC v4, 8.3) e a detecção de arquivo adulterado.
function destaque(log: LogAuditoria): { classe: string; detalhe: string | null } | null {
  if (log.acao === "AUTOAPROVAR") {
    const motivo = log.dados_novos?.justificativa;
    return {
      classe: "border-l-4 border-l-status-in-review bg-status-in-review/10 [&_.detalhe]:text-status-in-review",
      detalhe: `Autoaprovação — sem revisão por outra pessoa${typeof motivo === "string" ? `. Justificativa: “${motivo}”` : ""}`,
    };
  }
  if (log.acao === "FALHA_INTEGRIDADE") {
    return {
      classe: "border-l-4 border-l-status-rejected bg-status-rejected/10 [&_.detalhe]:text-status-rejected",
      detalhe: "Arquivo em disco não confere com o hash registrado no envio — download bloqueado.",
    };
  }
  return null;
}

export default function AuditPage() {
  const { data } = useQuery({ queryKey: ["auditoria-global"], queryFn: () => api.auditoria.listar(50) });

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Auditoria Global</h1>
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {data?.items.map((log) => {
          const marcado = destaque(log);
          return (
          <div key={log.id} className={cn("flex items-start gap-3 px-4 py-3 text-sm", marcado?.classe)}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <div>
              <p>
                <span className="font-medium">{log.user?.nome ?? "Sistema"}</span> — {log.acao}{" "}
                <span className="text-muted-foreground">({log.entidade})</span>
              </p>
              {marcado?.detalhe && <p className="detalhe mt-0.5 text-xs font-medium">{marcado.detalhe}</p>}
              <p className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</p>
            </div>
          </div>
          );
        })}
        {(!data || data.items.length === 0) && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum registro de auditoria.</p>
        )}
      </div>
    </div>
  );
}
