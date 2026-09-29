import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, ExternalLink } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Inscricao, PapelGlobal, RespostaInscricao } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";
import { NOME_PAPEL } from "@/lib/papeis";
import { useWorkspace } from "@/lib/use-workspace";
import { useWorkspaceId } from "@/lib/use-workspace-id";
import { Link } from "react-router-dom";
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
  const [listaIds, setListaIds] = useState<string[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const { data: marca } = useWorkspace();
  const { data: config } = useQuery({ queryKey: ["config-inscricao"], queryFn: api.inscricao.configuracao });
  const formularioExterno = config?.link_externo ?? null;
  const enviaEmails = marca?.envia_emails ?? false;
  const podeDecidir = user?.papel_global === "ADMIN" || user?.papel_global === "LIDER";
  const papeisPermitidos = user?.papel_global === "ADMIN" ? PAPEIS : PAPEIS.filter((p) => p !== "ADMIN");

  // Para aprovar já deixando a pessoa pronta: em que equipes entra e que
  // áreas enxerga.
  const workspaceId = useWorkspaceId();
  const aprovando = decisao?.tipo === "aprovar";
  const { data: equipes } = useQuery({
    queryKey: ["listas", workspaceId],
    queryFn: () => api.listas.listarPorWorkspace(workspaceId!),
    enabled: aprovando && !!workspaceId,
  });
  const { data: areas } = useQuery({
    queryKey: ["areas-todas"],
    queryFn: api.areas.listarTodas,
    enabled: aprovando,
  });

  const { data: inscricoes, isLoading } = useQuery({
    queryKey: ["inscricoes", aba],
    queryFn: () => api.inscricoes.listar(aba),
  });

  const decidir = useMutation({
    mutationFn: () =>
      decisao!.tipo === "aprovar"
        ? api.inscricoes.aprovar(decisao!.inscricao.id, papel, {
            observacao: observacao || undefined,
            listaIds,
            areaIds,
          })
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
    setListaIds([]);
    setAreaIds([]);
    setErro(null);
  }

  function fecharDecisao() {
    setDecisao(null);
    setErro(null);
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Cadastros feitos pela tela pública. Todos passam pela análise da equipe antes de o acesso ser liberado.
      </p>

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
                  <p className="truncate font-medium">{i.user.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{i.user.email}</p>
                </div>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {new Date(i.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="shrink-0">
                  <SituacaoBadge situacao={i.user.situacao} />
                </span>
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
                              {formatBytes(a.tamanho)} · SHA-256 {a.hash_sha256.slice(0, 12)}…
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {formularioExterno && (
                    <p className="mt-3 text-sm">
                      <a
                        href={formularioExterno}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Formulário externo de análise <ExternalLink className="h-3 w-3" />
                      </a>{" "}
                      <span className="text-xs text-muted-foreground">— procure as respostas de {i.user.email}</span>
                    </p>
                  )}

                  {i.user.situacao === "AGUARDANDO_EMAIL" && (
                    <p className="mt-3 text-xs text-status-in-review">
                      Esta pessoa ainda não confirmou o e-mail. Aprovar mesmo assim só se a equipe já verificou quem ela é.
                    </p>
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
                      <Button size="sm" onClick={() => abrirDecisao(i, "aprovar")}>
                        Aprovar
                      </Button>
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
                ? enviaEmails
                  ? "A pessoa recebe um e-mail avisando que já pode entrar, com o papel, as equipes e as áreas escolhidas abaixo."
                  : "A pessoa já pode entrar com o e-mail e a senha do cadastro (esta instância não envia e-mails — avise-a por outro canal)."
                : enviaEmails
                  ? "A pessoa recebe um aviso neutro por e-mail. A observação fica só para a equipe."
                  : "A conta fica bloqueada. A observação fica só para a equipe."}
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
                        {NOME_PAPEL[p]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {decisao.tipo === "aprovar" && (
                <>
                  <Marcacoes
                    titulo="Equipes"
                    vazio={
                      <>
                        Nenhuma equipe criada ainda —{" "}
                        <Link to="/configuracoes" className="text-primary hover:underline">
                          criar em Configurações
                        </Link>
                        .
                      </>
                    }
                    opcoes={(equipes ?? []).map((l) => ({ id: l.id, nome: l.nome }))}
                    marcados={listaIds}
                    onChange={setListaIds}
                  />
                  <Marcacoes
                    titulo="Áreas que a pessoa enxerga"
                    vazio="Nenhuma área criada ainda."
                    opcoes={(areas ?? []).map((a) => ({ id: a.id, nome: a.nome }))}
                    marcados={areaIds}
                    onChange={setAreaIds}
                  />
                </>
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

// Lista de caixas de marcação (equipes, áreas) do diálogo de aprovação.
function Marcacoes({
  titulo,
  vazio,
  opcoes,
  marcados,
  onChange,
}: {
  titulo: string;
  vazio: React.ReactNode;
  opcoes: { id: string; nome: string }[];
  marcados: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 block text-xs font-medium text-muted-foreground">{titulo} (opcional)</legend>
      {opcoes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{vazio}</p>
      ) : (
        <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-md border border-input p-2">
          {opcoes.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={marcados.includes(o.id)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...marcados, o.id] : marcados.filter((id) => id !== o.id))
                }
              />
              {o.nome}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
