import type { ReactNode } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KanbanSquare, FolderOpen } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ProjectPage() {
  const { projetoId = "" } = useParams();
  const { data: projeto } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: () => api.projetos.buscar(projetoId),
    enabled: !!projetoId,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 pt-5">
        <h1 className="text-lg font-semibold">{projeto?.nome}</h1>
        <div className="mt-3 flex gap-1">
          <TabLink to="arquivos" icon={<FolderOpen className="h-4 w-4" />} label="Arquivos" />
          <TabLink to="board" icon={<KanbanSquare className="h-4 w-4" />} label="Board" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

function TabLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-1.5 rounded-t-md border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
          isActive && "border-primary text-foreground",
        )
      }
    >
      {icon} {label}
    </NavLink>
  );
}
