import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.auth.esqueciSenha(email);
    } finally {
      // Sempre mostra a mesma confirmação, exista ou não a conta — não dá
      // pra um formulário público de "esqueci a senha" revelar quais e-mails
      // estão cadastrados no sistema.
      setEnviado(true);
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

        <h1 className="text-2xl font-bold">Esqueci minha senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu e-mail — se houver uma conta associada, enviaremos um link de redefinição.
        </p>

        {enviado ? (
          <p className="mt-6 rounded-md border border-border bg-card p-3 text-sm">
            Se <strong>{email}</strong> estiver cadastrado, um link de redefinição foi enviado.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
            <Input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="h-11"
            />
            <Button type="submit" disabled={enviando} className="h-11">
              {enviando ? "Enviando…" : "Enviar link de redefinição"}
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
