import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function ProjectOverviewPage() {
  const { projetoId = "" } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const podeRecalcular = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";

  const { data: projeto } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: () => api.projetos.buscar(projetoId),
    enabled: !!projetoId,
  });
  const { data: missoes } = useQuery({
    queryKey: ["missoes", projetoId],
    queryFn: () => api.missoes.listarPorProjeto(projetoId),
    enabled: !!projetoId,
  });
  const { data: integridade } = useQuery({
    queryKey: ["integridade", "projeto", projetoId],
    queryFn: () => api.integridade.consultar("projeto", projetoId),
    enabled: !!projetoId,
  });

  // Recalcular aqui roda a varredura completa (todo o Workspace) — ainda não
  // há um recálculo isolado por projeto, então o botão serve tanto pra
  // "atualizar o selo deste projeto" quanto pra populamento geral (ver
  // docs/adr/0002-motor-de-integridade-sem-daemon-ipfs.md).
  const recalcular = useMutation({
    mutationFn: api.integridade.recalcularTudo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integridade"] }),
  });

  if (!projeto) return null;

  return (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardContent className="p-5">
          <h2 className="mb-3 text-base font-semibold">Descrição</h2>
          <p className="text-sm text-muted-foreground">{projeto.descricao || "Sem descrição."}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-medium text-primary">{projeto.status}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Prazo</p>
            <p className="font-medium">{projeto.prazo ? formatDate(projeto.prazo) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Missões</p>
            <p className="font-medium">{missoes?.length ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-3">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Integridade
            </h2>
            {podeRecalcular && (
              <Button size="sm" variant="outline" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
                <RefreshCw className={`h-3.5 w-3.5 ${recalcular.isPending ? "animate-spin" : ""}`} />
                Recalcular
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Hash agregado (CID) de todo o conteúdo deste projeto — pastas, arquivos, documentos e missões. Muda
            automaticamente a qualquer alteração; qualquer adulteração fora da plataforma quebraria essa cadeia.
          </p>
          <p className="mt-2 break-all font-mono text-xs text-foreground">
            {integridade?.ipfs_cid ?? "Ainda não calculado — clique em Recalcular."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
