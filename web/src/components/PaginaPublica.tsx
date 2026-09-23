import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Logo, useNomeExibicao } from "./Logo";

/// Moldura das telas acessíveis sem login (convite, confirmação de e-mail,
/// cadastro): marca da instância no topo, conteúdo centralizado, e um link de
/// volta para o login no rodapé.
export function PaginaPublica({
  titulo,
  subtitulo,
  largura = "sm",
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  largura?: "sm" | "lg";
  children: ReactNode;
}) {
  const nomeExibicao = useNomeExibicao();
  return (
    <div className="flex min-h-screen justify-center bg-background px-6 py-12">
      <div className={cn("w-full", largura === "sm" ? "max-w-sm" : "max-w-xl")}>
        <div className="mb-8 flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-2xl font-bold tracking-wide text-primary">{nomeExibicao}</span>
        </div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
        <div className="mt-6">{children}</div>
        <Link to="/login" className="mt-8 inline-block text-sm text-primary hover:underline">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
