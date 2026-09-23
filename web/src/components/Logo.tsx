import { useWorkspace } from "@/lib/use-workspace";
import { cn } from "@/lib/utils";

// Logo com fallback pra marca CSIS padrão — permite white-label (Configurações
// deixa o admin trocar por qualquer imagem), mas nunca quebra visualmente
// numa instância nova sem logo configurada ainda. O fundo claro é necessário
// pra maioria das marcas (inclusive a própria CSIS, com traço escuro sobre
// transparente) não sumirem na sidebar escura — mas em vez de um quadrado
// branco chapado, vira um "chip" com anel e sombra sutis, pra parecer um
// selo desenhado de propósito em vez de uma caixa quebrada.
export function Logo({ className }: { className?: string }) {
  const { data: workspace } = useWorkspace();
  const src = workspace?.logo_data_url || "/csis-mark.svg";
  return (
    <img
      src={src}
      alt={workspace?.nome ?? "CSIS"}
      className={cn(
        "rounded-lg bg-white object-contain p-1 shadow-sm ring-1 ring-black/10",
        className,
      )}
    />
  );
}

export function useNomeExibicao() {
  const { data: workspace } = useWorkspace();
  return workspace?.nome || "CSIS";
}
