import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginaPublica } from "@/components/PaginaPublica";

const NOME_PAPEL: Record<string, string> = {
  ADMIN: "Administrador",
  LIDER: "Coordenador",
  REVISOR: "Revisor",
  COLABORADOR: "Especialista",
};

// Aceite de convite (Telas_Interface_Plataforma_CSIS.md): mostra nome, e-mail
// e papel já definidos pelo Admin e pede só a senha — a pessoa entra sabendo
// o que pode fazer na plataforma.
export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const previa = useQuery({
    queryKey: ["convite", token],
    queryFn: () => api.auth.previaConvite(token),
    enabled: !!token,
    retry: false,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    setEnviando(true);
    try {
      await api.auth.aceitarConvite(token, senha);
      navigate("/login", { replace: true, state: { aviso: "Senha criada. Entre com seu e-mail e a nova senha." } });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível aceitar o convite.");
    } finally {
      setEnviando(false);
    }
  }

  if (!token || previa.isError) {
    return (
      <PaginaPublica titulo="Convite">
        <p className="text-sm text-destructive">
          Este link de convite é inválido, expirou ou já foi usado. Peça um novo convite a quem administra a plataforma.
        </p>
      </PaginaPublica>
    );
  }

  return (
    <PaginaPublica
      titulo="Criar sua senha"
      subtitulo={
        previa.data ? (
          <>
            {previa.data.nome}, você foi convidado(a) como{" "}
            <strong>{NOME_PAPEL[previa.data.papel_global] ?? previa.data.papel_global}</strong>. Seu login será{" "}
            <strong>{previa.data.email}</strong>.
          </>
        ) : (
          "Carregando convite…"
        )
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          type="password"
          required
          autoFocus
          minLength={8}
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha (mín. 8 caracteres)"
          className="h-11"
        />
        <Input
          type="password"
          required
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          placeholder="Confirmar senha"
          className="h-11"
        />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" disabled={enviando || !previa.data} className="h-11">
          {enviando ? "Salvando…" : "Criar senha e ativar conta"}
        </Button>
      </form>
    </PaginaPublica>
  );
}
