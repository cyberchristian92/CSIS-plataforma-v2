import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ProjectsPage from "@/pages/ProjectsPage";
import MyMissionsPage from "@/pages/MyMissionsPage";
import ProjectPage from "@/pages/ProjectPage";
import ProjectOverviewPage from "@/pages/ProjectOverviewPage";
import ExplorerPage from "@/pages/ExplorerPage";
import BoardPage from "@/pages/BoardPage";
import AreasPage from "@/pages/AreasPage";
import ProjectTypesPage from "@/pages/ProjectTypesPage";
import UsersPage from "@/pages/UsersPage";
import AuditPage from "@/pages/AuditPage";
import ArchivedProjectsPage from "@/pages/ArchivedProjectsPage";
import DocumentEditorPage from "@/pages/DocumentEditorPage";

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
      <Route path="/documentos/:documentoId" element={<RequireAuth><DocumentEditorPage /></RequireAuth>} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projetos" element={<ProjectsPage />} />
        <Route path="/minhas-missoes" element={<MyMissionsPage />} />
        <Route path="/areas" element={<AreasPage />} />
        <Route path="/tipos-projeto" element={<ProjectTypesPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/auditoria" element={<AuditPage />} />
        <Route path="/arquivados" element={<ArchivedProjectsPage />} />
        <Route path="/projetos/:projetoId" element={<ProjectPage />}>
          <Route index element={<Navigate to="visao-geral" replace />} />
          <Route path="visao-geral" element={<ProjectOverviewPage />} />
          <Route path="arquivos" element={<ExplorerPage />} />
          <Route path="board" element={<BoardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
