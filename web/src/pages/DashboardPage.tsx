import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ClipboardList, Clock, Folder, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { Missao, Projeto } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "ATIVO",
  ARQUIVADO: "ARQUIVADO",
  CONCLUIDO: "CONCLUÍDO",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const podeVerAuditoria = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";

  const { data: projetos } = useQuery({ queryKey: ["projetos-todos"], queryFn: api.projetos.listarTodos });
  const { data: minhasMissoes } = useQuery({ queryKey: ["missoes-minhas"], queryFn: api.missoes.minhas });
  const { data: auditoria } = useQuery({
    queryKey: ["auditoria-recente"],
    queryFn: () => api.auditoria.listar(6),
    enabled: podeVerAuditoria,
  });

  const { data: todasMissoes } = useQuery({
    queryKey: ["missoes-todas", projetos?.map((p) => p.id)],
    queryFn: async () => {
      const listas = await Promise.all((projetos ?? []).map((p) => api.missoes.listarPorProjeto(p.id)));
      return listas.flat();
    },
    enabled: !!projetos,
  });

  const projetosAtivos = projetos?.filter((p) => p.status === "ATIVO") ?? [];
  const projetosAtrasados = projetosAtivos.filter((p) => p.prazo && new Date(p.prazo) < new Date());
  const missoesPendentes = (todasMissoes ?? []).filter((m: Missao) => m.status === "PENDENTE");

  const ultimosProjetos = [...(projetos ?? [])].slice(-5).reverse();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Painel Geral</h1>
      <p className="mb-6 text-muted-foreground">
        Olá, {user?.nome} — visão geral da operação
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Folder} label="Projetos Ativos" value={projetosAtivos.length} tone="primary" />
        <StatCard icon={AlertTriangle} label="Projetos Atrasados" value={projetosAtrasados.length} tone="destructive" />
        <StatCard icon={Clock} label="Missões Pendentes" value={missoesPendentes.length} tone="amber" />
        <StatCard icon={ClipboardList} label="Minhas Missões" value={minhasMissoes?.length ?? 0} tone="primary" />
      </div>

      <div className={`mt-6 grid grid-cols-1 gap-4 ${podeVerAuditoria ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-base font-semibold">Últimos Projetos</h2>
            <div className="flex flex-col divide-y divide-border">
              {ultimosProjetos.map((p: Projeto) => (
                <Link
                  key={p.id}
                  to={`/projetos/${p.id}`}
                  className="group flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="truncate group-hover:text-primary">{p.nome}</span>
                  </span>
                  <Badge
                    variant={p.status === "ATIVO" ? "default" : p.status === "CONCLUIDO" ? "secondary" : "outline"}
                    className="shrink-0"
                  >
                    {STATUS_LABEL[p.status]}
                  </Badge>
                </Link>
              ))}
              {ultimosProjetos.length === 0 && (
                <p className="py-2.5 text-sm text-muted-foreground">Nenhum projeto ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {podeVerAuditoria && (
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-base font-semibold">Auditoria (Recentes)</h2>
              <div className="flex flex-col gap-3">
                {auditoria?.items.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 text-sm">
                    <Avatar nome={log.user?.nome ?? "Sistema"} className="mt-0.5 h-6 w-6 text-[9px]" />
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="font-medium">{log.user?.nome ?? "Sistema"}</span> — {log.acao}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</p>
                    </div>
                  </div>
                ))}
                {(!auditoria || auditoria.items.length === 0) && (
                  <p className="text-sm text-muted-foreground">Sem atividade registrada.</p>
                )}
              </div>
              <Link to="/auditoria" className="mt-3 inline-block text-sm text-primary hover:underline">
                Ver auditoria completa
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

const TONE_STYLES: Record<string, { texto: string; chip: string }> = {
  primary: { texto: "text-primary", chip: "bg-primary/10 text-primary" },
  destructive: { texto: "text-destructive", chip: "bg-destructive/10 text-destructive" },
  amber: { texto: "text-amber-400", chip: "bg-amber-400/10 text-amber-400" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: keyof typeof TONE_STYLES;
}) {
  const { texto, chip } = TONE_STYLES[tone];
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-3xl font-bold", texto)}>{value}</p>
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", chip)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
