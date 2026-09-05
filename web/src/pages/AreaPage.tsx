import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileExplorer } from "@/components/FileExplorer";
import { cn } from "@/lib/utils";

// Página de uma Área específica ("Marketing" etc): reúne os projetos dessa
// área e sua própria pasta de arquivos — é exatamente o "dentro aparece
// todos os projetos relacionados a marketing" que o usuário pediu, sem
// precisar de uma árvore Workspace>Área>Projeto tipo Drive.
export default function AreaPage() {
  const { areaId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [aba, setAba] = useState<"projetos" | "arquivos">("projetos");
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");

  const { data: areas } = useQuery({ queryKey: ["areas-todas"], queryFn: api.areas.listarTodas });
  const area = areas?.find((a) => a.id === areaId);

  const { data: projetos } = useQuery({
    queryKey: ["projetos-area", areaId],
    queryFn: () => api.projetos.listarPorArea(areaId),
    enabled: !!areaId,
  });

  const criarProjeto = useMutation({
    mutationFn: () => api.projetos.criar(areaId, nome),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projetos-area", areaId] });
      setOpen(false);
      setNome("");
    },
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 pt-5">
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => navigate("/areas")} className="hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button onClick={() => navigate("/areas")} className="hover:text-foreground">
            Áreas
          </button>
          <span>›</span>
          <span className="font-medium text-primary">{area?.nome}</span>
          {area && <Badge variant="outline">{area.tipo}</Badge>}
        </div>
        <div className="flex gap-6">
          <TabButton active={aba === "projetos"} onClick={() => setAba("projetos")}>
            Projetos
          </TabButton>
          <TabButton active={aba === "arquivos"} onClick={() => setAba("arquivos")}>
            Arquivos da Área
          </TabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {aba === "projetos" && (
          <>
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Novo Projeto
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projetos?.map((p) => (
                <Link key={p.id} to={`/projetos/${p.id}`}>
                  <Card className="h-full hover:border-primary/40">
                    <CardContent className="p-4">
                      <p className="font-medium">{p.nome}</p>
                      <Badge variant="outline" className="mt-2">
                        {p.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {projetos?.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum projeto nesta área ainda.</p>
              )}
            </div>
          </>
        )}

        {aba === "arquivos" && areaId && <FileExplorer scope={{ type: "area", id: areaId }} />}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <h2 className="mb-4 text-xl font-bold">Novo Projeto em {area?.nome}</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!nome || criarProjeto.isPending} onClick={() => criarProjeto.mutate()}>
              {criarProjeto.isPending ? "Criando…" : "Criar Projeto"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border-b-2 border-transparent pb-3 text-sm font-medium text-muted-foreground hover:text-foreground",
        active && "border-primary text-primary",
      )}
    >
      {children}
    </button>
  );
}
