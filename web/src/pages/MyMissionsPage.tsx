import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { MinhaMissao } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MissionDialog } from "@/components/MissionDialog";
import { EntregaForm } from "@/components/EntregaForm";
import { cn, diasAtePrazo, formatDate, formatDateOnly } from "@/lib/utils";

// Fila pessoal de trabalho: tudo que está com a pessoa, em vários projetos,
// agrupado pelo que ela precisa fazer — devolvidas primeiro, porque alguém
// está esperando a correção. O quadro livre (arrastar entre colunas) continua
// dentro de cada projeto (BoardPage.tsx); aqui cada linha já traz a próxima
// ação (Iniciar / Entregar), sem precisar abrir a missão.

type Grupo = "devolvidas" | "andamento" | "iniciar" | "revisao" | "concluidas";

// `resumo` é [singular, plural] para a linha "2 para corrigir · 1 concluída".
const GRUPOS: { id: Grupo; titulo: string; resumo: [string, string]; marca: string }[] = [
  { id: "devolvidas", titulo: "Devolvidas para correção", resumo: ["para corrigir", "para corrigir"], marca: "bg-destructive" },
  { id: "andamento", titulo: "Em andamento", resumo: ["em andamento", "em andamento"], marca: "bg-status-in-progress" },
  { id: "iniciar", titulo: "A iniciar", resumo: ["a iniciar", "a iniciar"], marca: "bg-status-pending" },
  { id: "revisao", titulo: "Aguardando revisão", resumo: ["com o revisor", "com o revisor"], marca: "bg-status-in-review" },
  { id: "concluidas", titulo: "Concluídas", resumo: ["concluída", "concluídas"], marca: "bg-status-approved" },
];

const MARCA = Object.fromEntries(GRUPOS.map((g) => [g.id, g.marca])) as Record<Grupo, string>;

// Colunas da linha em telas médias pra cima: missão | prazo | checklist | ação.
const COLUNAS = "sm:grid-cols-[minmax(0,1fr)_8.5rem_5.5rem_10rem]";

function grupoDe(m: MinhaMissao): Grupo {
  if (m.status === "REJEITADA") return "devolvidas";
  if (m.status === "EM_ANDAMENTO") return m.ultima_entrega?.status === "REJEITADA" ? "devolvidas" : "andamento";
  if (m.status === "PENDENTE") return "iniciar";
  if (m.status === "EM_REVISAO") return "revisao";
  return "concluidas";
}

export default function MyMissionsPage() {
  const qc = useQueryClient();
  const [missaoAberta, setMissaoAberta] = useState<string | null>(null);
  const [entregando, setEntregando] = useState<MinhaMissao | null>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data: missoes, isLoading, isError } = useQuery({
    queryKey: ["missoes-minhas"],
    queryFn: api.missoes.minhas,
  });

  const iniciar = useMutation({
    mutationFn: (id: string) => api.missoes.iniciar(id),
    onMutate: () => setErro(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes-minhas"] }),
    onError: (e: Error) => setErro(e.message || "Não foi possível iniciar a missão."),
  });

  const porGrupo: Record<Grupo, MinhaMissao[]> = {
    devolvidas: [],
    andamento: [],
    iniciar: [],
    revisao: [],
    concluidas: [],
  };
  for (const m of missoes ?? []) porGrupo[grupoDe(m)].push(m);

  const resumo = GRUPOS.filter((g) => porGrupo[g.id].length > 0)
    .map((g) => {
      const n = porGrupo[g.id].length;
      return `${n} ${g.resumo[n === 1 ? 0 : 1]}`;
    })
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">Minhas Missões</h1>
        {resumo && <p className="mt-0.5 text-sm text-muted-foreground">{resumo}</p>}
      </header>

      {erro && <p className="mb-4 border-l-2 border-destructive pl-3 text-sm text-destructive">{erro}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {isError && <p className="text-sm text-destructive">Não foi possível carregar suas missões. Recarregue a página.</p>}
      {missoes?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma missão com você agora. Quando a coordenação atribuir uma, ela aparece aqui.
        </p>
      )}

      {missoes && missoes.length > 0 && (
        <div
          className={cn(
            "hidden gap-x-6 pb-2 pl-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:grid",
            COLUNAS,
          )}
        >
          <span>Missão</span>
          <span>Prazo</span>
          <span>Checklist</span>
          <span />
        </div>
      )}

      {GRUPOS.map((g) => {
        const lista = porGrupo[g.id];
        if (lista.length === 0) return null;
        const recolhido = g.id === "concluidas" && !verConcluidas;
        return (
          <section key={g.id} className="mb-8">
            <h2 className="flex items-baseline gap-2 pb-2 text-sm font-semibold">
              {g.id === "concluidas" ? (
                <button
                  onClick={() => setVerConcluidas((v) => !v)}
                  className="flex items-center gap-1 hover:text-primary"
                >
                  {recolhido ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {g.titulo}
                </button>
              ) : (
                g.titulo
              )}
              <span className="font-mono text-xs font-normal text-muted-foreground">{lista.length}</span>
            </h2>
            {!recolhido && (
              <ul className="border-t border-border">
                {lista.map((m) => (
                  <Linha
                    key={m.id}
                    missao={m}
                    grupo={g.id}
                    onAbrir={() => setMissaoAberta(m.id)}
                    onIniciar={() => iniciar.mutate(m.id)}
                    iniciando={iniciar.isPending && iniciar.variables === m.id}
                    onEntregar={() => setEntregando(m)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <MissionDialog missaoId={missaoAberta} onClose={() => setMissaoAberta(null)} />

      <Dialog open={!!entregando} onClose={() => setEntregando(null)} className="max-w-xl">
        {entregando && (
          <>
            <h2 className="pr-6 text-lg font-bold">Entregar para revisão</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {entregando.titulo} · {entregando.projeto.nome}
            </p>
            {entregando.ultima_entrega?.revisao?.status === "REJEITADO" && (
              <p className="mt-3 border-l-2 border-destructive pl-3 text-sm">
                <span className="text-muted-foreground">O que {entregando.ultima_entrega.revisao.revisor.nome} pediu: </span>
                {entregando.ultima_entrega.revisao.comentario ?? "sem comentário"}
              </p>
            )}
            <div className="mt-4">
              <EntregaForm
                missaoId={entregando.id}
                projetoId={entregando.projeto.id}
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

function Linha({
  missao,
  grupo,
  onAbrir,
  onIniciar,
  iniciando,
  onEntregar,
}: {
  missao: MinhaMissao;
  grupo: Grupo;
  onAbrir: () => void;
  onIniciar: () => void;
  iniciando: boolean;
  onEntregar: () => void;
}) {
  const revisao = missao.ultima_entrega?.revisao;
  const aberta = grupo === "devolvidas" || grupo === "andamento" || grupo === "iniciar";

  return (
    <li
      className={cn(
        "relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 border-b border-border py-3 pl-4",
        COLUNAS,
      )}
    >
      <span className={cn("absolute inset-y-3 left-0 w-0.5", MARCA[grupo])} aria-hidden />

      <div className="min-w-0">
        <button onClick={onAbrir} className="block text-left text-sm font-medium leading-snug hover:text-primary">
          {missao.titulo}
        </button>
        <Link
          to={`/projetos/${missao.projeto.id}/board`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {missao.projeto.nome}
        </Link>
        {/* Em tela estreita prazo e checklist vêm aqui, não em colunas. */}
        <div className="mt-1 flex gap-3 sm:hidden">
          <Prazo prazo={missao.prazo} aberta={aberta} />
          {missao.checklist.total > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {missao.checklist.concluidos}/{missao.checklist.total}
            </span>
          )}
        </div>
        {grupo === "devolvidas" && revisao && (
          <p className="mt-1.5 text-xs">
            <span className="text-destructive">
              Devolvida por {revisao.revisor.nome} em {formatDate(revisao.criado_em)}:
            </span>{" "}
            {revisao.comentario ?? "sem comentário"}
          </p>
        )}
      </div>

      <div className="hidden sm:block">
        <Prazo prazo={missao.prazo} aberta={aberta} />
      </div>
      <div className="hidden sm:block">
        <Progresso {...missao.checklist} />
      </div>

      <div className="justify-self-end">
        <Acao
          missao={missao}
          grupo={grupo}
          onIniciar={onIniciar}
          iniciando={iniciando}
          onEntregar={onEntregar}
        />
      </div>
    </li>
  );
}

function Acao({
  missao,
  grupo,
  onIniciar,
  iniciando,
  onEntregar,
}: {
  missao: MinhaMissao;
  grupo: Grupo;
  onIniciar: () => void;
  iniciando: boolean;
  onEntregar: () => void;
}) {
  if (grupo === "iniciar") {
    return (
      <Button size="sm" variant="outline" onClick={onIniciar} disabled={iniciando}>
        {iniciando ? "Iniciando…" : "Iniciar"}
      </Button>
    );
  }
  if ((grupo === "andamento" || grupo === "devolvidas") && missao.status === "EM_ANDAMENTO") {
    return (
      <Button size="sm" onClick={onEntregar}>
        {grupo === "devolvidas" ? "Entregar correção" : "Entregar"}
      </Button>
    );
  }
  if (grupo === "revisao" && missao.ultima_entrega) {
    return <span className="text-xs text-muted-foreground">Entregue em {formatDate(missao.ultima_entrega.criado_em)}</span>;
  }
  if (grupo === "concluidas" && missao.ultima_entrega?.revisao) {
    return (
      <span className="text-xs text-muted-foreground">
        Aprovada em {formatDate(missao.ultima_entrega.revisao.criado_em)}
      </span>
    );
  }
  return null;
}

function Prazo({ prazo, aberta }: { prazo: string | null; aberta: boolean }) {
  if (!prazo) return <span className="text-xs text-muted-foreground">Sem prazo</span>;
  const data = formatDateOnly(prazo);
  if (!aberta) return <span className="text-xs text-muted-foreground">{data}</span>;
  const dias = diasAtePrazo(prazo);
  if (dias < 0) return <span className="text-xs font-medium text-destructive">Atrasada · {data}</span>;
  if (dias === 0) return <span className="text-xs font-medium text-status-in-review">Vence hoje</span>;
  if (dias <= 2) {
    return (
      <span className="text-xs font-medium text-status-in-review">
        Vence em {dias} {dias === 1 ? "dia" : "dias"}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{data}</span>;
}

function Progresso({ total, concluidos }: { total: number; concluidos: number }) {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div title={`${concluidos} de ${total} itens do checklist`}>
      <span className="font-mono text-xs">
        {concluidos}/{total}
      </span>
      <div className="mt-1 h-0.5 w-16 bg-border">
        <div className="h-full bg-primary" style={{ width: `${(concluidos / total) * 100}%` }} />
      </div>
    </div>
  );
}
