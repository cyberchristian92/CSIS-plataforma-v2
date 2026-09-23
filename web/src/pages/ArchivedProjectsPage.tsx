import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Archive } from "lucide-react";
import { api } from "@/lib/api";

export default function ArchivedProjectsPage() {
  const { data: projetos } = useQuery({ queryKey: ["projetos-todos"], queryFn: api.projetos.listarTodos });
  const arquivados = projetos?.filter((p) => p.status === "ARQUIVADO" || p.status === "CONCLUIDO") ?? [];

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Projetos Arquivados</h1>
      <div className="flex flex-col gap-2">
        {arquivados.map((p) => (
          <Link
            key={p.id}
            to={`/projetos/${p.id}`}
            className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm hover:border-primary/40 hover:bg-accent"
          >
            <Archive className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{p.nome}</span>
            <span className="ml-auto text-xs text-muted-foreground">{p.status}</span>
          </Link>
        ))}
        {arquivados.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto arquivado.</p>}
      </div>
    </div>
  );
}
