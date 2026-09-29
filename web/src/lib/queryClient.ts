import { MutationCache, QueryClient } from "@tanstack/react-query";

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
  // Qualquer ação que dá certo (aprovar cadastro, revisar, entregar...) pode
  // mudar o que o sino de notificações conta — atualiza num lugar só em vez
  // de cada tela lembrar de fazer isso.
  mutationCache: new MutationCache({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes-resumo"] }),
  }),
});
