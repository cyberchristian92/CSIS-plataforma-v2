import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

// Usa o endpoint público /branding (sem autenticação) — precisa funcionar
// tanto na tela de Login (sem sessão) quanto logado, já que CSIS é
// single-tenant por instância e o nome/logo (white-label, ver
// pages/SettingsPage.tsx) devem aparecer em qualquer tela, inclusive antes
// de logar.
export function useWorkspace() {
  return useQuery({
    queryKey: ["branding"],
    queryFn: api.branding.obter,
    staleTime: 5 * 60 * 1000,
  });
}
