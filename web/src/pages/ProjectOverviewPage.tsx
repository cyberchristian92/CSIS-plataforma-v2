import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default function ProjectOverviewPage() {
  const { projetoId = "" } = useParams();
  const { data: projeto } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: () => api.projetos.buscar(projetoId),
    enabled: !!projetoId,
  });
  const { data: missoes } = useQuery({
    queryKey: ["missoes", projetoId],
    queryFn: () => api.missoes.listarPorProjeto(projetoId),
    enabled: !!projetoId,
  });

  if (!projeto) return null;

  return (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardContent className="p-5">
          <h2 className="mb-3 text-base font-semibold">Descrição</h2>
          <p className="text-sm text-muted-foreground">{projeto.descricao || "Sem descrição."}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-medium text-primary">{projeto.status}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Prazo</p>
            <p className="font-medium">{projeto.prazo ? formatDate(projeto.prazo) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Missões</p>
            <p className="font-medium">{missoes?.length ?? 0}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
