import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = { ATIVO: "ATIVO", ARQUIVADO: "ARQUIVADO", CONCLUIDO: "CONCLUÍDO" };

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [areaId, setAreaId] = useState("");

  const { data: projetos, isFetching } = useQuery({ queryKey: ["projetos-todos"], queryFn: api.projetos.listarTodos });
  const { data: areas } = useQuery({ queryKey: ["areas-todas"], queryFn: api.areas.listarTodas });
  const { data: missoesPorProjeto } = useQuery({
    queryKey: ["missoes-contagem", projetos?.map((p) => p.id)],
    queryFn: async () => {
      const entries = await Promise.all(
        (projetos ?? []).map(async (p) => [p.id, (await api.missoes.listarPorProjeto(p.id)).length] as const),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    enabled: !!projetos,
  });

  const ativos = (projetos ?? []).filter((p) => p.status === "ATIVO");
  const areaDefault = areaId || areas?.[0]?.id || "";

  const criar = useMutation({
    mutationFn: () => api.projetos.criar(areaDefault, nome, descricao || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projetos-todos"] });
      setOpen(false);
      setNome("");
      setDescricao("");
    },
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projetos</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["projetos-todos"] })}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Projeto
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Prazo</th>
              <th className="px-4 py-3 font-medium">Missões</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ativos.map((p) => (
              <tr key={p.id} className="hover:bg-accent/50">
                <td className="px-4 py-3">
                  <Link to={`/projetos/${p.id}`} className="font-medium text-foreground hover:text-primary">
                    {p.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-primary">{STATUS_LABEL[p.status]}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.prazo ? formatDate(p.prazo) : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{missoesPorProjeto?.[p.id] ?? 0} mis.</td>
              </tr>
            ))}
            {ativos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum projeto ativo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <h2 className="mb-4 text-xl font-bold">Novo Projeto</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome do Projeto</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {(areas?.length ?? 0) > 1 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Área</label>
              <select
                value={areaDefault}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {areas?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!nome || !areaDefault || criar.isPending} onClick={() => criar.mutate()}>
              {criar.isPending ? "Criando…" : "Criar Projeto"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
