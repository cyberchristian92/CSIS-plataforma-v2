import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, ExternalLink } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Inscricao, PapelGlobal, RespostaInscricao } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SituacaoBadge } from "@/components/SituacaoUsuario";

const ABAS = [
  { situacao: "PENDENTE", rotulo: "Aguardando aprovação" },
  { situacao: "AGUARDANDO_EMAIL", rotulo: "E-mail não confirmado" },
  { situacao: "ATIVO", rotulo: "Aprovadas" },
  { situacao: "RECUSADO", rotulo: "Recusadas" },
] as const;

const PAPEIS: PapelGlobal[] = ["COLABORADOR", "REVISOR", "LIDER", "ADMIN"];

function formatarValor(r: RespostaInscricao) {
  if (r.valor === null || r.valor === undefined) return <span className="text-muted-foreground">—</span>;
  if (r.tipo === "ACEITE") return r.valor ? "Aceito" : "Não aceito";
  if (Array.isArray(r.valor)) return r.valor.join(", ");
  if (r.tipo === "URL")
    return (
      <a href={String(r.valor)} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
        {String(r.valor)} <ExternalLink className="inline h-3 w-3" />
      </a>
    );
  return <span className="whitespace-pre-wrap">{String(r.valor)}</span>;
}

// Fila de cadastros públicos. Revisor consulta; Admin/Coordenador decidem
// (aprovar é também escolher o papel da pessoa).
export default function SignupQueuePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [aba, setAba] = useState<(typeof ABAS)[number]["situacao"]>("PENDENTE");
  const [aberta, setAberta] = useState<string | null>(null);
  const [decisao, setDecisao] = useState<{ inscricao: Inscricao; tipo: "aprovar" | "recusar" } | null>(null);
  const [papel, setPapel] = useState<PapelGlobal>("COLABORADOR");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const podeDecidir = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";
  const papeisPermitidos = user?.papel_global === "ADMIN" ? PAPEIS : PAPEIS.filter((p) => p !== "ADMIN");

  const { data: inscricoes, isLoading } = useQuery({
    queryKey: ["inscricoes", aba],
    queryFn: () => api.inscricoes.listar(aba),
  });

  const decidir = useMutation({
    mutationFn: () =>
      decisao!.tipo === "aprovar"
        ? api.inscricoes.aprovar(decisao!.inscricao.id, papel, observacao || undefined)
        : api.inscricoes.recusar(decisao!.inscricao.id, observacao || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inscricoes"] });
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      fecharDecisao();
    },
    onError: (e: unknown) => setErro(e instanceof ApiError ? e.message : "Não foi possível registrar a decisão."),
  });

  function abrirDecisao(inscricao: Inscricao, tipo: "aprovar" | "recusar") {
    setDecisao({ inscricao, tipo });
    setPapel("COLABORADOR");
    setObservacao("");
    setErro(null);
  }

  function fecharDecisao() {
    setDecisao(null);
    setErro(null);
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Inscrições</h1>
        <p className="text-sm text-muted-foreground">
          Cadastros feitos pela tela pública. As perguntas vêm do Formulário de Inscrição.
        </p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        {ABAS.map((a) => (
          <button
            key={a.situacao}
            onClick={() => setAba(a.situacao)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              aba === a.situacao
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {inscricoes?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma inscrição nesta situação.</p>}

      <div className="flex flex-col gap-2">
        {inscricoes?.map((i) => {
          const expandida = aberta === i.id;
          return (
            <div key={i.id} className="rounded-lg border border-border">
              <button
                onClick={() => setAberta(expandida ? null : i.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40"
              >
                {expandida ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.user.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{i.user.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(i.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <SituacaoBadge situacao={i.user.situacao} />
              </button>

              {expandida && (
                <div className="border-t border-border px-4 py-3">
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
                    {i.respostas
                      .filter((r) => r.tipo !== "ARQUIVO")
                      .map((r) => (
                        <div key={r.campo_id} className="contents">
                          <dt className="text-muted-foreground">{r.rotulo}</dt>
                          <dd>{formatarValor(r)}</dd>
                        </div>
                      ))}
                  </dl>

                  {i.anexos.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Anexos</p>
                      <ul className="flex flex-col gap-1 text-sm">
                        {i.anexos.map((a) => (
                          <li key={a.id} className="flex items-center gap-2">
                            <a
                              href={api.inscricoes.urlAnexo(i.id, a.id)}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" /> {a.nome}
                            </a>
                            <span className="text-xs text-muted-foreground">
                              {(a.tamanho / 1024).toFixed(0)} KB · SHA-256 {a.hash_sha256.slice(0, 12)}…
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {i.decidido_em && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Decidido por {i.decidido_por?.nome ?? "—"} em{" "}
                      {new Date(i.decidido_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {i.observacao && <> — “{i.observacao}”</>}
                    </p>
                  )}

                  {podeDecidir && (i.user.situacao === "PENDENTE" || i.user.situacao === "AGUARDANDO_EMAIL") && (
                    <div className="mt-4 flex gap-2">
                      {i.user.situacao === "PENDENTE" && (
                        <Button size="sm" onClick={() => abrirDecisao(i, "aprovar")}>
                          Aprovar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => abrirDecisao(i, "recusar")}>
                        Recusar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!decisao} onClose={fecharDecisao}>
        {decisao && (
          <div>
            <h2 className="mb-1 text-xl font-bold">
              {decisao.tipo === "aprovar" ? "Aprovar" : "Recusar"} {decisao.inscricao.user.nome}
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {decisao.tipo === "aprovar"
                ? "A pessoa recebe um e-mail avisando que já pode entrar, com o papel escolhido abaixo."
                : "A pessoa recebe um aviso neutro por e-mail. A observação fica só para a equipe."}
            </p>
            {erro && <p className="mb-3 text-xs text-destructive">{erro}</p>}
            <div className="flex flex-col gap-3">
              {decisao.tipo === "aprovar" && (
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
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Observação interna (opcional)</label>
                <textarea
                  rows={3}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={fecharDecisao}>
                  Cancelar
                </Button>
                <Button
                  variant={decisao.tipo === "recusar" ? "destructive" : "default"}
                  disabled={decidir.isPending}
                  onClick={() => decidir.mutate()}
                >
                  {decisao.tipo === "aprovar" ? "Aprovar" : "Recusar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
