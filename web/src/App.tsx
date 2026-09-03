import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import MyMissionsPage from "@/pages/MyMissionsPage";
import ProjectPage from "@/pages/ProjectPage";
import ExplorerPage from "@/pages/ExplorerPage";
import BoardPage from "@/pages/BoardPage";

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/minhas-missoes" element={<MyMissionsPage />} />
        <Route path="/projetos/:projetoId" element={<ProjectPage />}>
          <Route index element={<Navigate to="arquivos" replace />} />
          <Route path="arquivos" element={<ExplorerPage />} />
          <Route path="board" element={<BoardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
