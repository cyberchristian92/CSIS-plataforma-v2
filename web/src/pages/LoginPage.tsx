import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo, useNomeExibicao } from "@/components/Logo";
import { BotaoGoogle, SeparadorOu } from "@/components/BotaoGoogle";

// O que o backend manda de volta depois do Google (?erro= / ?aviso=).
const ERROS_GOOGLE: Record<string, string> = {
  "google-indisponivel": "O login com Google não está configurado nesta instância.",
  "google-cancelado": "O login com Google foi cancelado.",
  "google-falhou": "Não foi possível confirmar sua conta Google. Tente de novo.",
  "google-email": "O e-mail da sua conta Google não está verificado. Verifique-o no Google e tente de novo.",
  "google-outra-conta":
    "Este e-mail já está ligado a outra conta Google. Entre com a conta Google de sempre, ou com e-mail e senha.",
  "conta-bloqueada": "Esta conta não tem acesso à plataforma. Fale com a equipe.",
  "cadastro-fechado": "O cadastro público está fechado nesta instância. Peça um convite à equipe.",
};
const AVISOS_GOOGLE: Record<string, string> = {
  pendente: "Seu cadastro foi recebido e aguarda aprovação da equipe. Você recebe um aviso quando for liberado.",
};

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nomeExibicao = useNomeExibicao();
  const formulario = useQuery({ queryKey: ["formulario-inscricao"], queryFn: api.inscricao.formulario });
  const [params] = useSearchParams();
  const erroGoogle = ERROS_GOOGLE[params.get("erro") ?? ""];
  const aviso = (location.state as { aviso?: string } | null)?.aviso ?? AVISOS_GOOGLE[params.get("aviso") ?? ""];

  if (user) {
    const from = (location.state as { from?: string })?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email, senha);
      navigate("/", { replace: true });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao entrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Painel do formulário */}
      <div className="flex w-full flex-col justify-center px-10 sm:px-16 lg:w-1/2 xl:px-24">
        <div className="mb-14 flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-2xl font-bold tracking-wide text-primary">{nomeExibicao}</span>
        </div>

        <h1 className="text-3xl font-bold">Entrar</h1>
        <p className="mt-1 text-muted-foreground">Acesse a plataforma de gestão técnica</p>

        {aviso && <p className="mt-6 max-w-sm rounded-md bg-status-approved/10 p-3 text-sm text-status-approved">{aviso}</p>}

        {erroGoogle && <p className="mt-6 max-w-sm rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erroGoogle}</p>}

        <form onSubmit={onSubmit} className="mt-8 flex max-w-sm flex-col gap-3">
          <BotaoGoogle />
          <SeparadorOu />
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="h-12 bg-secondary/60 text-base"
          />
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            className="h-12 bg-secondary/60 text-base"
          />
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={enviando} size="lg" className="mt-3 h-12 text-base font-semibold">
            {enviando ? "Entrando…" : "Entrar"}
          </Button>
          <Link to="/esqueci-senha" className="text-center text-sm text-muted-foreground hover:text-primary">
            Esqueci minha senha
          </Link>
          {formulario.data?.aberto && (
            <p className="text-center text-sm text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link to="/cadastro" className="font-medium text-primary hover:underline">
                Cadastre-se
              </Link>
            </p>
          )}
        </form>
      </div>

      {/* Painel de marca */}
      <div className="hidden w-1/2 items-center justify-center bg-card lg:flex">
        <Logo className="h-80 w-80 rounded-2xl bg-white/90 p-8" />
      </div>
    </div>
  );
}
