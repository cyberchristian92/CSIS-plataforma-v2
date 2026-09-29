import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, Filter, FoldHorizontal, MoreHorizontal, Trash2, Upload, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Coluna, Missao, MissaoLabel, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { CartaoMissao } from "@/components/CartaoMissao";
import {
  ComposerCartao,
  ComposerLista,
  ListaRecolhida,
  TituloEditavel,
  useListasRecolhidas,
} from "@/components/quadro/trello";
import { MissionDialog } from "@/components/MissionDialog";

// Board Kanban livre — tão amplo quanto o Trello: colunas e cards podem ser
// reorganizados sem restrição visual. Mover um card aqui só atualiza a
// posição organizacional (coluna_id/ordem); nunca aciona aprovação/reprovação
// de uma Entrega — essas transições continuam sendo ações explícitas em outro
// lugar da interface, validadas no servidor (ver backend/prisma/schema.prisma
// e o Cap. 4 do TCC sobre segregação de funções).

function FiltroBoard({
  busca,
  onBuscaChange,
  labelsDisponiveis,
  labelsSelecionadas,
  onLabelsChange,
  responsaveisDisponiveis,
  responsaveisSelecionados,
  onResponsaveisChange,
  onLimpar,
}: {
  busca: string;
  onBuscaChange: (v: string) => void;
  labelsDisponiveis: MissaoLabel[];
  labelsSelecionadas: string[];
  onLabelsChange: (ids: string[]) => void;
  responsaveisDisponiveis: User[];
  responsaveisSelecionados: string[];
  onResponsaveisChange: (ids: string[]) => void;
  onLimpar: () => void;
}) {
  const totalAtivos = (busca.trim() ? 1 : 0) + labelsSelecionadas.length + responsaveisSelecionados.length;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Input
        value={busca}
        onChange={(e) => onBuscaChange(e.target.value)}
        placeholder="Buscar missão…"
        className="h-8 max-w-[220px]"
      />
      <FiltroDropdown
        rotulo="Labels"
        opcoes={labelsDisponiveis.map((l) => ({ id: l.id, nome: l.nome, cor: l.cor }))}
        selecionados={labelsSelecionadas}
        onChange={onLabelsChange}
      />
      <FiltroDropdown
        rotulo="Responsável"
        opcoes={responsaveisDisponiveis.map((u) => ({ id: u.id, nome: u.nome }))}
        selecionados={responsaveisSelecionados}
        onChange={onResponsaveisChange}
      />
      {totalAtivos > 0 && (
        <button onClick={onLimpar} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" /> Limpar filtros ({totalAtivos})
        </button>
      )}
    </div>
  );
}

function FiltroDropdown({
  rotulo,
  opcoes,
  selecionados,
  onChange,
}: {
  rotulo: string;
  opcoes: { id: string; nome: string; cor?: string }[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function onClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, [aberto]);

  function alternar(id: string) {
    onChange(selecionados.includes(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id]);
  }

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant={selecionados.length > 0 ? "secondary" : "ghost"} onClick={() => setAberto((v) => !v)}>
        <Filter className="h-3.5 w-3.5" />
        {rotulo}
        {selecionados.length > 0 && <Badge variant="outline" className="px-1 py-0 text-[10px]">{selecionados.length}</Badge>}
        <ChevronDown className="h-3 w-3" />
      </Button>
      {aberto && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {opcoes.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Nada disponível.</p>
          ) : (
            opcoes.map((op) => (
              <label
                key={op.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selecionados.includes(op.id)}
                  onChange={() => alternar(op.id)}
                  className="h-3.5 w-3.5"
                />
                {op.cor && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: op.cor }} />}
                <span className="truncate">{op.nome}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function BoardPage() {
  const { projetoId = "" } = useParams();
  const qc = useQueryClient();
  const [activeMissao, setActiveMissao] = useState<Missao | null>(null);
  const [activeColuna, setActiveColuna] = useState<Coluna | null>(null);
  const [colunaEditando, setColunaEditando] = useState<Coluna | null>(null);
  const [missaoAberta, setMissaoAberta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { user } = useAuth();
  const podeGerenciarMissoes = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";
  const { ask: confirmar, dialog: confirmDialog } = useConfirmDialog();
  const inputSincronizarRef = useRef<HTMLInputElement>(null);
  const [resultadoSync, setResultadoSync] = useState<{
    sucesso: boolean;
    mensagem: string;
    avisos?: string[];
  } | null>(null);
  const [busca, setBusca] = useState("");
  const [labelsFiltro, setLabelsFiltro] = useState<string[]>([]);
  const [responsaveisFiltro, setResponsaveisFiltro] = useState<string[]>([]);
  const [recolhidas, alternarRecolhida] = useListasRecolhidas(`csis.quadro.${projetoId}.recolhidas`);

  const { data: colunasBrutas } = useQuery({
    queryKey: ["colunas", projetoId],
    queryFn: () => api.colunas.listarPorProjeto(projetoId),
    enabled: !!projetoId,
  });
  const colunas = colunasBrutas ? [...colunasBrutas].sort((a, b) => a.ordem - b.ordem) : undefined;

  const { data: missoes } = useQuery({
    queryKey: ["missoes", projetoId],
    queryFn: () => api.missoes.listarPorProjeto(projetoId),
    enabled: !!projetoId,
  });

  const { data: labelsProjeto } = useQuery({
    queryKey: ["missao-labels", projetoId],
    queryFn: () => api.missaoLabels.listarPorProjeto(projetoId),
    enabled: !!projetoId,
  });

  const responsaveisDisponiveis: User[] = [];
  const vistos = new Set<string>();
  for (const m of missoes ?? []) {
    for (const r of m.responsaveis ?? []) {
      if (!vistos.has(r.user.id)) {
        vistos.add(r.user.id);
        responsaveisDisponiveis.push(r.user);
      }
    }
  }
  responsaveisDisponiveis.sort((a, b) => a.nome.localeCompare(b.nome));

  const filtroAtivo = busca.trim().length > 0 || labelsFiltro.length > 0 || responsaveisFiltro.length > 0;
  const buscaNormalizada = busca.trim().toLowerCase();
  const missoesFiltradas = (missoes ?? []).filter((m) => {
    if (buscaNormalizada && !m.titulo.toLowerCase().includes(buscaNormalizada)) return false;
    if (labelsFiltro.length > 0 && !m.labels?.some((l) => labelsFiltro.includes(l.label.id))) return false;
    if (responsaveisFiltro.length > 0 && !m.responsaveis?.some((r) => responsaveisFiltro.includes(r.user.id))) return false;
    return true;
  });

  function mostrarErro(e: unknown, padrao: string) {
    setErro(e instanceof ApiError ? e.message : padrao);
  }

  const mover = useMutation({
    mutationFn: ({ id, colunaId, ordem }: { id: string; colunaId: string | null; ordem: number }) =>
      api.missoes.mover(id, colunaId, ordem),
    onMutate: async ({ id, colunaId, ordem }) => {
      await qc.cancelQueries({ queryKey: ["missoes", projetoId] });
      const anteriores = qc.getQueryData<Missao[]>(["missoes", projetoId]);
      qc.setQueryData<Missao[]>(["missoes", projetoId], (old) =>
        old?.map((m) => (m.id === id ? { ...m, coluna_id: colunaId, ordem } : m)),
      );
      return { anteriores };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.anteriores) qc.setQueryData(["missoes", projetoId], ctx.anteriores);
      mostrarErro(e, "Não foi possível mover o cartão.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["missoes", projetoId] }),
  });

  // Arrastar lista: a nova ordem aparece na hora e é gravada em seguida.
  const reordenarColunas = useMutation({
    mutationFn: (ids: string[]) => api.colunas.reordenar(projetoId, ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["colunas", projetoId] });
      const anteriores = qc.getQueryData<Coluna[]>(["colunas", projetoId]);
      qc.setQueryData<Coluna[]>(["colunas", projetoId], (old) =>
        old?.map((c) => ({ ...c, ordem: ids.indexOf(c.id) })),
      );
      return { anteriores };
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.anteriores) qc.setQueryData(["colunas", projetoId], ctx.anteriores);
      mostrarErro(e, "Não foi possível reordenar as listas.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["colunas", projetoId] }),
  });

  async function criarColuna(nome: string) {
    try {
      await api.colunas.criar(projetoId, nome);
      await qc.invalidateQueries({ queryKey: ["colunas", projetoId] });
    } catch (e) {
      mostrarErro(e, "Não foi possível criar a lista.");
    }
  }

  async function criarMissao(colunaId: string, titulo: string) {
    try {
      await api.missoes.criar(projetoId, { titulo, colunaId });
      await qc.invalidateQueries({ queryKey: ["missoes", projetoId] });
    } catch (e) {
      mostrarErro(e, "Não foi possível criar o cartão.");
    }
  }

  async function renomearColuna(coluna: Coluna, nome: string) {
    try {
      await api.colunas.atualizar(coluna.id, { nome });
      await qc.invalidateQueries({ queryKey: ["colunas", projetoId] });
    } catch (e) {
      mostrarErro(e, "Não foi possível renomear a lista.");
    }
  }

  // Círculo de concluir do card: concluída = Aprovada (fica na auditoria).
  async function alternarConcluida(missao: Missao) {
    const destino = missao.status === "APROVADA" ? "EM_ANDAMENTO" : "APROVADA";
    const anteriores = qc.getQueryData<Missao[]>(["missoes", projetoId]);
    qc.setQueryData<Missao[]>(["missoes", projetoId], (old) =>
      old?.map((m) => (m.id === missao.id ? { ...m, status: destino } : m)),
    );
    try {
      await api.missoes.mudarStatus(missao.id, destino);
    } catch (e) {
      qc.setQueryData(["missoes", projetoId], anteriores);
      mostrarErro(e, "Não foi possível mudar a missão.");
    } finally {
      qc.invalidateQueries({ queryKey: ["missoes", projetoId] });
      qc.invalidateQueries({ queryKey: ["missoes-minhas"] });
    }
  }

  const removerMissao = useMutation({
    mutationFn: (id: string) => api.missoes.remover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes", projetoId] }),
  });

  // Reenvia um pacote baixado via "Exportar" (e editado localmente — ver
  // COMO_SINCRONIZAR.md dentro do próprio zip) pra criar, dentro deste mesmo
  // projeto, só o que é novo (missão sem id, documento sem id, arquivo sem
  // id no manifesto.json). Nunca mexe no que já existe.
  const sincronizar = useMutation({
    mutationFn: (arquivo: File) => api.projetos.sincronizar(projetoId, arquivo),
    onSuccess: (resultado) => {
      qc.invalidateQueries({ queryKey: ["missoes", projetoId] });
      const partes = [
        resultado.missoes_criadas > 0 ? `${resultado.missoes_criadas} missão(ões)` : null,
        resultado.documentos_criados > 0 ? `${resultado.documentos_criados} documento(s)` : null,
        resultado.arquivos_criados > 0 ? `${resultado.arquivos_criados} arquivo(s)` : null,
      ].filter(Boolean);
      setResultadoSync({
        sucesso: true,
        mensagem: partes.length > 0 ? `Sincronizado: ${partes.join(", ")} adicionado(s).` : "Pacote sincronizado — nada de novo pra adicionar.",
        avisos: resultado.avisos,
      });
    },
    onError: (e: unknown) =>
      setResultadoSync({ sucesso: false, mensagem: e instanceof ApiError ? e.message : "Falha ao sincronizar o pacote." }),
  });

  async function pedirExclusaoMissao(missao: Missao) {
    const ok = await confirmar({
      titulo: `Excluir "${missao.titulo}"?`,
      descricao: "Apaga a missão e tudo dentro dela (arquivos, checklist, comentários, entregas). Não pode ser desfeito.",
      textoConfirmar: "Excluir missão",
      destrutivo: true,
    });
    if (ok) removerMissao.mutate(missao.id);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Ids de arrasto: listas levam o prefixo "coluna:"; cards, o id da missão.
  // A área de cards de cada lista é soltável com o id puro da coluna.
  function colunaDoAlvo(alvo: string): string | null {
    if (alvo.startsWith(PREFIXO_LISTA)) return alvo.slice(PREFIXO_LISTA.length);
    if (alvo === SEM_COLUNA) return null;
    if (colunas?.some((c) => c.id === alvo)) return alvo;
    return missoes?.find((m) => m.id === alvo)?.coluna_id ?? null;
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith(PREFIXO_LISTA)) {
      setActiveColuna(colunas?.find((c) => c.id === id.slice(PREFIXO_LISTA.length)) ?? null);
      return;
    }
    setActiveMissao(missoes?.find((m) => m.id === id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveMissao(null);
    setActiveColuna(null);
    const { active, over } = e;
    if (!over || !missoes || !colunas) return;
    const ativo = String(active.id);
    const alvo = String(over.id);

    if (ativo.startsWith(PREFIXO_LISTA)) {
      const origem = ativo.slice(PREFIXO_LISTA.length);
      const destino = colunaDoAlvo(alvo);
      if (!destino || destino === origem) return;
      const ids = colunas.map((c) => c.id);
      reordenarColunas.mutate(arrayMove(ids, ids.indexOf(origem), ids.indexOf(destino)));
      return;
    }

    const missao = missoes.find((m) => m.id === ativo);
    if (!missao) return;
    const overMissao = missoes.find((m) => m.id === alvo);
    const destinoColunaId = colunaDoAlvo(alvo);
    const irmaos = missoes
      .filter((m) => m.coluna_id === destinoColunaId && m.id !== missao.id)
      .sort((a, b) => a.ordem - b.ordem);

    let novaOrdem = irmaos.length;
    if (overMissao) {
      const idx = irmaos.findIndex((m) => m.id === overMissao.id);
      novaOrdem = idx === -1 ? irmaos.length : idx;
    }

    if (missao.coluna_id === destinoColunaId && missao.ordem === novaOrdem) return;
    mover.mutate({ id: missao.id, colunaId: destinoColunaId, ordem: novaOrdem });
  }

  const semColuna = missoesFiltradas.filter((m) => !m.coluna_id);
  const acoesCartao = {
    onAbrirMissao: setMissaoAberta,
    onExcluirMissao: podeGerenciarMissoes ? pedirExclusaoMissao : undefined,
    onAlternarConcluida: alternarConcluida,
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <FiltroBoard
          busca={busca}
          onBuscaChange={setBusca}
          labelsDisponiveis={labelsProjeto ?? []}
          labelsSelecionadas={labelsFiltro}
          onLabelsChange={setLabelsFiltro}
          responsaveisDisponiveis={responsaveisDisponiveis}
          responsaveisSelecionados={responsaveisFiltro}
          onResponsaveisChange={setResponsaveisFiltro}
          onLimpar={() => {
            setBusca("");
            setLabelsFiltro([]);
            setResponsaveisFiltro([]);
          }}
        />
        {podeGerenciarMissoes && (
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={inputSincronizarRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) sincronizar.mutate(arquivo);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              title="Envia de volta um pacote baixado em Projetos (Exportar) — cria só o que for novo, sem duplicar o que já existe"
              onClick={() => inputSincronizarRef.current?.click()}
              disabled={sincronizar.isPending}
            >
              <Upload className="h-4 w-4" /> {sincronizar.isPending ? "Sincronizando…" : "Sincronizar do computador"}
            </Button>
          </div>
        )}
      </div>

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro(null)} className="hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {filtroAtivo && missoesFiltradas.length === 0 && (missoes?.length ?? 0) > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">Nenhuma missão corresponde ao filtro atual.</p>
      )}

      {resultadoSync && (
        <div
          className={cn(
            "mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
            resultadoSync.sucesso ? "border-status-approved/40 bg-status-approved/10" : "border-destructive/40 bg-destructive/10",
          )}
        >
          {resultadoSync.sucesso ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-approved" />
          ) : (
            <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <p className={resultadoSync.sucesso ? "font-medium" : "font-medium text-destructive"}>{resultadoSync.mensagem}</p>
            {resultadoSync.avisos && resultadoSync.avisos.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {resultadoSync.avisos.map((aviso, i) => (
                  <li key={i}>{aviso}</li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={() => setResultadoSync(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 items-start gap-3 overflow-x-auto pb-4">
          <SortableContext items={(colunas ?? []).map((c) => PREFIXO_LISTA + c.id)} strategy={horizontalListSortingStrategy}>
            {colunas?.map((coluna) => (
              <ColunaColumn
                key={coluna.id}
                coluna={coluna}
                missoes={missoesFiltradas.filter((m) => m.coluna_id === coluna.id).sort((a, b) => a.ordem - b.ordem)}
                recolhida={recolhidas.has(coluna.id)}
                onAlternarRecolhida={() => alternarRecolhida(coluna.id)}
                onNovaMissao={podeGerenciarMissoes ? (titulo) => criarMissao(coluna.id, titulo) : undefined}
                onRenomear={(nome) => void renomearColuna(coluna, nome)}
                onEditar={() => setColunaEditando(coluna)}
                {...acoesCartao}
              />
            ))}
          </SortableContext>

          {semColuna.length > 0 && (
            <ColunaColumn
              coluna={{ id: SEM_COLUNA, nome: "Sem coluna", ordem: -1, limite_wip: null, projeto_id: projetoId }}
              missoes={semColuna}
              recolhida={recolhidas.has(SEM_COLUNA)}
              onAlternarRecolhida={() => alternarRecolhida(SEM_COLUNA)}
              onNovaMissao={undefined}
              {...acoesCartao}
            />
          )}

          <ComposerLista onAdicionar={criarColuna} />
        </div>

        <DragOverlay>
          {activeMissao && <MissaoCard missao={activeMissao} overlay />}
          {activeColuna && (
            <div className="w-[272px] rotate-2 rounded-xl bg-muted p-3 text-sm font-semibold shadow-lg">{activeColuna.nome}</div>
          )}
        </DragOverlay>
      </DndContext>

      <EditarColunaDialog coluna={colunaEditando} onClose={() => setColunaEditando(null)} />
      <MissionDialog missaoId={missaoAberta} onClose={() => setMissaoAberta(null)} />
      {confirmDialog}
    </div>
  );
}

const PREFIXO_LISTA = "coluna:";
const SEM_COLUNA = "__sem_coluna__";

function ColunaColumn({
  coluna,
  missoes,
  recolhida,
  onAlternarRecolhida,
  onNovaMissao,
  onRenomear,
  onEditar,
  onAbrirMissao,
  onExcluirMissao,
  onAlternarConcluida,
}: {
  coluna: Coluna;
  missoes: Missao[];
  recolhida: boolean;
  onAlternarRecolhida: () => void;
  onNovaMissao: ((titulo: string) => Promise<unknown>) | undefined;
  onRenomear?: (nome: string) => void;
  onEditar?: () => void;
  onAbrirMissao: (id: string) => void;
  onExcluirMissao: ((missao: Missao) => void) | undefined;
  onAlternarConcluida: (missao: Missao) => void;
}) {
  const editavel = coluna.id !== SEM_COLUNA;
  const lista = useSortable({ id: PREFIXO_LISTA + coluna.id, disabled: !editavel });
  const { setNodeRef: areaCartoes, isOver } = useDroppable({ id: coluna.id });
  const acimaDoLimite = !!coluna.limite_wip && missoes.length > coluna.limite_wip;
  const estilo = { transform: CSS.Translate.toString(lista.transform), transition: lista.transition };

  if (recolhida) {
    return (
      <div ref={lista.setNodeRef} style={estilo} {...lista.attributes} {...lista.listeners} className="self-start">
        <ListaRecolhida titulo={coluna.nome} total={missoes.length} onExpandir={onAlternarRecolhida} destaque={acimaDoLimite} />
      </div>
    );
  }

  return (
    <div
      ref={lista.setNodeRef}
      style={estilo}
      className={cn(
        // Lista no formato do Trello: largura fixa, fundo próprio, cantos
        // arredondados; amarela quando passa do limite de cartões.
        "flex max-h-full w-[272px] shrink-0 flex-col rounded-xl bg-muted/60 p-2",
        acimaDoLimite && "bg-amber-200/70 dark:bg-amber-500/20",
        lista.isDragging && "opacity-40",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div
        {...lista.attributes}
        {...lista.listeners}
        className={cn("mb-2 flex items-center gap-2 px-1.5 pt-0.5", editavel && "cursor-grab active:cursor-grabbing")}
      >
        <TituloEditavel valor={coluna.nome} editavel={editavel && !!onRenomear} onSalvar={(nome) => onRenomear?.(nome)} />
        <span
          className={cn(
            "shrink-0 text-xs text-muted-foreground",
            acimaDoLimite && "rounded bg-amber-400 px-1.5 font-semibold text-black",
          )}
        >
          {missoes.length}
          {coluna.limite_wip ? ` / ${coluna.limite_wip}` : ""}
        </span>
        <div className="ml-auto flex shrink-0 items-center">
          <button
            onClick={onAlternarRecolhida}
            title="Recolher lista"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <FoldHorizontal className="h-3.5 w-3.5" />
          </button>
          {editavel && onEditar && (
            <button
              onClick={onEditar}
              title="Ações da lista"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div ref={areaCartoes} className="flex min-h-2 flex-col gap-2 overflow-y-auto">
        <SortableContext items={missoes.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {missoes.map((missao) => (
            <MissaoCard
              key={missao.id}
              missao={missao}
              onAbrir={() => onAbrirMissao(missao.id)}
              onExcluir={onExcluirMissao ? () => onExcluirMissao(missao) : undefined}
              onAlternarConcluida={() => onAlternarConcluida(missao)}
            />
          ))}
        </SortableContext>
      </div>

      {onNovaMissao && <ComposerCartao onAdicionar={onNovaMissao} />}
    </div>
  );
}

function EditarColunaDialog({ coluna, onClose }: { coluna: Coluna | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [limiteWip, setLimiteWip] = useState("");

  useEffect(() => {
    if (coluna) {
      setNome(coluna.nome);
      setLimiteWip(coluna.limite_wip?.toString() ?? "");
    }
  }, [coluna]);

  const salvar = useMutation({
    mutationFn: () =>
      api.colunas.atualizar(coluna!.id, { nome, limiteWip: limiteWip.trim() ? Number(limiteWip) : null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colunas", coluna?.projeto_id] });
      onClose();
    },
  });

  const remover = useMutation({
    mutationFn: () => api.colunas.remover(coluna!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colunas", coluna?.projeto_id] });
      qc.invalidateQueries({ queryKey: ["missoes", coluna?.projeto_id] });
      onClose();
    },
  });

  return (
    <Dialog open={!!coluna} onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold">Editar coluna</h2>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Limite de WIP (vazio = sem limite)</label>
          <Input type="number" min={1} value={limiteWip} onChange={(e) => setLimiteWip(e.target.value)} />
        </div>
        <div className="mt-2 flex justify-between">
          <Button variant="destructive" size="sm" onClick={() => remover.mutate()}>
            Excluir coluna
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={!nome.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

const STATUS_LABEL: Record<Missao["status"], string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  EM_REVISAO: "Em revisão",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
};

const STATUS_VARIANT: Record<Missao["status"], "secondary" | "outline" | "default" | "destructive"> = {
  PENDENTE: "outline",
  EM_ANDAMENTO: "secondary",
  EM_REVISAO: "default",
  APROVADA: "secondary",
  REJEITADA: "destructive",
};

function MissaoCard({
  missao,
  overlay,
  onAbrir,
  onExcluir,
  onAlternarConcluida,
}: {
  missao: Missao;
  overlay?: boolean;
  onAbrir?: () => void;
  onExcluir?: () => void;
  onAlternarConcluida?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: missao.id });

  return (
    <CartaoMissao
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : { transform: CSS.Transform.toString(transform), transition }}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={overlay ? undefined : onAbrir}
      missao={missao}
      // As colunas deste quadro são livres: o status oficial vai no card.
      status={<Badge variant={STATUS_VARIANT[missao.status]}>{STATUS_LABEL[missao.status]}</Badge>}
      arrastando={isDragging}
      sobreposto={overlay}
      onAlternarConcluida={overlay ? undefined : onAlternarConcluida}
      acoesHover={
        onExcluir && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExcluir();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Excluir missão"
            className="rounded bg-card/90 p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )
      }
    />
  );
}
