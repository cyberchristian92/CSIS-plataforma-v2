import { useEffect, useState, type KeyboardEvent } from "react";
import { Dialog } from "./dialog";
import { Input } from "./input";
import { Button } from "./button";

// Substitui `window.prompt` — que trava a aba inteira em navegadores
// automatizados (e é feio) — por um diálogo controlado pela própria árvore
// React. `usePromptDialog` devolve `ask(title)` que resolve com o texto
// digitado ou `null` se cancelado, com a mesma assinatura de `window.prompt`
// pra ser um drop-in replacement nas mutations existentes.
export function usePromptDialog() {
  const [estado, setEstado] = useState<{ titulo: string; resolve: (v: string | null) => void } | null>(null);
  const [valor, setValor] = useState("");

  function ask(titulo: string, valorInicial = ""): Promise<string | null> {
    setValor(valorInicial);
    return new Promise((resolve) => setEstado({ titulo, resolve }));
  }

  function confirmar() {
    estado?.resolve(valor.trim() || null);
    setEstado(null);
  }

  function cancelar() {
    estado?.resolve(null);
    setEstado(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") confirmar();
    if (e.key === "Escape") cancelar();
  }

  const dialog = (
    <Dialog open={!!estado} onClose={cancelar}>
      <h2 className="mb-4 text-lg font-bold">{estado?.titulo}</h2>
      <Input value={valor} onChange={(e) => setValor(e.target.value)} onKeyDown={onKeyDown} autoFocus />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={cancelar}>
          Cancelar
        </Button>
        <Button disabled={!valor.trim()} onClick={confirmar}>
          Confirmar
        </Button>
      </div>
    </Dialog>
  );

  return { ask, dialog };
}
