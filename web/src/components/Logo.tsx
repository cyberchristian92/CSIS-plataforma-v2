import { useWorkspace } from "@/lib/use-workspace";
import { cn } from "@/lib/utils";

// Logo com fallback pra marca CSIS padrão — permite white-label (Configurações
// deixa o admin trocar por qualquer imagem), mas nunca quebra visualmente
// numa instância nova sem logo configurada ainda.
export function Logo({ className }: { className?: string }) {
  const { data: workspace } = useWorkspace();
  const src = workspace?.logo_data_url || "/csis-mark.svg";
  return <img src={src} alt={workspace?.nome ?? "CSIS"} className={cn("rounded bg-white object-contain p-0.5", className)} />;
}

export function useNomeExibicao() {
  const { data: workspace } = useWorkspace();
  return workspace?.nome || "CSIS";
}
