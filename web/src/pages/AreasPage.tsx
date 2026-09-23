import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

export default function AreasPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const podeGerenciar = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("PERICIA");
  const { ask: confirmar, dialog: confirmDialog } = useConfirmDialog();

  const { data: areas } = useQuery({ queryKey: ["areas-todas"], queryFn: api.areas.listarTodas });
  const { data: workspaces } = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces.listar });

  const criar = useMutation({
    mutationFn: () => api.areas.criar(workspaces![0].id, nome, tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["areas-todas"] });
      setOpen(false);
      setNome("");
    },
  });

  const removerArea = useMutation({
    mutationFn: (id: string) => api.areas.remover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas-todas"] }),
  });

  async function pedirExclusao(nomeArea: string, id: string) {
    const ok = await confirmar({
      titulo: `Excluir a área "${nomeArea}"?`,
      descricao:
        "Isso apaga a área e TODOS os projetos dentro dela — missões, arquivos, pastas, documentos e permissões inclusos. Não pode ser desfeito.",
      textoConfirmar: "Excluir área",
      destrutivo: true,
    });
    if (ok) removerArea.mutate(id);
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Áreas</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nova Área
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {areas?.map((a) => (
          <div key={a.id} className="group relative">
            <Link to={`/areas/${a.id}`}>
              <Card className="h-full hover:border-primary/40">
                <CardContent className="p-4">
                  <p className="font-medium">{a.nome}</p>
                  <Badge variant="outline" className="mt-2">
                    {a.tipo}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
            {podeGerenciar && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  pedirExclusao(a.nome, a.id);
                }}
                className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 hover:bg-background hover:text-destructive group-hover:opacity-100"
                title="Excluir área"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {areas?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma área cadastrada.</p>}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <h2 className="mb-4 text-xl font-bold">Nova Área</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="PERICIA">Perícia Digital</option>
              <option value="MARKETING">Marketing</option>
              <option value="CURSOS">Cursos</option>
              <option value="JURIDICO">Jurídico</option>
            </select>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!nome || criar.isPending} onClick={() => criar.mutate()}>
              {criar.isPending ? "Criando…" : "Criar Área"}
            </Button>
          </div>
        </div>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
