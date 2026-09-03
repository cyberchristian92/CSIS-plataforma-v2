import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, Folder } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: workspaces } = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces.listar });

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Olá, {user?.nome?.split(" ")[0]}</h1>
      <p className="mb-6 text-sm text-muted-foreground">Seus workspaces e projetos recentes.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces?.map((ws) => (
          <Card key={ws.id}>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Building2 className="h-4 w-4 text-primary" />
              <CardTitle>{ws.nome}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{ws.descricao ?? "Sem descrição"}</p>
              <AreasResumo workspaceId={ws.id} />
            </CardContent>
          </Card>
        ))}
        {workspaces?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum workspace ainda.</p>}
      </div>
    </div>
  );
}

function AreasResumo({ workspaceId }: { workspaceId: string }) {
  const { data: areas } = useQuery({
    queryKey: ["areas", workspaceId],
    queryFn: () => api.areas.listarPorWorkspace(workspaceId),
  });

  return (
    <div className="mt-3 flex flex-col gap-1">
      {areas?.map((area) => (
        <Link
          key={area.id}
          to={`/`}
          className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-foreground/80 hover:bg-accent"
        >
          <Folder className="h-3 w-3" /> {area.nome}
        </Link>
      ))}
    </div>
  );
}
