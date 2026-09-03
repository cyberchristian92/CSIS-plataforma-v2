import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  EM_REVISAO: "Em revisão",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
};

export default function MyMissionsPage() {
  const { data: missoes } = useQuery({ queryKey: ["missoes-minhas"], queryFn: api.missoes.minhas });

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold">Minhas Missões</h1>
      <div className="flex flex-col gap-2">
        {missoes?.map((m) => (
          <Card key={m.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
              <CardTitle>{m.titulo}</CardTitle>
              <Badge variant="secondary">{STATUS_LABEL[m.status]}</Badge>
            </CardHeader>
            {m.descricao && (
              <CardContent className="pt-0 text-sm text-muted-foreground">{m.descricao}</CardContent>
            )}
          </Card>
        ))}
        {missoes?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma missão atribuída a você ainda.</p>}
      </div>
    </div>
  );
}
