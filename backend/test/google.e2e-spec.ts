import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import {
  Contexto,
  criarApp,
  criarUsuario,
  encerrar,
  ultimoEmail,
} from './helpers';
import { URL_API_TESTE } from './env-teste';

function emailUnico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@gmail.com`;
}

interface Identidade {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
}

/// "Entrar com Google" (OpenID Connect com PKCE). O Google é o falso de
/// google-falso.ts: o `code` do callback carrega a identidade que ele devolve.
describe('Entrar com Google', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
    await ctx.prisma.campoInscricao.updateMany({ data: { arquivado: true } });
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  /// Faz o vaivém completo: /auth/google → (Google) → /auth/google/callback.
  /// Devolve para onde o backend mandou o navegador no fim.
  async function voltarDoGoogle(
    agente: TestAgent,
    identidade: Identidade,
    opcoes: { stateErrado?: boolean } = {},
  ): Promise<string> {
    const inicio = await agente.get('/auth/google').expect(302);
    const paraGoogle = new URL(inicio.headers.location);
    expect(paraGoogle.searchParams.get('code_challenge_method')).toBe('S256');
    expect(paraGoogle.searchParams.get('scope')).toBe('openid email profile');
    const state = opcoes.stateErrado
      ? 'outro-state'
      : (paraGoogle.searchParams.get('state') as string);
    const code = Buffer.from(
      JSON.stringify({
        email_verified: true,
        name: 'Pessoa Google',
        ...identidade,
      }),
    ).toString('base64url');
    const volta = await agente
      .get(`/auth/google/callback?code=${code}&state=${state}`)
      .expect(302);
    return volta.headers.location;
  }

  it('informa ao frontend que o Google está disponível', async () => {
    const res = await request(ctx.app).get('/auth/provedores').expect(200);
    expect(res.body).toEqual({ google: true });
  });

  it('quem já tem conta ativa com o mesmo e-mail entra, e a conta fica vinculada ao Google', async () => {
    const user = await criarUsuario(ctx, 'COLABORADOR');
    const agente = request.agent(URL_API_TESTE);
    const destino = await voltarDoGoogle(agente, {
      sub: `sub-${user.id}`,
      email: user.email.toUpperCase(),
    });
    expect(destino).toBe('http://localhost:5174/');
    const eu = await agente.get('/auth/me').expect(200);
    expect(eu.body.email).toBe(user.email);
    const vinculado = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(vinculado.google_sub).toBe(`sub-${user.id}`);
  });

  it('e-mail novo: completa o cadastro sem senha e vai direto para a fila, avisando a equipe', async () => {
    const admin = await criarUsuario(ctx, 'ADMIN');
    const email = emailUnico('novo');
    const agente = request.agent(URL_API_TESTE);
    const destino = await voltarDoGoogle(agente, {
      sub: `sub-${email}`,
      email,
      name: 'Nova Pessoa',
    });
    expect(destino).toBe('http://localhost:5174/cadastro?google=1');

    const pendente = await agente
      .get('/auth/google/cadastro-pendente')
      .expect(200);
    expect(pendente.body).toEqual({ nome: 'Nova Pessoa', email });

    await agente
      .post('/inscricao')
      .field('nome', 'Nova Pessoa')
      .field('email', email)
      .field('respostas', '{}')
      .expect(201);

    const criado = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(criado.situacao).toBe('PENDENTE');
    expect(criado.google_sub).toBe(`sub-${email}`);
    expect(ultimoEmail(admin.email).texto).toContain(email);
    // A identidade do Google só vale para um cadastro.
    await agente.get('/auth/google/cadastro-pendente').expect(404);
  });

  it('cadastro público sem Google continua exigindo senha', async () => {
    await request(ctx.app)
      .post('/inscricao')
      .field('nome', 'Sem Senha')
      .field('email', emailUnico('sem-senha'))
      .field('respostas', '{}')
      .expect(400);
  });

  it('e-mail não verificado pelo Google é recusado, sem criar nada', async () => {
    const email = emailUnico('nao-verificado');
    const agente = request.agent(URL_API_TESTE);
    const destino = await voltarDoGoogle(agente, {
      sub: `sub-${email}`,
      email,
      email_verified: false,
    });
    expect(destino).toContain('/login?erro=google-email');
    const existe = await ctx.prisma.user.findUnique({ where: { email } });
    expect(existe).toBeNull();
  });

  it('state diferente do que saiu (possível ataque de CSRF) é recusado', async () => {
    const user = await criarUsuario(ctx, 'COLABORADOR');
    const agente = request.agent(URL_API_TESTE);
    const destino = await voltarDoGoogle(
      agente,
      { sub: `sub-x-${user.id}`, email: user.email },
      { stateErrado: true },
    );
    expect(destino).toContain('/login?erro=google-falhou');
    await agente.get('/auth/me').expect(401);
  });

  it('cadastro ainda pendente não entra — volta para o login com o aviso', async () => {
    const user = await criarUsuario(ctx, 'COLABORADOR');
    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { situacao: 'PENDENTE' },
    });
    const agente = request.agent(URL_API_TESTE);
    const destino = await voltarDoGoogle(agente, {
      sub: `sub-${user.id}`,
      email: user.email,
    });
    expect(destino).toContain('/login?aviso=pendente');
    await agente.get('/auth/me').expect(401);
  });

  it('convite pendente: entrar pelo Google aceita o convite e ativa a conta', async () => {
    const user = await criarUsuario(ctx, 'REVISOR');
    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { situacao: 'CONVIDADO' },
    });
    const agente = request.agent(URL_API_TESTE);
    const destino = await voltarDoGoogle(agente, {
      sub: `sub-${user.id}`,
      email: user.email,
    });
    expect(destino).toBe('http://localhost:5174/');
    await agente.get('/auth/me').expect(200);
    const ativo = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(ativo.situacao).toBe('ATIVO');
  });

  it('conta desativada não entra pelo Google', async () => {
    const user = await criarUsuario(ctx, 'COLABORADOR');
    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { situacao: 'DESATIVADO' },
    });
    const agente = request.agent(URL_API_TESTE);
    const destino = await voltarDoGoogle(agente, {
      sub: `sub-${user.id}`,
      email: user.email,
    });
    expect(destino).toContain('/login?erro=conta-bloqueada');
    await agente.get('/auth/me').expect(401);
  });
});
