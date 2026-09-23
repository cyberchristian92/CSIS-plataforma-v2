import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { PaginaPublica } from "@/components/PaginaPublica";

export default function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [estado, setEstado] = useState<"confirmando" | "ok" | "erro">(token ? "confirmando" : "erro");
  const [erro, setErro] = useState<string | null>(null);
  // O link é de uso único: evita a segunda chamada do StrictMode em dev.
  const enviado = useRef(false);

  useEffect(() => {
    if (!token || enviado.current) return;
    enviado.current = true;
    api.auth
      .confirmarEmail(token)
      .then(() => setEstado("ok"))
      .catch((e: unknown) => {
        setErro(e instanceof ApiError ? e.message : null);
        setEstado("erro");
      });
  }, [token]);

  return (
    <PaginaPublica titulo="Confirmação de e-mail">
      {estado === "confirmando" && <p className="text-sm text-muted-foreground">Confirmando…</p>}
      {estado === "ok" && (
        <p className="text-sm">
          E-mail confirmado. Seu cadastro agora está com a equipe para análise — você recebe um aviso por e-mail quando
          ele for aprovado.
        </p>
      )}
      {estado === "erro" && (
        <p className="text-sm text-destructive">
          {erro ?? "Link inválido ou expirado."} Se o link venceu, faça o cadastro novamente ou fale com a equipe.
        </p>
      )}
    </PaginaPublica>
  );
}
