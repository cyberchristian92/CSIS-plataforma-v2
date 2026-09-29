import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3, List } from "lucide-react";
import { api } from "@/lib/api";
import type { MinhaMissao, MissaoStatus } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { MissionDialog } from "@/components/MissionDialog";
import { EntregaForm } from "@/components/EntregaForm";
import { QuadroMissoes } from "@/components/minhas-missoes/QuadroMissoes";
import { ListaMissoes } from "@/components/minhas-missoes/ListaMissoes";
import { ehDevolvida } from "@/components/minhas-missoes/comum";
import { cn } from "@/lib/utils";

// Minhas Missões: tudo que está com a pessoa, em todos os projetos. O padrão é
// o quadro por status, livre (ver QuadroMissoes e `mover` abaixo); a lista
// agrupada pelo que fazer é uma visão alternativa.

type Modo = "quadro" | "lista";
const CHAVE_MODO = "csis.minhas-missoes.modo";

function lerModo(): Modo {
  try {
    return localStorage.getItem(CHAVE_MODO) === "lista" ? "lista" : "quadro";
  } catch {
    return "quadro";
  }
}

export default function MyMissionsPage() {
  const qc = useQueryClient();
  const [modo, setModo] = useState<Modo>(lerModo);
  const [missaoAberta, setMissaoAberta] = useState<string | null>(null);
  const [entregando, setEntregando] = useState<{ missao: MinhaMissao } | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_MODO, modo);
    } catch {
      // Sem armazenamento local (aba anônima etc.): só não lembra a escolha.
    }
  }, [modo]);

  // Avisos somem sozinhos; erros ficam até a próxima ação.
  useEffect(() => {
    if (!aviso || aviso.erro) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const { data: missoes, isLoading, isError } = useQuery({
    queryKey: ["missoes-minhas"],
    queryFn: api.missoes.minhas,
  });

  const iniciar = useMutation({
    mutationFn: (id: string) => api.missoes.iniciar(id),
    onMutate: () => setAviso(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes-minhas"] }),
    onError: (e: Error) => setAviso({ texto: e.message || "Não foi possível iniciar a missão.", erro: true }),
  });

  const lista = missoes ?? [];
  const resumo = [
    [lista.filter(ehDevolvida).length, "para corrigir", "para corrigir"],
    [lista.filter((m) => m.status === "EM_ANDAMENTO" && !ehDevolvida(m)).length, "em andamento", "em andamento"],
    [lista.filter((m) => m.status === "PENDENTE").length, "a iniciar", "a iniciar"],
    [lista.filter((m) => m.status === "EM_REVISAO").length, "com o revisor", "com o revisor"],
    [lista.filter((m) => m.status === "APROVADA").length, "concluída", "concluídas"],
  ] as const;
  const textoResumo = resumo
    .filter(([n]) => n > 0)
    .map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`)
    .join(" · ");

  const props = {
    missoes: lista,
    onAbrir: setMissaoAberta,
    onIniciar: (id: string) => iniciar.mutate(id),
    iniciandoId: iniciar.isPending ? (iniciar.variables ?? null) : null,
    onEntregar: (missao: MinhaMissao) => setEntregando({ missao }),
  };

  function atualizar() {
    qc.invalidateQueries({ queryKey: ["missoes-minhas"] });
    qc.invalidateQueries({ queryKey: ["notificacoes-resumo"] });
  }

  // Quadro livre, como no Trello: soltou, mudou. O card vai na hora para a
  // coluna nova (atualização otimista) e volta se o servidor recusar. Todo
  // movimento fica na auditoria (MOVER_STATUS).
  async function mover(m: MinhaMissao, destino: MissaoStatus) {
    setAviso(null);
    const chave = ["missoes-minhas"];
    const antes = qc.getQueryData<MinhaMissao[]>(chave);
    qc.setQueryData<MinhaMissao[]>(chave, (lista) =>
      lista?.map((x) => (x.id === m.id ? { ...x, status: destino } : x)),
    );
    try {
      await api.missoes.mudarStatus(m.id, destino as "PENDENTE" | "EM_ANDAMENTO" | "EM_REVISAO" | "APROVADA");
    } catch (e) {
      qc.setQueryData(chave, antes);
      setAviso({ texto: e instanceof Error ? e.message : "Não foi possível mover a missão.", erro: true });
    } finally {
      atualizar();
    }
  }

  return (
    <div className="flex h-full flex-col p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Minhas Missões</h1>
          {textoResumo && <p className="mt-0.5 text-sm text-muted-foreground">{textoResumo}</p>}
        </div>
        <div className="flex rounded-md border border-border p-0.5 text-sm" role="group" aria-label="Visualização">
          {(
            [
              ["quadro", "Quadro", Columns3],
              ["lista", "Lista", List],
            ] as const
          ).map(([valor, rotulo, Icone]) => (
            <button
              key={valor}
              onClick={() => setModo(valor)}
              aria-pressed={modo === valor}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-muted-foreground hover:text-foreground",
                modo === valor && "bg-accent text-foreground",
              )}
            >
              <Icone className="h-3.5 w-3.5" /> {rotulo}
            </button>
          ))}
        </div>
      </header>

      {aviso && (
        <p
          className={cn(
            "mb-4 border-l-2 pl-3 text-sm",
            aviso.erro ? "border-destructive text-destructive" : "border-status-in-review text-foreground",
          )}
        >
          {aviso.texto}
        </p>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {isError && <p className="text-sm text-destructive">Não foi possível carregar suas missões. Recarregue a página.</p>}
      {missoes?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma missão com você agora. Quando a coordenação atribuir uma, ela aparece aqui.
        </p>
      )}

      {lista.length > 0 &&
        (modo === "quadro" ? (
          <QuadroMissoes missoes={lista} onAbrir={setMissaoAberta} onMover={mover} />
        ) : (
          <div className="w-full max-w-5xl">
            <ListaMissoes {...props} />
          </div>
        ))}

      <MissionDialog missaoId={missaoAberta} onClose={() => setMissaoAberta(null)} />

      <Dialog open={!!entregando} onClose={() => setEntregando(null)} className="max-w-xl">
        {entregando && (
          <>
            <h2 className="pr-6 text-lg font-bold">Entregar para revisão</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {entregando.missao.titulo} · {entregando.missao.projeto.nome}
            </p>
            {entregando.missao.ultima_entrega?.revisao?.status === "REJEITADO" && (
              <p className="mt-3 border-l-2 border-destructive pl-3 text-sm">
                <span className="text-muted-foreground">
                  O que {entregando.missao.ultima_entrega.revisao.revisor.nome} pediu:{" "}
                </span>
                {entregando.missao.ultima_entrega.revisao.comentario ?? "sem comentário"}
              </p>
            )}
            <div className="mt-4">
              <EntregaForm
                missaoId={entregando.missao.id}
                projetoId={entregando.missao.projeto.id}
                onEntregue={() => setEntregando(null)}
                onCancelar={() => setEntregando(null)}
              />
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
