import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MinhaMissao } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AcaoMissao, AvisoDevolvida, Prazo, Progresso, ehDevolvida, prazoConta } from "./comum";

// Visão em lista de "Minhas Missões" (alternativa ao quadro): agrupada pelo
// que a pessoa precisa fazer, devolvidas primeiro.

type Grupo = "devolvidas" | "andamento" | "iniciar" | "revisao" | "concluidas";

const GRUPOS: { id: Grupo; titulo: string; marca: string }[] = [
  { id: "devolvidas", titulo: "Devolvidas para correção", marca: "bg-destructive" },
  { id: "andamento", titulo: "Em andamento", marca: "bg-status-in-progress" },
  { id: "iniciar", titulo: "A iniciar", marca: "bg-status-pending" },
  { id: "revisao", titulo: "Aguardando revisão", marca: "bg-status-in-review" },
  { id: "concluidas", titulo: "Concluídas", marca: "bg-status-approved" },
];

const MARCA = Object.fromEntries(GRUPOS.map((g) => [g.id, g.marca])) as Record<Grupo, string>;

// Colunas da linha em telas médias pra cima: missão | prazo | checklist | ação.
const COLUNAS = "sm:grid-cols-[minmax(0,1fr)_8.5rem_5.5rem_10rem]";

function grupoDe(m: MinhaMissao): Grupo {
  if (ehDevolvida(m)) return "devolvidas";
  if (m.status === "EM_ANDAMENTO") return "andamento";
  if (m.status === "PENDENTE") return "iniciar";
  if (m.status === "EM_REVISAO") return "revisao";
  return "concluidas";
}

export function ListaMissoes({
  missoes,
  onAbrir,
  onIniciar,
  iniciandoId,
  onEntregar,
}: {
  missoes: MinhaMissao[];
  onAbrir: (id: string) => void;
  onIniciar: (id: string) => void;
  iniciandoId: string | null;
  onEntregar: (m: MinhaMissao) => void;
}) {
  const [verConcluidas, setVerConcluidas] = useState(false);

  const porGrupo: Record<Grupo, MinhaMissao[]> = { devolvidas: [], andamento: [], iniciar: [], revisao: [], concluidas: [] };
  for (const m of missoes) porGrupo[grupoDe(m)].push(m);

  return (
    <>
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

      {GRUPOS.map((g) => {
        const lista = porGrupo[g.id];
        if (lista.length === 0) return null;
        const recolhido = g.id === "concluidas" && !verConcluidas;
        return (
          <section key={g.id} className="mb-8">
            <h2 className="flex items-baseline gap-2 pb-2 text-sm font-semibold">
              {g.id === "concluidas" ? (
                <button onClick={() => setVerConcluidas((v) => !v)} className="flex items-center gap-1 hover:text-primary">
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
                  <li
                    key={m.id}
                    className={cn(
                      "relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 border-b border-border py-3 pl-4",
                      COLUNAS,
                    )}
                  >
                    <span className={cn("absolute inset-y-3 left-0 w-0.5", MARCA[g.id])} aria-hidden />
                    <div className="min-w-0">
                      <button
                        onClick={() => onAbrir(m.id)}
                        className="block text-left text-sm font-medium leading-snug hover:text-primary"
                      >
                        {m.titulo}
                      </button>
                      <Link to={`/projetos/${m.projeto.id}/board`} className="text-xs text-muted-foreground hover:text-foreground">
                        {m.projeto.nome}
                      </Link>
                      {/* Em tela estreita prazo e checklist vêm aqui, não em colunas. */}
                      <div className="mt-1 flex gap-3 sm:hidden">
                        <Prazo prazo={m.prazo} aberta={prazoConta(m)} />
                        {m.checklist.total > 0 && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {m.checklist.concluidos}/{m.checklist.total}
                          </span>
                        )}
                      </div>
                      <AvisoDevolvida missao={m} className="mt-1.5" />
                    </div>
                    <div className="hidden sm:block">
                      <Prazo prazo={m.prazo} aberta={prazoConta(m)} />
                    </div>
                    <div className="hidden sm:block">
                      <Progresso {...m.checklist} />
                    </div>
                    <div className="justify-self-end">
                      <AcaoMissao
                        missao={m}
                        onIniciar={() => onIniciar(m.id)}
                        iniciando={iniciandoId === m.id}
                        onEntregar={() => onEntregar(m)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
