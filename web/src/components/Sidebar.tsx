import { useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { LayoutGrid, Folder, ChevronUp, ChevronDown, Building2, Settings2, Archive, LogOut, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import type { PapelGlobal } from "@/lib/types";
import { Avatar } from "./ui/avatar";

// Sidebar organizada pelo método PARA (Projetos / Áreas / Recursos /
// Arquivamento) — não é uma árvore Workspace>Área>Projeto tipo Drive, é a
// mesma taxonomia de navegação do protótipo original (ver figuras/prototipo
// no TCC). Cada grupo é uma seção do PARA, não um nível hierárquico de dados.
//
// Áreas/Recursos ficam ocultos para REVISOR/COLABORADOR (só ADMIN/LIDER
// gerenciam ativos organizacionais), replicando o comportamento do app
// Flutter original.

interface NavItem {
  to: string;
  label: string;
  roles?: PapelGlobal[];
}

interface NavGroup {
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: NavItem[];
  roles?: PapelGlobal[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Projetos",
    icon: Folder,
    items: [
      { to: "/projetos", label: "Projetos Abertos" },
      { to: "/minhas-missoes", label: "Minhas Missões" },
      { to: "/fila-revisao", label: "Fila de Revisão", roles: ["ADMIN", "LIDER", "REVISOR"] },
    ],
  },
  {
    label: "Áreas",
    icon: Building2,
    roles: ["ADMIN", "LIDER"],
    items: [
      { to: "/areas", label: "Gestão de Áreas" },
      { to: "/tipos-projeto", label: "Tipos de Projeto" },
    ],
  },
  {
    label: "Recursos",
    icon: Settings2,
    roles: ["ADMIN", "LIDER"],
    items: [
      { to: "/recursos", label: "Arquivos da Empresa" },
      { to: "/usuarios", label: "Gestão de Usuários" },
      { to: "/auditoria", label: "Auditoria Global" },
    ],
  },
  {
    label: "Arquivamento",
    icon: Archive,
    items: [{ to: "/arquivados", label: "Projetos Arquivados" }],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const papel = user?.papel_global;

  const visibleGroups = GROUPS.filter((g) => !g.roles || (papel && g.roles.includes(papel)))
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (papel && i.roles.includes(papel))) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <img src="/csis-mark.svg" alt="CSIS" className="h-7 w-7 rounded bg-white p-0.5" />
        <span className="text-lg font-bold tracking-wide text-primary">CSIS</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent",
              isActive && "bg-accent text-primary",
            )
          }
        >
          <LayoutGrid className="h-4 w-4" /> Painel
        </NavLink>

        {visibleGroups.map((group) => (
          <NavGroupSection key={group.label} group={group} />
        ))}
      </nav>

      {user && (
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Avatar nome={user.nome} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user.nome}</p>
            <p className="text-xs text-muted-foreground">{user.papel_global}</p>
          </div>
          <button onClick={() => logout()} title="Sair" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}

function NavGroupSection({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(true);
  const Icon = group.icon;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/90 hover:bg-accent"
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-3">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                  isActive && "bg-accent font-medium text-primary",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
