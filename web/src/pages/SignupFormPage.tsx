import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Archive } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { CampoInscricao, DadosCampoInscricao, TipoCampoInscricao } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

const TIPOS: { tipo: TipoCampoInscricao; rotulo: string }[] = [
  { tipo: "TEXTO", rotulo: "Texto curto" },
  { tipo: "TEXTO_LONGO", rotulo: "Texto longo" },
  { tipo: "NUMERO", rotulo: "Número" },
  { tipo: "DATA", rotulo: "Data" },
  { tipo: "EMAIL", rotulo: "E-mail" },
  { tipo: "TELEFONE", rotulo: "Telefone" },
  { tipo: "URL", rotulo: "Link (ex.: LinkedIn, GitHub)" },
  { tipo: "SELECAO", rotulo: "Escolha uma opção" },
  { tipo: "MULTIPLA", rotulo: "Escolha várias opções" },
  { tipo: "ARQUIVO", rotulo: "Arquivo (ex.: currículo, certificado)" },
  { tipo: "ACEITE", rotulo: "Aceite de termo (ex.: NDA)" },
];
const ROTULO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.tipo, t.rotulo])) as Record<TipoCampoInscricao, string>;
const COM_OPCOES = new Set<TipoCampoInscricao>(["SELECAO", "MULTIPLA"]);

const VAZIO: DadosCampoInscricao = { rotulo: "", ajuda: "", tipo: "TEXTO", obrigatorio: false, opcoes: [] };

/// Link do formulário externo (Google Forms, Typeform...) mostrado no
/// cadastro como etapa complementar — onde a equipe pergunta o que quiser.
function ConfiguracaoFormularioExterno() {
  const qc = useQueryClient();
  const { data: config } = useQuery({ queryKey: ["config-inscricao"], queryFn: api.inscricao.configuracao });
  const [link, setLink] = useState("");
  const [instrucao, setInstrucao] = useState("");
  const [mensagem, setMensagem] = useState<{ erro: boolean; texto: string } | null>(null);

  useEffect(() => {
    if (config) {
      setLink(config.link_externo ?? "");
      setInstrucao(config.instrucao_externa ?? "");
    }
  }, [config]);

  const salvar = useMutation({
    mutationFn: () =>
      api.inscricao.definirConfiguracao({ link_externo: link.trim() || null, instrucao_externa: instrucao.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config-inscricao"] });
      qc.invalidateQueries({ queryKey: ["formulario-inscricao"] });
      setMensagem({ erro: false, texto: link.trim() ? "Formulário externo salvo." : "Formulário externo removido." });
    },
    onError: (e: unknown) =>
      setMensagem({ erro: true, texto: e instanceof ApiError ? e.message : "Não foi possível salvar." }),
  });

  return (
    <section className="mb-8 rounded-lg border border-border p-4">
      <h2 className="font-semibold">Formulário externo de análise</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Para perguntas detalhadas (experiência, portfólio, questionários), use um Google Forms, Typeform ou similar. O
        link aparece no cadastro como etapa complementar, pedindo que a pessoa use o mesmo e-mail — e fica visível na
        fila de Inscrições para a equipe conferir as respostas.
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Link do formulário</label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://forms.gle/…" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Instrução para o candidato (opcional)</label>
          <Input
            value={instrucao}
            onChange={(e) => setInstrucao(e.target.value)}
            placeholder="Ex.: Conte sua experiência e envie seu portfólio."
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Button>
          {mensagem && (
            <span className={mensagem.erro ? "text-xs text-destructive" : "text-xs text-status-approved"}>
              {mensagem.texto}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

// O que o cadastro público pede, editável pela equipe (Admin, Coordenador e
// Revisor) sem mexer no código. Nome, e-mail e senha são sempre pedidos;
// aqui entram as perguntas extras. Remover um campo o ARQUIVA: inscrições já
// feitas continuam mostrando o que foi respondido nele.
export default function SignupFormPage() {
  const qc = useQueryClient();
  const { ask: confirmar, dialog: confirmDialog } = useConfirmDialog();
  const [editando, setEditando] = useState<{ id: string | null; dados: DadosCampoInscricao } | null>(null);
  const [textoOpcoes, setTextoOpcoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const { data: campos } = useQuery({ queryKey: ["campos-inscricao"], queryFn: () => api.inscricao.listarCampos() });
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["campos-inscricao"] });
    qc.invalidateQueries({ queryKey: ["formulario-inscricao"] });
  };

  const salvar = useMutation({
    mutationFn: () => {
      const dados = {
        ...editando!.dados,
        opcoes: textoOpcoes
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean),
      };
      return editando!.id ? api.inscricao.atualizarCampo(editando!.id, dados) : api.inscricao.criarCampo(dados);
    },
    onSuccess: () => {
      invalidar();
      setEditando(null);
    },
    onError: (e: unknown) => setErro(e instanceof ApiError ? e.message : "Não foi possível salvar o campo."),
  });

  const ordenar = useMutation({ mutationFn: (ids: string[]) => api.inscricao.ordenarCampos(ids), onSuccess: invalidar });
  const arquivar = useMutation({ mutationFn: (id: string) => api.inscricao.arquivarCampo(id), onSuccess: invalidar });

  function abrir(campo?: CampoInscricao) {
    setErro(null);
    setEditando(
      campo
        ? {
            id: campo.id,
            dados: {
              rotulo: campo.rotulo,
              ajuda: campo.ajuda ?? "",
              tipo: campo.tipo,
              obrigatorio: campo.obrigatorio,
              opcoes: campo.opcoes,
            },
          }
        : { id: null, dados: { ...VAZIO } },
    );
    setTextoOpcoes(campo?.opcoes.join("\n") ?? "");
  }

  function mover(indice: number, delta: -1 | 1) {
    if (!campos) return;
    const ids = campos.map((c) => c.id);
    const [id] = ids.splice(indice, 1);
    ids.splice(indice + delta, 0, id);
    ordenar.mutate(ids);
  }

  async function remover(campo: CampoInscricao) {
    const ok = await confirmar({
      titulo: `Remover "${campo.rotulo}" do formulário?`,
      descricao: "Novos cadastros deixam de ver esta pergunta. Inscrições já enviadas continuam mostrando a resposta.",
      textoConfirmar: "Remover",
      destrutivo: true,
    });
    if (ok) arquivar.mutate(campo.id);
  }

  const atualizarDados = (parcial: Partial<DadosCampoInscricao>) =>
    setEditando((e) => (e ? { ...e, dados: { ...e.dados, ...parcial } } : e));

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Formulário de Inscrição</h1>
          <p className="text-sm text-muted-foreground">
            O cadastro pede sempre nome, e-mail e senha — mantenha o resto no mínimo (ex.: aceite do termo de
            confidencialidade) e use o formulário externo para o que for detalhado.{" "}
            <Link to="/cadastro" target="_blank" className="inline-flex items-center gap-0.5 text-primary hover:underline">
              Ver como o candidato vê <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <Button onClick={() => abrir()}>
          <Plus className="h-4 w-4" /> Adicionar pergunta
        </Button>
      </div>

      <ConfiguracaoFormularioExterno />

      <h2 className="mb-2 font-semibold">Perguntas no próprio cadastro</h2>
      {campos?.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma pergunta extra ainda — o cadastro pede só nome, e-mail e senha.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {campos?.map((campo, indice) => (
          <li key={campo.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
            <div className="flex flex-col">
              <button
                disabled={indice === 0 || ordenar.isPending}
                onClick={() => mover(indice, -1)}
                title="Subir"
                className="rounded p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                disabled={indice === campos.length - 1 || ordenar.isPending}
                onClick={() => mover(indice, 1)}
                title="Descer"
                className="rounded p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {campo.rotulo}
                {campo.obrigatorio && <span className="text-destructive"> *</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {ROTULO_TIPO[campo.tipo]}
                {campo.opcoes.length > 0 && ` · ${campo.opcoes.join(" / ")}`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => abrir(campo)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => remover(campo)}>
              <Archive className="h-3.5 w-3.5" /> Remover
            </Button>
          </li>
        ))}
      </ol>

      <Dialog open={!!editando} onClose={() => setEditando(null)}>
        {editando && (
          <div>
            <h2 className="mb-4 text-xl font-bold">{editando.id ? "Editar pergunta" : "Nova pergunta"}</h2>
            {erro && <p className="mb-3 text-xs text-destructive">{erro}</p>}
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Pergunta</label>
                <Input value={editando.dados.rotulo} onChange={(e) => atualizarDados({ rotulo: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de resposta</label>
                <select
                  value={editando.dados.tipo}
                  onChange={(e) => atualizarDados({ tipo: e.target.value as TipoCampoInscricao })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TIPOS.map((t) => (
                    <option key={t.tipo} value={t.tipo}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              </div>
              {COM_OPCOES.has(editando.dados.tipo) && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Opções (uma por linha)</label>
                  <textarea
                    rows={4}
                    value={textoOpcoes}
                    onChange={(e) => setTextoOpcoes(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Texto de ajuda (opcional)</label>
                <Input value={editando.dados.ajuda ?? ""} onChange={(e) => atualizarDados({ ajuda: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editando.dados.obrigatorio ?? false}
                  onChange={(e) => atualizarDados({ obrigatorio: e.target.checked })}
                />
                Resposta obrigatória
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
                <Button disabled={!editando.dados.rotulo.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
                  Salvar
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
