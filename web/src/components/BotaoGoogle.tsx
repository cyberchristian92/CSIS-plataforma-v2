import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// "Entrar com Google": navegação de página inteira para o backend, que leva
// ao Google e traz a pessoa de volta (ver backend/src/auth/google-auth.controller.ts).
// Só aparece quando a instância tem as credenciais do Google configuradas.
export function BotaoGoogle({ rotulo = "Entrar com Google" }: { rotulo?: string }) {
  const { data } = useQuery({ queryKey: ["provedores-login"], queryFn: api.auth.provedores, staleTime: Infinity });
  if (!data?.google) return null;
  return (
    <a
      href="/api/auth/google"
      className="flex h-12 items-center justify-center gap-3 rounded-md border border-input bg-background text-base font-medium hover:bg-accent"
    >
      <LogoGoogle />
      {rotulo}
    </a>
  );
}

/// Separador "ou" entre o Google e o formulário — só quando o botão aparece.
export function SeparadorOu() {
  const { data } = useQuery({ queryKey: ["provedores-login"], queryFn: api.auth.provedores, staleTime: Infinity });
  if (!data?.google) return null;
  return (
    <div className="my-1 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      ou
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
