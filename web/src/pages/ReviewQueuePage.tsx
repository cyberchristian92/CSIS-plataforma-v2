import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MissionDialog } from "@/components/MissionDialog";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { BotaoAutoaprovar } from "@/components/Autoaprovacao";
import { useMotivoRejeicao } from "@/components/MotivoRejeicao";

// Fila de Revisão — só ADMIN/LIDER/REVISOR (ver Sidebar.tsx e o gate de rota
// em App.tsx). Segregação de Funções: quem executou a missão não revisa pelo
// caminho normal — o servidor aplica a regra; aqui só mostramos, no lugar dos
// botões, a exceção prevista no TCC (autoaprovação com justificativa).
export default function ReviewQueuePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [missaoAberta, setMissaoAberta] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const { pedir: pedirMotivo, dialog: motivoDialog } = useMotivoRejeicao();

  const { data: missoes } = useQuery({ queryKey: ["missoes-em-revisao"], queryFn: api.missoes.emRevisao });

  const revisar = useMutation({
    mutationFn: ({
      entregaId,
      status,
      comentario,
    }: {
      entregaId: string;
      status: "APROVADO" | "REJEITADO";
      comentario?: string;
    }) => api.revisoes.criar(entregaId, status, comentario),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missoes-em-revisao"] }),
    onError: (e: any, vars) => setErros((prev) => ({ ...prev, [vars.entregaId]: e.message ?? "Falha ao revisar." })),
  });

  async function rejeitar(entregaId: string) {
    const comentario = await pedirMotivo();
    if (comentario) revisar.mutate({ entregaId, status: "REJEITADO", comentario });
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-lg font-semibold">Fila de Revisão</h1>
      <p className="mb-4 text-sm text-muted-foreground">Entregas aguardando aprovação em todos os projetos.</p>

      <div className="flex flex-col gap-3">
        {missoes?.map((m) => {
          const entrega = m.entregas?.[0];
          const executou =
            (!!entrega && entrega.autor_id === user?.id) || !!m.responsaveis?.some((r) => r.user.id === user?.id);
          return (
            <Card key={m.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
                <div>
                  <CardTitle className="cursor-pointer hover:text-primary" onClick={() => setMissaoAberta(m.id)}>
                    {m.titulo}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.projeto?.nome} · enviado por {entrega?.autor?.nome} em{" "}
                    {entrega ? formatDate(entrega.criado_em) : "—"}
                  </p>
                </div>
                <Badge variant="outline">Em Revisão</Badge>
              </CardHeader>
              {entrega?.conteudo && <CardContent className="pt-0 text-sm">{entrega.conteudo}</CardContent>}
              {executou && (
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  Você executou esta missão — por Segregação de Funções, outra pessoa deve revisá-la.
                </CardContent>
              )}
              {erros[entrega?.id ?? ""] && (
                <CardContent className="pt-0 text-xs text-destructive">{erros[entrega!.id]}</CardContent>
              )}
              {entrega && executou && (
                <CardContent className="pt-0">
                  <BotaoAutoaprovar
                    entregaId={entrega.id}
                    onConcluido={() => qc.invalidateQueries({ queryKey: ["missoes-em-revisao"] })}
                  />
                </CardContent>
              )}
              {entrega && !executou && (
                <CardContent className="flex gap-2 pt-0">
                  <Button
                    size="sm"
                    onClick={() => revisar.mutate({ entregaId: entrega.id, status: "APROVADO" })}
                  >
                    <Check className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => rejeitar(entrega.id)}
                  >
                    <X className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
        {missoes?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma entrega aguardando revisão no momento.</p>
        )}
      </div>

      <MissionDialog missaoId={missaoAberta} onClose={() => setMissaoAberta(null)} />
      {motivoDialog}
    </div>
  );
}
