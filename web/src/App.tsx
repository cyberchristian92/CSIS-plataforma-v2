import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import type { PapelGlobal } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import ProjectsPage from "@/pages/ProjectsPage";
import MyMissionsPage from "@/pages/MyMissionsPage";
import ReviewQueuePage from "@/pages/ReviewQueuePage";
import ProjectPage from "@/pages/ProjectPage";
import ProjectOverviewPage from "@/pages/ProjectOverviewPage";
import ExplorerPage from "@/pages/ExplorerPage";
import BoardPage from "@/pages/BoardPage";
import AreasPage from "@/pages/AreasPage";
import AreaPage from "@/pages/AreaPage";
import ProjectTypesPage from "@/pages/ProjectTypesPage";
import ResourcesPage from "@/pages/ResourcesPage";
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

// Segunda camada de defesa além de esconder o item na Sidebar — o backend já
// nega via @Roles(), mas a rota também não deve nem renderizar pra quem não
// tem o papel certo (evita um "flash" de conteúdo antes do 403 chegar).
function RequireRole({ roles, children }: { roles: PapelGlobal[]; children: ReactElement }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.papel_global)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
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
        <Route
          path="/fila-revisao"
          element={
            <RequireRole roles={["ADMIN", "LIDER", "REVISOR"]}>
              <ReviewQueuePage />
            </RequireRole>
          }
        />
        <Route
          path="/areas"
          element={
            <RequireRole roles={["ADMIN", "LIDER"]}>
              <AreasPage />
            </RequireRole>
          }
        />
        <Route
          path="/areas/:areaId"
          element={
            <RequireRole roles={["ADMIN", "LIDER"]}>
              <AreaPage />
            </RequireRole>
          }
        />
        <Route
          path="/tipos-projeto"
          element={
            <RequireRole roles={["ADMIN", "LIDER"]}>
              <ProjectTypesPage />
            </RequireRole>
          }
        />
        <Route
          path="/recursos"
          element={
            <RequireRole roles={["ADMIN", "LIDER"]}>
              <ResourcesPage />
            </RequireRole>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RequireRole roles={["ADMIN", "LIDER"]}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="/auditoria"
          element={
            <RequireRole roles={["ADMIN", "LIDER"]}>
              <AuditPage />
            </RequireRole>
          }
        />
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
