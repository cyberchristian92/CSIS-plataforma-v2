import { Link, Outlet } from "react-router-dom";
import { Bell, Moon, Search, Settings, Sun } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";

export function AppShell() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border px-6">
          <div className="relative flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            onClick={toggle}
            title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Bell className="h-5 w-5" />
          </button>
          {user?.papel_global === "ADMIN" && (
            <Link
              to="/configuracoes"
              title="Configurações"
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}
        </header>
        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
