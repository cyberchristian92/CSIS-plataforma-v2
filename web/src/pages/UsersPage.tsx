import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PapelGlobal, ResultadoConvite, User } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { SituacaoBadge } from "@/components/SituacaoUsuario";
import { NOME_PAPEL } from "@/lib/papeis";

const PAPEIS: PapelGlobal[] = ["ADMIN", "LIDER", "REVISOR", "COLABORADOR"];

function formatarData(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

// Só ADMIN pode conceder o papel ADMIN (a outros ou na criação) — LIDER pode
// convidar e reatribuir os demais papéis, mas nunca promover a ADMIN nem
// mexer num ADMIN. Isso é decidido no servidor (auth.service.ts); aqui só
// refletimos a mesma regra pra não oferecer uma opção que o backend recusaria.
export default function UsersPage() {
  const { user: eu } = useAuth();
  const qc = useQueryClient();
  const { ask: confirmar, dialog: confirmDialog } = useConfirmDialog();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<PapelGlobal>("COLABORADOR");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoConvite | null>(null);

  const { data: usuarios } = useQuery({ queryKey: ["usuarios"], queryFn: api.auth.listarUsuarios });

  const souAdmin = eu?.papel_global === "ADMIN";
  const papeisPermitidos = souAdmin ? PAPEIS : PAPEIS.filter((p) => p !== "ADMIN");
  const podeGerenciar = (u: User) => u.id !== eu?.id && (souAdmin || u.papel_global !== "ADMIN");

  function fecharConvite() {
    setOpen(false);
    setResultado(null);
    setNome("");
    setEmail("");
    setPapel("COLABORADOR");
    setErro(null);
  }

  const convidar = useMutation({
    mutationFn: () => api.auth.convidar(nome, email, papel),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setErro(null);
      setResultado(r);
    },
    onError: (e: unknown) => setErro(e instanceof ApiError ? e.message : "Falha ao convidar usuário."),
  });

  const reenviar = useMutation({
    mutationFn: (id: string) => api.auth.reenviarConvite(id),
    onSuccess: (r) => {
      setResultado(r);
      setOpen(true);
    },
  });

  const alterarPapel = useMutation({
    mutationFn: ({ id, papelGlobal }: { id: string; papelGlobal: PapelGlobal }) => api.auth.atualizarPapel(id, papelGlobal),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  const definirAtivo = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => api.auth.definirAtivo(id, ativo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  async function alternarAtivo(u: User) {
    const desativar = u.situacao === "ATIVO";
    const ok = await confirmar({
      titulo: desativar ? `Desativar ${u.nome}?` : `Reativar ${u.nome}?`,
      descricao: desativar
        ? "A pessoa perde o acesso na hora (inclusive sessões abertas). Nada é apagado: o nome dela continua nos registros de auditoria, entregas e revisões."
        : "A pessoa volta a conseguir entrar com a senha que já tinha.",
      textoConfirmar: desativar ? "Desativar" : "Reativar",
      destrutivo: desativar,
    });
    if (ok) definirAtivo.mutate({ id: u.id, ativo: !desativar });
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" /> Convidar Usuário
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Papel</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium">Último acesso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usuarios?.map((u) => (
              <tr key={u.id} className="hover:bg-accent/50">
                <td className="flex items-center gap-2 whitespace-nowrap px-4 py-3">
                  <Avatar nome={u.nome} />
                  {u.nome}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  {!podeGerenciar(u) ? (
                    <span className="text-xs text-muted-foreground">
                      {NOME_PAPEL[u.papel_global] ?? u.papel_global}
                      {u.id === eu?.id && " (você)"}
                    </span>
                  ) : (
                    <select
                      value={u.papel_global}
                      onChange={(e) => alterarPapel.mutate({ id: u.id, papelGlobal: e.target.value as PapelGlobal })}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {papeisPermitidos.map((p) => (
                        <option key={p} value={p}>
                          {NOME_PAPEL[p]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  <SituacaoBadge situacao={u.situacao} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatarData(u.ultimo_acesso)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {podeGerenciar(u) && u.situacao === "CONVIDADO" && (
                    <Button variant="ghost" size="sm" disabled={reenviar.isPending} onClick={() => reenviar.mutate(u.id)}>
                      <Mail className="h-3.5 w-3.5" /> Reenviar convite
                    </Button>
                  )}
                  {podeGerenciar(u) && (u.situacao === "ATIVO" || u.situacao === "DESATIVADO") && (
                    <Button variant="ghost" size="sm" onClick={() => alternarAtivo(u)}>
                      {u.situacao === "ATIVO" ? "Desativar" : "Reativar"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onClose={fecharConvite}>
        {resultado ? (
          <div>
            <h2 className="mb-2 text-xl font-bold">Convite criado</h2>
            {resultado.email_enviado ? (
              <p className="text-sm text-muted-foreground">
                Enviamos o link de convite para <strong>{resultado.usuario.email}</strong>. A pessoa cria a própria
                senha ao abrir o link (válido por 7 dias).
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  O envio de e-mail não está configurado nesta instância. Copie o link abaixo e envie para{" "}
                  <strong>{resultado.usuario.email}</strong> por outro canal — ele vale por 7 dias e só pode ser usado
                  uma vez.
                </p>
                <div className="mt-3 flex items-center gap-1 rounded-md border border-border bg-secondary/40 p-2">
                  <code className="min-w-0 flex-1 truncate text-xs">{resultado.link}</code>
                  <CopyButton value={resultado.link ?? ""} />
                </div>
              </>
            )}
            <div className="mt-4 flex justify-end">
              <Button onClick={fecharConvite}>Concluir</Button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="mb-1 text-xl font-bold">Convidar Usuário</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              A pessoa recebe um link e cria a própria senha — ninguém além dela conhece a senha.
            </p>
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
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Papel</label>
                <select
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as PapelGlobal)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {papeisPermitidos.map((p) => (
                    <option key={p} value={p}>
                      {NOME_PAPEL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={fecharConvite}>
                  Cancelar
                </Button>
                <Button disabled={nome.trim().length < 2 || !email || convidar.isPending} onClick={() => convidar.mutate()}>
                  {convidar.isPending ? "Convidando…" : "Convidar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
      {confirmDialog}
    </div>
  );
}
