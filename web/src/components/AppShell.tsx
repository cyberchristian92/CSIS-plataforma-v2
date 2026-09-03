import { Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";
import { useAuth } from "@/lib/auth-context";

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border px-4">
          {user && (
            <>
              <div className="text-right leading-tight">
                <p className="text-sm font-medium">{user.nome}</p>
                <p className="text-xs text-muted-foreground">{user.papel_global}</p>
              </div>
              <Avatar nome={user.nome} />
              <Button variant="ghost" size="icon" onClick={() => logout()} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </header>
        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
