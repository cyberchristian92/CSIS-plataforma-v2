import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FileExplorer } from "@/components/FileExplorer";

// "Recursos" no método PARA = ativos organizacionais no nível da empresa
// inteira (Workspace), não de um projeto: logos, templates, prompts etc.
// CSIS é single-tenant (um Workspace por instalação self-hosted — ver
// docs/adr/0001-sem-blockchain-postgres-ipfs.md), então sempre usamos o
// primeiro/único workspace.
export default function ResourcesPage() {
  const { data: workspaces } = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces.listar });
  const workspace = workspaces?.[0];

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Arquivos da Empresa</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Ativos organizacionais compartilhados — logos, templates, prompts e o que mais fizer sentido para toda a
        operação.
      </p>
      {workspace && <FileExplorer scope={{ type: "workspace", id: workspace.id }} />}
    </div>
  );
}
