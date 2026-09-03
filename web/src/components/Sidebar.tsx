import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { ChevronRight, Folder, FolderOpen, LayoutGrid, Building2, ListChecks } from "lucide-react";
import { api } from "@/lib/api";
import type { Area, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

// Navegação em árvore Workspace > Área > Projeto, no espírito do Google Drive:
// cada nível expande/colapsa, e o item ativo fica destacado.

export function Sidebar() {
  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.workspaces.listar,
  });

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          C
        </div>
        <span className="text-sm font-semibold">CSIS</span>
      </div>

      <nav className="flex flex-col gap-0.5 border-b border-border p-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground/80 hover:bg-accent",
              isActive && "bg-accent font-medium text-foreground",
            )
          }
        >
          <LayoutGrid className="h-4 w-4" /> Painel
        </NavLink>
        <NavLink
          to="/minhas-missoes"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground/80 hover:bg-accent",
              isActive && "bg-accent font-medium text-foreground",
            )
          }
        >
          <ListChecks className="h-4 w-4" /> Minhas Missões
        </NavLink>
      </nav>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workspaces
        </p>
        {workspaces?.map((ws) => (
          <WorkspaceNode key={ws.id} workspace={ws} />
        ))}
      </div>
    </aside>
  );
}

function WorkspaceNode({ workspace }: { workspace: Workspace }) {
  const [open, setOpen] = useState(true);
  const { data: areas } = useQuery({
    queryKey: ["areas", workspace.id],
    queryFn: () => api.areas.listarPorWorkspace(workspace.id),
    enabled: open,
  });

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        {open ? <FolderOpen className="h-4 w-4 shrink-0 text-primary" /> : <Folder className="h-4 w-4 shrink-0 text-primary" />}
        <span className="truncate">{workspace.nome}</span>
      </button>
      {open && (
        <div className="ml-3.5 border-l border-border pl-2">
          {areas?.map((area) => (
            <AreaNode key={area.id} area={area} />
          ))}
        </div>
      )}
    </div>
  );
}

function AreaNode({ area }: { area: Area }) {
  const [open, setOpen] = useState(false);
  const { data: projetos } = useQuery({
    queryKey: ["projetos", area.id],
    queryFn: () => api.projetos.listarPorArea(area.id),
    enabled: open,
  });

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{area.nome}</span>
      </button>
      {open && (
        <div className="ml-3.5 border-l border-border pl-2">
          {projetos?.map((projeto) => (
            <NavLink
              key={projeto.id}
              to={`/projetos/${projeto.id}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 truncate rounded-md px-1.5 py-1.5 text-sm text-foreground/80 hover:bg-accent",
                  isActive && "bg-accent font-medium text-foreground",
                )
              }
            >
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{projeto.nome}</span>
            </NavLink>
          ))}
          {projetos?.length === 0 && <p className="px-1.5 py-1 text-xs text-muted-foreground">Sem projetos</p>}
        </div>
      )}
    </div>
  );
}
