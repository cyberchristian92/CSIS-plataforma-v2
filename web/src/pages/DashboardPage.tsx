import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Missao, Projeto } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "ATIVO",
  ARQUIVADO: "ARQUIVADO",
  CONCLUIDO: "CONCLUÍDO",
};

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: projetos } = useQuery({ queryKey: ["projetos-todos"], queryFn: api.projetos.listarTodos });
  const { data: minhasMissoes } = useQuery({ queryKey: ["missoes-minhas"], queryFn: api.missoes.minhas });
  const { data: auditoria } = useQuery({ queryKey: ["auditoria-recente"], queryFn: () => api.auditoria.listar(6) });

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
        <StatCard label="Projetos Ativos" value={projetosAtivos.length} color="text-primary" />
        <StatCard label="Projetos Atrasados" value={projetosAtrasados.length} color="text-destructive" />
        <StatCard label="Missões Pendentes" value={missoesPendentes.length} color="text-amber-400" />
        <StatCard label="Minhas Missões" value={minhasMissoes?.length ?? 0} color="text-primary" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-base font-semibold">Últimos Projetos</h2>
            <div className="flex flex-col divide-y divide-border">
              {ultimosProjetos.map((p: Projeto) => (
                <Link
                  key={p.id}
                  to={`/projetos/${p.id}`}
                  className="flex items-center justify-between py-2.5 text-sm hover:text-primary"
                >
                  <span>{p.nome}</span>
                  <span className="text-xs font-medium text-primary">{STATUS_LABEL[p.status]}</span>
                </Link>
              ))}
              {ultimosProjetos.length === 0 && (
                <p className="py-2.5 text-sm text-muted-foreground">Nenhum projeto ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-base font-semibold">Auditoria (Recentes)</h2>
            <div className="flex flex-col gap-3">
              {auditoria?.items.map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p>
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
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
