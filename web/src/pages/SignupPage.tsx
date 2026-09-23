import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { FormularioInscricao } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginaPublica } from "@/components/PaginaPublica";

type Campo = FormularioInscricao["campos"][number];
type Valor = string | boolean | string[];

const TIPO_INPUT: Partial<Record<Campo["tipo"], string>> = {
  TEXTO: "text",
  NUMERO: "number",
  DATA: "date",
  EMAIL: "email",
  TELEFONE: "tel",
  URL: "url",
};

const classeRotulo = "mb-1 block text-sm font-medium";

function CampoDinamico({
  campo,
  valor,
  onValor,
  onArquivo,
}: {
  campo: Campo;
  valor: Valor | undefined;
  onValor: (v: Valor) => void;
  onArquivo: (f: File | null) => void;
}) {
  const id = `campo-${campo.id}`;
  const rotulo = (
    <>
      {campo.rotulo}
      {campo.obrigatorio && <span className="text-destructive"> *</span>}
    </>
  );
  const ajuda = campo.ajuda && <p className="mt-1 text-xs text-muted-foreground">{campo.ajuda}</p>;

  switch (campo.tipo) {
    case "TEXTO_LONGO":
      return (
        <div>
          <label htmlFor={id} className={classeRotulo}>
            {rotulo}
          </label>
          <textarea
            id={id}
            required={campo.obrigatorio}
            rows={4}
            value={(valor as string) ?? ""}
            onChange={(e) => onValor(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {ajuda}
        </div>
      );
    case "SELECAO":
      return (
        <div>
          <label htmlFor={id} className={classeRotulo}>
            {rotulo}
          </label>
          <select
            id={id}
            required={campo.obrigatorio}
            value={(valor as string) ?? ""}
            onChange={(e) => onValor(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecione…</option>
            {campo.opcoes.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {ajuda}
        </div>
      );
    case "MULTIPLA": {
      const marcadas = (valor as string[]) ?? [];
      return (
        <fieldset>
          <legend className={classeRotulo}>{rotulo}</legend>
          <div className="flex flex-col gap-1.5">
            {campo.opcoes.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={marcadas.includes(o)}
                  onChange={(e) => onValor(e.target.checked ? [...marcadas, o] : marcadas.filter((m) => m !== o))}
                />
                {o}
              </label>
            ))}
          </div>
          {ajuda}
        </fieldset>
      );
    }
    case "ACEITE":
      return (
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required={campo.obrigatorio}
              checked={valor === true}
              onChange={(e) => onValor(e.target.checked)}
              className="mt-0.5"
            />
            <span>{rotulo}</span>
          </label>
          {ajuda}
        </div>
      );
    case "ARQUIVO":
      return (
        <div>
          <label htmlFor={id} className={classeRotulo}>
            {rotulo}
          </label>
          <input
            id={id}
            type="file"
            required={campo.obrigatorio}
            onChange={(e) => onArquivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
          />
          {ajuda}
        </div>
      );
    default:
      return (
        <div>
          <label htmlFor={id} className={classeRotulo}>
            {rotulo}
          </label>
          <Input
            id={id}
            type={TIPO_INPUT[campo.tipo] ?? "text"}
            required={campo.obrigatorio}
            value={(valor as string) ?? ""}
            onChange={(e) => onValor(e.target.value)}
            className="h-10"
          />
          {ajuda}
        </div>
      );
  }
}

// Cadastro público: o que é perguntado vem do formulário configurado pela
// equipe (Admin/Coordenador/Revisor, em "Formulário de Inscrição"). A conta
// nasce pendente — só entra depois de confirmar o e-mail e ser aprovada.
export default function SignupPage() {
  const formulario = useQuery({ queryKey: ["formulario-inscricao"], queryFn: api.inscricao.formulario });
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [armadilha, setArmadilha] = useState("");
  const [respostas, setRespostas] = useState<Record<string, Valor>>({});
  const [anexos, setAnexos] = useState<Record<string, File | null>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    const dados = new FormData();
    dados.append("nome", nome);
    dados.append("email", email);
    dados.append("senha", senha);
    dados.append("respostas", JSON.stringify(respostas));
    if (armadilha) dados.append("site", armadilha);
    for (const [campoId, arquivo] of Object.entries(anexos)) {
      if (arquivo) dados.append(`anexo_${campoId}`, arquivo);
    }
    setEnviando(true);
    try {
      const r = await api.inscricao.inscrever(dados);
      setConcluido(r.mensagem);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar o cadastro. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <PaginaPublica titulo="Cadastro enviado">
        <p className="text-sm">{concluido}</p>
      </PaginaPublica>
    );
  }

  if (formulario.data && !formulario.data.aberto) {
    return (
      <PaginaPublica titulo="Cadastro">
        <p className="text-sm text-muted-foreground">
          O cadastro público está fechado nesta instância. Para participar, peça um convite à equipe.
        </p>
      </PaginaPublica>
    );
  }

  return (
    <PaginaPublica
      titulo="Criar conta"
      subtitulo="A equipe analisa cada cadastro antes de liberar o acesso."
      largura="lg"
    >
      {formulario.isLoading && <p className="text-sm text-muted-foreground">Carregando formulário…</p>}
      {formulario.isError && <p className="text-sm text-destructive">Não foi possível carregar o formulário.</p>}
      {formulario.data && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="nome" className={classeRotulo}>
              Nome completo <span className="text-destructive">*</span>
            </label>
            <Input id="nome" required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} className="h-10" />
          </div>
          <div>
            <label htmlFor="email" className={classeRotulo}>
              E-mail <span className="text-destructive">*</span>
            </label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="senha" className={classeRotulo}>
                Senha <span className="text-destructive">*</span>
              </label>
              <Input
                id="senha"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-10"
              />
            </div>
            <div>
              <label htmlFor="confirmar" className={classeRotulo}>
                Confirmar senha <span className="text-destructive">*</span>
              </label>
              <Input
                id="confirmar"
                type="password"
                required
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          {formulario.data.campos.map((campo) => (
            <CampoDinamico
              key={campo.id}
              campo={campo}
              valor={respostas[campo.id]}
              onValor={(v) => setRespostas((r) => ({ ...r, [campo.id]: v }))}
              onArquivo={(f) => setAnexos((a) => ({ ...a, [campo.id]: f }))}
            />
          ))}

          {/* Campo-armadilha: fora da tela para pessoas; robôs preenchem. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="site">Site</label>
            <input
              id="site"
              tabIndex={-1}
              autoComplete="off"
              value={armadilha}
              onChange={(e) => setArmadilha(e.target.value)}
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={enviando} className="h-11">
            {enviando ? "Enviando…" : "Enviar cadastro"}
          </Button>
        </form>
      )}
    </PaginaPublica>
  );
}
