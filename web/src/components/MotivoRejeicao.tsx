import { useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";

// Rejeitar devolve a missão para o especialista corrigir — o servidor exige o
// motivo, e é ele que aparece em "Minhas Missões". `pedir()` resolve com o
// texto digitado ou `null` se cancelado (mesmo padrão de usePromptDialog).
export function useMotivoRejeicao() {
  const [pendente, setPendente] = useState<{ resolve: (v: string | null) => void } | null>(null);
  const [texto, setTexto] = useState("");

  function pedir(): Promise<string | null> {
    setTexto("");
    return new Promise((resolve) => setPendente({ resolve }));
  }

  function fechar(valor: string | null) {
    pendente?.resolve(valor);
    setPendente(null);
  }

  const dialog = (
    <Dialog open={!!pendente} onClose={() => fechar(null)} className="max-w-lg">
      <h2 className="text-lg font-bold">Rejeitar entrega</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A missão volta para o especialista. Diga o que precisa ser corrigido — é isso que ele vai ler.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && texto.trim()) fechar(texto.trim());
        }}
        placeholder="Ex.: faltou o hash SHA-256 da imagem do celular."
        autoFocus
        className="mt-4 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => fechar(null)}>
          Cancelar
        </Button>
        <Button variant="destructive" disabled={!texto.trim()} onClick={() => fechar(texto.trim())}>
          Rejeitar e devolver
        </Button>
      </div>
    </Dialog>
  );

  return { pedir, dialog };
}
