import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

/// Autoaprovação (TCC v4, seções 4.2 e 8.3): quem executou a missão pode
/// aprovar a própria entrega em caráter excepcional — por exemplo, sem revisor
/// disponível no prazo. A justificativa é opcional; fica registrada em
/// destaque na auditoria e no histórico da missão. O caminho normal continua sendo outra
/// pessoa revisar.
export function BotaoAutoaprovar({ entregaId, onConcluido }: { entregaId: string; onConcluido: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        <ShieldAlert className="h-3.5 w-3.5" /> Autoaprovar (exceção)
      </Button>
      <DialogoAutoaprovar
        entregaId={aberto ? entregaId : null}
        onFechar={() => setAberto(false)}
        onConcluido={onConcluido}
      />
    </>
  );
}

/// O diálogo da justificativa, aberto quando `entregaId` não é nulo — usado
/// pelo botão acima e ao arrastar o card para "Aprovada" em Minhas Missões.
export function DialogoAutoaprovar({
  entregaId,
  onFechar,
  onConcluido,
}: {
  entregaId: string | null;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setJustificativa("");
    setErro(null);
  }, [entregaId]);

  const autoaprovar = useMutation({
    mutationFn: () => api.revisoes.autoaprovar(entregaId!, justificativa.trim() || undefined),
    onSuccess: () => {
      onFechar();
      onConcluido();
    },
    onError: (e: unknown) => setErro(e instanceof ApiError ? e.message : "Não foi possível autoaprovar."),
  });

  return (
    <Dialog open={!!entregaId} onClose={onFechar}>
      <h2 className="mb-1 text-lg font-bold">Autoaprovar a própria entrega</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Fica registrado de forma permanente, em destaque, na auditoria e no histórico da missão — com seu nome e a
        data (e a justificativa, se escrever uma).
      </p>
      {erro && <p className="mb-2 text-xs text-destructive">{erro}</p>}
      <textarea
        rows={3}
        autoFocus
        value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)}
        placeholder="Justificativa (opcional): por que não houve revisão por outra pessoa?"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
        <Button
          disabled={autoaprovar.isPending}
          onClick={() => autoaprovar.mutate()}
        >
          Autoaprovar
        </Button>
      </div>
    </Dialog>
  );
}
