export const COOKIE_SESSAO = 'access_token';
/// Login com Google em andamento: state + verificador PKCE (10 min).
export const COOKIE_GOOGLE_OAUTH = 'google_oauth';
/// Identidade do Google aguardando o formulário de cadastro (30 min).
export const COOKIE_GOOGLE_CADASTRO = 'google_cadastro';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/// `secure` (cookie só trafega em HTTPS) liga sozinho em produção. Atrás de
/// um proxy que termina o HTTPS (Cloudflare Tunnel, Tailscale Funnel)
/// continua certo: quem decide é o navegador, que está falando HTTPS.
/// COOKIE_SECURE=false existe só para testar a build de produção em
/// http://localhost. `sameSite: lax` deixa o cookie ir junto na volta do
/// Google (navegação de topo, GET).
export function opcoesCookie(maxAge = UM_DIA_MS) {
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge,
  };
}
