import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

// Diferente de `useWorkspace` (endpoint público /branding, só nome+logo) —
// este usa o endpoint autenticado e retorna o registro completo, com `id`,
// necessário pra endpoints que dependem do Workspace (ex: Listas de Acesso).
export function useWorkspaceId() {
  const { data } = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces.listar });
  return data?.[0]?.id;
}
