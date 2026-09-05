import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo, useNomeExibicao } from "@/components/Logo";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nomeExibicao = useNomeExibicao();

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

        <form onSubmit={onSubmit} className="mt-8 flex max-w-sm flex-col gap-3">
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
        </form>
      </div>

      {/* Painel de marca */}
      <div className="hidden w-1/2 items-center justify-center bg-card lg:flex">
        <Logo className="h-80 w-80 rounded-2xl bg-white/90 p-8" />
      </div>
    </div>
  );
}
