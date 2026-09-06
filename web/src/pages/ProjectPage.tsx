import { useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Share2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "@/components/ShareDialog";

export default function ProjectPage() {
  const { projetoId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [compartilhando, setCompartilhando] = useState(false);
  const podeCompartilhar = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";

  const { data: projeto } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: () => api.projetos.buscar(projetoId),
    enabled: !!projetoId,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => navigate("/projetos")} className="hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button onClick={() => navigate("/projetos")} className="hover:text-foreground">
              Projetos
            </button>
            <span>›</span>
            <span className="font-medium text-primary">{projeto?.nome}</span>
          </div>
          {podeCompartilhar && (
            <Button size="sm" variant="outline" onClick={() => setCompartilhando(true)}>
              <Share2 className="h-3.5 w-3.5" /> Compartilhar
            </Button>
          )}
        </div>
        <div className="flex gap-6">
          <TabLink to="visao-geral" label="Visão Geral" />
          <TabLink to="board" label="Missões (Kanban)" />
          <TabLink to="arquivos" label="Arquivos e Documentos" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>

      {podeCompartilhar && (
        <ShareDialog
          tipo="projeto"
          id={compartilhando ? projetoId : null}
          nomeRecurso={projeto?.nome}
          onClose={() => setCompartilhando(false)}
        />
      )}
    </div>
  );
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "border-b-2 border-transparent pb-3 text-sm font-medium text-muted-foreground hover:text-foreground",
          isActive && "border-primary text-primary",
        )
      }
    >
      {label}
    </NavLink>
  );
}
