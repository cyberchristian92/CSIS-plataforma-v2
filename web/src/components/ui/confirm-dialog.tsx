import { useState } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";

// Substitui `window.confirm` pelo mesmo padrão de `usePromptDialog` — `ask`
// devolve uma Promise<boolean>. `variant: "destructive"` deixa o botão de
// confirmar vermelho, pra ações irreversíveis (excluir).
export function useConfirmDialog() {
  const [estado, setEstado] = useState<{
    titulo: string;
    descricao?: string;
    textoConfirmar?: string;
    destrutivo?: boolean;
    resolve: (v: boolean) => void;
  } | null>(null);

  function ask(opts: { titulo: string; descricao?: string; textoConfirmar?: string; destrutivo?: boolean }): Promise<boolean> {
    return new Promise((resolve) => setEstado({ ...opts, resolve }));
  }

  function confirmar() {
    estado?.resolve(true);
    setEstado(null);
  }

  function cancelar() {
    estado?.resolve(false);
    setEstado(null);
  }

  const dialog = (
    <Dialog open={!!estado} onClose={cancelar}>
      <h2 className="mb-2 text-lg font-bold">{estado?.titulo}</h2>
      {estado?.descricao && <p className="mb-4 text-sm text-muted-foreground">{estado.descricao}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={cancelar}>
          Cancelar
        </Button>
        <Button variant={estado?.destrutivo ? "destructive" : "default"} onClick={confirmar}>
          {estado?.textoConfirmar ?? "Confirmar"}
        </Button>
      </div>
    </Dialog>
  );

  return { ask, dialog };
}
