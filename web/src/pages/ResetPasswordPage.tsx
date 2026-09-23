import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    setEnviando(true);
    try {
      await api.auth.redefinirSenha(token, novaSenha);
      navigate("/login", { replace: true });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Link inválido ou expirado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <img src="/csis-mark.svg" alt="CSIS" className="h-9 w-9 rounded bg-white p-0.5" />
          <span className="text-2xl font-bold tracking-wide text-primary">CSIS</span>
        </div>

        <h1 className="text-2xl font-bold">Redefinir senha</h1>

        {!token ? (
          <p className="mt-4 text-sm text-destructive">
            Link inválido — falta o token de redefinição. Solicite um novo link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
            <Input
              type="password"
              required
              autoFocus
              minLength={8}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Nova senha (mín. 8 caracteres)"
              className="h-11"
            />
            <Input
              type="password"
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Confirmar nova senha"
              className="h-11"
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" disabled={enviando} className="h-11">
              {enviando ? "Salvando…" : "Redefinir senha"}
            </Button>
          </form>
        )}

        <Link to="/login" className="mt-6 inline-block text-sm text-primary hover:underline">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
