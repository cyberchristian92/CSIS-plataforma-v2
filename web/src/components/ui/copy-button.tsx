import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// Botão pequeno de copiar-pra-área-de-transferência, pra qualquer valor que
// as pessoas precisem colar em outro lugar (hash de integridade, CID, chave
// de API) sem precisar selecionar o texto à mão.
export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(value);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? "Copiado!" : "Copiar"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {copiado ? <Check className="h-3.5 w-3.5 text-status-approved" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
