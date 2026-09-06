import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { useWorkspaceId } from "@/lib/use-workspace-id";
import type { TipoRecursoRestringivel } from "@/lib/types";

// "Compartilhar" estilo Drive — por padrão um recurso é visível pra
// qualquer usuário autenticado (nada muda); marcar como restrito faz a
// visibilidade depender de quem está selecionado aqui (Listas de Acesso
// geridas em Configurações, ou pessoas específicas). Quem criou o recurso e
// o Administrador sempre têm acesso, mesmo restrito.
export function ShareDialog({
  tipo,
  id,
  nomeRecurso,
  onClose,
}: {
  tipo: TipoRecursoRestringivel;
  id: string | null;
  nomeRecurso?: string;
  onClose: () => void;
}) {
  const open = !!id;
  const qc = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [restrito, setRestrito] = useState(false);
  const [listaIds, setListaIds] = useState<Set<string>>(new Set());
  const [userIds, setUserIds] = useState<Set<string>>(new Set());

  const { data: compartilhamento } = useQuery({
    queryKey: ["compartilhamento", tipo, id],
    queryFn: () => api.compartilhamento.obter(tipo, id!),
    enabled: open,
  });

  const { data: listas } = useQuery({
    queryKey: ["listas", workspaceId],
    queryFn: () => api.listas.listarPorWorkspace(workspaceId!),
    enabled: open && !!workspaceId,
  });

  const { data: usuarios } = useQuery({ queryKey: ["usuarios"], queryFn: api.auth.listarUsuarios, enabled: open });

  useEffect(() => {
    if (compartilhamento) {
      setRestrito(compartilhamento.restrito);
      setListaIds(new Set(compartilhamento.listas.map((l) => l.id)));
      setUserIds(new Set(compartilhamento.usuarios.map((u) => u.id)));
    }
  }, [compartilhamento]);

  const salvar = useMutation({
    mutationFn: () =>
      api.compartilhamento.definir(tipo, id!, {
        restrito,
        listaIds: [...listaIds],
        userIds: [...userIds],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compartilhamento", tipo, id] });
      qc.invalidateQueries({ queryKey: ["projetos-area"] });
      qc.invalidateQueries({ queryKey: ["areas-todas"] });
      onClose();
    },
  });

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, itemId: string) {
    const novo = new Set(set);
    if (novo.has(itemId)) novo.delete(itemId);
    else novo.add(itemId);
    setSet(novo);
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md max-h-[80vh] overflow-y-auto">
      <h2 className="mb-1 text-lg font-bold">Compartilhar</h2>
      {nomeRecurso && <p className="mb-4 text-sm text-muted-foreground">{nomeRecurso}</p>}

      <button
        onClick={() => setRestrito((v) => !v)}
        className="mb-4 flex w-full items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-accent"
      >
        {restrito ? <Lock className="h-4 w-4 text-primary" /> : <LockOpen className="h-4 w-4 text-muted-foreground" />}
        <div>
          <p className="text-sm font-medium">{restrito ? "Restrito" : "Aberto (padrão)"}</p>
          <p className="text-xs text-muted-foreground">
            {restrito
              ? "Só Administrador, quem criou e quem está marcado abaixo conseguem ver."
              : "Qualquer usuário autenticado consegue ver — clique pra restringir."}
          </p>
        </div>
      </button>

      {restrito && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Listas de Acesso</h3>
          <div className="mb-4 flex flex-col gap-1">
            {listas?.map((lista) => (
              <label key={lista.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                <input type="checkbox" checked={listaIds.has(lista.id)} onChange={() => toggle(listaIds, setListaIds, lista.id)} />
                {lista.nome}
              </label>
            ))}
            {(!listas || listas.length === 0) && (
              <p className="text-xs text-muted-foreground">
                Nenhuma Lista criada ainda — crie uma em Configurações &gt; Listas de Acesso.
              </p>
            )}
          </div>

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pessoas específicas</h3>
          <div className="mb-4 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {usuarios?.map((u) => (
              <label key={u.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                <input type="checkbox" checked={userIds.has(u.id)} onChange={() => toggle(userIds, setUserIds, u.id)} />
                {u.nome}
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </Dialog>
  );
}
