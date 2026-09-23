import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function AuditPage() {
  const { data } = useQuery({ queryKey: ["auditoria-global"], queryFn: () => api.auditoria.listar(50) });

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Auditoria Global</h1>
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {data?.items.map((log) => (
          <div key={log.id} className="flex items-start gap-3 px-4 py-3 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <div>
              <p>
                <span className="font-medium">{log.user?.nome ?? "Sistema"}</span> — {log.acao}{" "}
                <span className="text-muted-foreground">({log.entidade})</span>
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</p>
            </div>
          </div>
        ))}
        {(!data || data.items.length === 0) && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum registro de auditoria.</p>
        )}
      </div>
    </div>
  );
}
