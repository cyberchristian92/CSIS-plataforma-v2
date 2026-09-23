import { useEffect, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Lock, Users } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "@/lib/use-workspace-id";
import type { TipoRecursoRestringivel } from "@/lib/types";

type Nivel = "publico" | "equipe" | "restrito";

const NIVEIS: Record<Nivel, { icone: ComponentType<{ className?: string }>; titulo: string; descricao: (tipo: TipoRecursoRestringivel) => string }> = {
  publico: {
    icone: Globe,
    titulo: "Público",
    descricao: (tipo) =>
      tipo === "area"
        ? "Todos os usuários ativos veem a área e os materiais dela (os projetos continuam com a própria visibilidade)."
        : "Todos os usuários ativos, inclusive especialistas e alunos, veem este projeto.",
  },
  equipe: {
    icone: Users,
    titulo: "Equipe (padrão)",
    descricao: (tipo) =>
      tipo === "pasta"
        ? "Quem vê o projeto/área também vê esta pasta."
        : "Admin, Coordenadores e Revisores veem. Especialistas só veem se forem responsáveis por uma missão ou estiverem marcados abaixo.",
  },
  restrito: {
    icone: Lock,
    titulo: "Restrito",
    descricao: () => "Só o Administrador, quem criou e quem estiver marcado abaixo — nem Coordenadores e Revisores de fora.",
  },
};

// "Compartilhar" estilo Drive. A visibilidade padrão segue a matriz RBAC da
// especificação (Arquitetura_Backend_Seguranca_CSIS.md): especialistas só
// enxergam o que lhes foi atribuído. Quem criou o recurso e o Administrador
// sempre têm acesso.
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
  const [nivel, setNivel] = useState<Nivel>("equipe");
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
      setNivel(compartilhamento.restrito ? "restrito" : compartilhamento.publico ? "publico" : "equipe");
      setListaIds(new Set(compartilhamento.listas.map((l) => l.id)));
      setUserIds(new Set(compartilhamento.usuarios.map((u) => u.id)));
    }
  }, [compartilhamento]);

  const salvar = useMutation({
    mutationFn: () =>
      api.compartilhamento.definir(tipo, id!, {
        restrito: nivel === "restrito",
        publico: nivel === "publico",
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

  // Pasta não tem "público": ela herda a visibilidade de onde está.
  const niveis: Nivel[] = tipo === "pasta" ? ["equipe", "restrito"] : ["publico", "equipe", "restrito"];
  const mostrarPessoas = nivel !== "publico" && !(tipo === "pasta" && nivel === "equipe");
  const usuariosAtivos = usuarios?.filter((u) => u.situacao === "ATIVO");

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md max-h-[80vh] overflow-y-auto">
      <h2 className="mb-1 text-lg font-bold">Compartilhar</h2>
      {nomeRecurso && <p className="mb-4 text-sm text-muted-foreground">{nomeRecurso}</p>}

      <div className="mb-4 flex flex-col gap-2">
        {niveis.map((n) => {
          const { icone: Icone, titulo, descricao } = NIVEIS[n];
          const selecionado = nivel === n;
          return (
            <button
              key={n}
              onClick={() => setNivel(n)}
              className={cn(
                "flex w-full items-start gap-3 rounded-md border p-3 text-left hover:bg-accent",
                selecionado ? "border-primary bg-accent/50" : "border-border",
              )}
            >
              <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", selecionado ? "text-primary" : "text-muted-foreground")} />
              <div>
                <p className="text-sm font-medium">{titulo}</p>
                <p className="text-xs text-muted-foreground">{descricao(tipo)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {mostrarPessoas && (
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
            {usuariosAtivos?.map((u) => (
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
