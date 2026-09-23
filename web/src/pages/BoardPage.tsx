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
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Check, ChevronDown, Filter, Pencil, Plus, Tag, Trash2, Upload, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Coluna, Missao, MissaoLabel, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { usePromptDialog } from "@/components/ui/prompt-dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn, formatDateOnly } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
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
  const [colunaEditando, setColunaEditando] = useState<Coluna | null>(null);
  const [missaoAberta, setMissaoAberta] = useState<string | null>(null);
  const { user } = useAuth();
  const podeGerenciarMissoes = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";
  const { ask, dialog: promptDialog } = usePromptDialog();
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

  const { data: colunas } = useQuery({
    queryKey: ["colunas", projetoId],
    queryFn: () => api.colunas.listarPorProjeto(projetoId),
    enabled: !!projetoId,
  });

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
    onError: (_err, _vars, ctx) => {
      if (ctx?.anteriores) qc.setQueryData(["missoes", projetoId], ctx.anteriores);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["missoes", projetoId] }),
  });

  const criarColuna = useMutation({
    mutationFn: async () => {
      const nome = await ask("Nome da coluna");
      if (!nome) return Promise.reject(new Error("cancelado"));
      return api.colunas.criar(projetoId, nome);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colunas", projetoId] }),
  });

  const criarMissao = useMutation({
    mutationFn: async (colunaId?: string) => {
      const titulo = await ask("Título da missão");
      if (!titulo) return Promise.reject(new Error("cancelado"));
      return api.missoes.criar(projetoId, { titulo, colunaId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes", projetoId] }),
  });

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

  function onDragStart(e: DragStartEvent) {
    const m = missoes?.find((m) => m.id === e.active.id);
    setActiveMissao(m ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveMissao(null);
    const { active, over } = e;
    if (!over || !missoes) return;

    const missao = missoes.find((m) => m.id === active.id);
    if (!missao) return;

    // over.id é ou o id de uma coluna (drop numa área vazia) ou o id de outro card
    const overColuna = colunas?.find((c) => c.id === over.id);
    const overMissao = missoes.find((m) => m.id === over.id);

    const destinoColunaId = overColuna ? overColuna.id : (overMissao?.coluna_id ?? null);
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
        <div className="flex shrink-0 items-center gap-2">
        {podeGerenciarMissoes && (
          <>
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
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => criarColuna.mutate()}>
          <Plus className="h-4 w-4" /> Nova coluna
        </Button>
        {podeGerenciarMissoes && (
          <Button onClick={() => criarMissao.mutate(colunas?.[0]?.id)}>
            <Plus className="h-4 w-4" /> Nova Missão
          </Button>
        )}
        </div>
      </div>

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
        <div className="flex flex-1 items-start gap-4 overflow-x-auto pb-4">
          {colunas?.map((coluna) => (
            <ColunaColumn
              key={coluna.id}
              coluna={coluna}
              missoes={missoesFiltradas.filter((m) => m.coluna_id === coluna.id).sort((a, b) => a.ordem - b.ordem)}
              onNovaMissao={podeGerenciarMissoes ? () => criarMissao.mutate(coluna.id) : undefined}
              onEditar={() => setColunaEditando(coluna)}
              onAbrirMissao={setMissaoAberta}
              onExcluirMissao={podeGerenciarMissoes ? pedirExclusaoMissao : undefined}
            />
          ))}

          {semColuna.length > 0 && (
            <ColunaColumn
              coluna={{ id: "__sem_coluna__", nome: "Sem coluna", ordem: -1, limite_wip: null, projeto_id: projetoId }}
              missoes={semColuna}
              onNovaMissao={undefined}
              onEditar={() => {}}
              onAbrirMissao={setMissaoAberta}
              onExcluirMissao={podeGerenciarMissoes ? pedirExclusaoMissao : undefined}
            />
          )}
        </div>

        <DragOverlay>{activeMissao && <MissaoCard missao={activeMissao} overlay />}</DragOverlay>
      </DndContext>

      <EditarColunaDialog coluna={colunaEditando} onClose={() => setColunaEditando(null)} />
      <MissionDialog missaoId={missaoAberta} onClose={() => setMissaoAberta(null)} />
      {promptDialog}
      {confirmDialog}
    </div>
  );
}

function ColunaColumn({
  coluna,
  missoes,
  onNovaMissao,
  onEditar,
  onAbrirMissao,
  onExcluirMissao,
}: {
  coluna: Coluna;
  missoes: Missao[];
  onNovaMissao: (() => void) | undefined;
  onEditar: () => void;
  onAbrirMissao: (id: string) => void;
  onExcluirMissao: ((missao: Missao) => void) | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const acimaDoLimite = !!coluna.limite_wip && missoes.length > coluna.limite_wip;
  const editavel = coluna.id !== "__sem_coluna__";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/40 p-2",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{coluna.nome}</span>
          <span className={cn("text-xs text-muted-foreground", acimaDoLimite && "font-semibold text-destructive")}>
            {missoes.length}
            {coluna.limite_wip ? `/${coluna.limite_wip}` : ""}
          </span>
        </div>
        {editavel && (
          <button onClick={onEditar} className="text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <SortableContext items={missoes.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {missoes.map((missao) => (
            <MissaoCard
              key={missao.id}
              missao={missao}
              onAbrir={() => onAbrirMissao(missao.id)}
              onExcluir={onExcluirMissao ? () => onExcluirMissao(missao) : undefined}
            />
          ))}
        </div>
      </SortableContext>

      {onNovaMissao && (
        <button
          onClick={onNovaMissao}
          className="mt-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar missão
        </button>
      )}
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
}: {
  missao: Missao;
  overlay?: boolean;
  onAbrir?: () => void;
  onExcluir?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: missao.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeft: missao.cor_capa ? `3px solid ${missao.cor_capa}` : undefined,
  };

  const atrasada =
    !!missao.prazo && new Date(missao.prazo) < new Date() && !["APROVADA", "REJEITADA"].includes(missao.status);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={overlay ? undefined : onAbrir}
      className={cn(
        "group/card relative cursor-grab rounded-md border border-border bg-card p-2.5 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-lg",
      )}
    >
      {onExcluir && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExcluir();
          }}
          title="Excluir missão"
          className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-destructive group-hover/card:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      {missao.labels && missao.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {missao.labels.map((l) => (
            <span
              key={l.label.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white/90"
              style={{ backgroundColor: l.label.cor }}
            >
              {l.label.nome}
            </span>
          ))}
        </div>
      )}
      <p title={missao.titulo} className="line-clamp-2 pr-5 text-sm font-medium leading-snug">
        {missao.titulo}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={STATUS_VARIANT[missao.status]}>{STATUS_LABEL[missao.status]}</Badge>
        {missao.prazo && (
          <Badge variant="outline" className={cn("gap-1", atrasada && "border-destructive text-destructive")}>
            <Calendar className="h-2.5 w-2.5" /> {formatDateOnly(missao.prazo)}
          </Badge>
        )}
        {missao.tags?.map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1">
            <Tag className="h-2.5 w-2.5" />
            {tag}
          </Badge>
        ))}
      </div>
      {missao.valor_bounty != null && (
        <p className="mt-1.5 text-xs font-medium text-primary">
          R$ {missao.valor_bounty.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}
