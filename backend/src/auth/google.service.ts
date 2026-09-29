import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { normalizarEmail, urlFrontend } from './auth.service';

/// Quem a pessoa é segundo o Google (claims do id_token já verificado).
export interface IdentidadeGoogle {
  sub: string;
  email: string;
  nome: string;
}

// Endereços oficiais; os testes apontam para um Google falso.
const PADRAO = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  jwks: 'https://www.googleapis.com/oauth2/v3/certs',
};
const EMISSORES = ['https://accounts.google.com', 'accounts.google.com'];

interface DadosOAuth {
  tipo: 'google_oauth';
  state: string;
  verifier: string;
}
interface DadosCadastro {
  tipo: 'google_cadastro';
  gsub: string;
  email: string;
  nome: string;
}

/// "Entrar com Google" por OpenID Connect (authorization code + PKCE). O
/// state e o verificador vivem num cookie assinado e curto; o id_token é
/// verificado contra as chaves públicas do Google (assinatura, emissor,
/// audiência e validade) antes de qualquer coisa ser feita com ele.
@Injectable()
export class GoogleService {
  private chaves?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly jwt: JwtService) {}

  get configurado(): boolean {
    return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  }

  /// Tem que ser exatamente o cadastrado no Google Cloud (URIs de
  /// redirecionamento autorizados). Passa pelo mesmo /api do frontend.
  private urlRetorno(): string {
    return urlFrontend('/api/auth/google/callback');
  }

  async iniciar(): Promise<{ url: string; cookie: string }> {
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const desafio = createHash('sha256').update(verifier).digest('base64url');
    const url = new URL(process.env.GOOGLE_AUTH_URL ?? PADRAO.auth);
    url.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: this.urlRetorno(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: desafio,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    const dados: DadosOAuth = { tipo: 'google_oauth', state, verifier };
    const cookie = await this.jwt.signAsync(dados, { expiresIn: '10m' });
    return { url: url.toString(), cookie };
  }

  /// Confere o state, troca o code no Google e verifica o id_token. Lança
  /// em qualquer divergência — quem chama só distingue "deu" ou "não deu".
  async concluir(
    cookie: string | undefined,
    state: string | undefined,
    code: string | undefined,
  ): Promise<IdentidadeGoogle & { emailVerificado: boolean }> {
    const dados = cookie
      ? await this.jwt.verifyAsync<DadosOAuth>(cookie).catch(() => null)
      : null;
    if (
      !dados ||
      dados.tipo !== 'google_oauth' ||
      !code ||
      dados.state !== state
    ) {
      throw new Error('state ausente, vencido ou diferente do enviado');
    }
    const resposta = await fetch(process.env.GOOGLE_TOKEN_URL ?? PADRAO.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: this.urlRetorno(),
        grant_type: 'authorization_code',
        code_verifier: dados.verifier,
      }),
    });
    if (!resposta.ok) {
      throw new Error(`Google recusou o code (HTTP ${resposta.status})`);
    }
    const { id_token: idToken } = (await resposta.json()) as {
      id_token?: string;
    };
    if (!idToken) throw new Error('Google não devolveu id_token');
    this.chaves ??= createRemoteJWKSet(
      new URL(process.env.GOOGLE_JWKS_URL ?? PADRAO.jwks),
    );
    const { payload } = await jwtVerify(idToken, this.chaves, {
      issuer: EMISSORES,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!payload.sub || !email) throw new Error('id_token sem sub/e-mail');
    return {
      sub: payload.sub,
      email: normalizarEmail(email),
      nome:
        typeof payload.name === 'string' && payload.name ? payload.name : email,
      emailVerificado: payload.email_verified === true,
    };
  }

  assinarCadastro(id: IdentidadeGoogle): Promise<string> {
    const dados: DadosCadastro = {
      tipo: 'google_cadastro',
      gsub: id.sub,
      email: id.email,
      nome: id.nome,
    };
    return this.jwt.signAsync(dados, { expiresIn: '30m' });
  }

  async lerCadastro(
    cookie: string | undefined,
  ): Promise<IdentidadeGoogle | null> {
    if (!cookie) return null;
    const dados = await this.jwt
      .verifyAsync<DadosCadastro>(cookie)
      .catch(() => null);
    if (!dados || dados.tipo !== 'google_cadastro') return null;
    return { sub: dados.gsub, email: dados.email, nome: dados.nome };
  }
}
