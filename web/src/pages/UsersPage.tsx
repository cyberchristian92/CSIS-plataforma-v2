import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function UsersPage() {
  const { data: usuarios } = useQuery({ queryKey: ["usuarios"], queryFn: api.auth.listarUsuarios });

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Gestão de Usuários</h1>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Papel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usuarios?.map((u) => (
              <tr key={u.id} className="hover:bg-accent/50">
                <td className="flex items-center gap-2 px-4 py-3">
                  <Avatar nome={u.nome} />
                  {u.nome}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{u.papel_global}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
