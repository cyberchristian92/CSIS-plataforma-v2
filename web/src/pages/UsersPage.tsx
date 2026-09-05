import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PapelGlobal } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";

const PAPEIS: PapelGlobal[] = ["ADMIN", "LIDER", "REVISOR", "COLABORADOR"];

// Só ADMIN pode conceder o papel ADMIN (a outros ou na criação) — LIDER pode
// convidar e reatribuir os demais papéis, mas nunca promover a ADMIN. Isso é
// decidido no servidor (auth.service.ts); aqui só refletimos a mesma regra
// pra não oferecer uma opção que o backend vai recusar.
export default function UsersPage() {
  const { user: eu } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<PapelGlobal>("COLABORADOR");
  const [erro, setErro] = useState<string | null>(null);

  const { data: usuarios } = useQuery({ queryKey: ["usuarios"], queryFn: api.auth.listarUsuarios });

  const papeisPermitidos = eu?.papel_global === "ADMIN" ? PAPEIS : PAPEIS.filter((p) => p !== "ADMIN");

  const convidar = useMutation({
    mutationFn: () => api.auth.registrar(nome, email, senha, papel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setOpen(false);
      setNome("");
      setEmail("");
      setSenha("");
      setPapel("COLABORADOR");
      setErro(null);
    },
    onError: (e: unknown) => setErro(e instanceof ApiError ? e.message : "Falha ao convidar usuário."),
  });

  const alterarPapel = useMutation({
    mutationFn: ({ id, papelGlobal }: { id: string; papelGlobal: PapelGlobal }) => api.auth.atualizarPapel(id, papelGlobal),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" /> Convidar Usuário
        </Button>
      </div>

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
                  {u.id === eu?.id ? (
                    <span className="text-xs text-muted-foreground">{u.papel_global} (você)</span>
                  ) : (
                    <select
                      value={u.papel_global}
                      onChange={(e) => alterarPapel.mutate({ id: u.id, papelGlobal: e.target.value as PapelGlobal })}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {papeisPermitidos.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      {!papeisPermitidos.includes(u.papel_global) && (
                        <option value={u.papel_global}>{u.papel_global}</option>
                      )}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <h2 className="mb-4 text-xl font-bold">Convidar Usuário</h2>
        {erro && <p className="mb-3 text-xs text-destructive">{erro}</p>}
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Senha provisória</label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Papel</label>
            <select
              value={papel}
              onChange={(e) => setPapel(e.target.value as PapelGlobal)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {papeisPermitidos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!nome || !email || senha.length < 8 || convidar.isPending} onClick={() => convidar.mutate()}>
              {convidar.isPending ? "Convidando…" : "Convidar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
