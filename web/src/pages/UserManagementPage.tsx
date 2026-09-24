import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import type { PapelGlobal } from "@/lib/types";
import { cn } from "@/lib/utils";
import UsersPage from "./UsersPage";
import SignupQueuePage from "./SignupQueuePage";
import SignupFormPage from "./SignupFormPage";

const ABAS: { id: string; rotulo: string; roles: PapelGlobal[] }[] = [
  { id: "membros", rotulo: "Membros", roles: ["ADMIN", "LIDER"] },
  { id: "solicitacoes", rotulo: "Solicitações de cadastro", roles: ["ADMIN", "LIDER", "REVISOR"] },
  { id: "formulario", rotulo: "Formulário de cadastro", roles: ["ADMIN", "LIDER", "REVISOR"] },
];

// Gestão de Usuários (em Recursos, no PARA). Como em Slack/Notion, tudo que é
// sobre pessoas fica numa tela só, em abas — a navegação principal continua
// só com o trabalho (Projetos / Áreas / Recursos / Arquivamento).
export default function UserManagementPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const abas = ABAS.filter((a) => user && a.roles.includes(user.papel_global));
  const ativa = abas.find((a) => a.id === params.get("aba")) ?? abas[0];

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Gestão de Usuários</h1>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setParams({ aba: a.id }, { replace: true })}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              ativa?.id === a.id
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {ativa?.id === "membros" && <UsersPage />}
      {ativa?.id === "solicitacoes" && <SignupQueuePage />}
      {ativa?.id === "formulario" && <SignupFormPage />}
    </div>
  );
}
