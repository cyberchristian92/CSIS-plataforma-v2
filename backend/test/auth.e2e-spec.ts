import request from 'supertest';
import {
  Contexto,
  SENHA_PADRAO,
  criarApp,
  criarUsuario,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

describe('Autenticação e sessão', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  it('mudança de papel vale imediatamente, sem esperar o token expirar', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    await lider.agente.get('/auth/usuarios').expect(200);

    await admin.agente
      .patch(`/auth/usuarios/${lider.user.id}/papel`)
      .send({ papelGlobal: 'COLABORADOR' })
      .expect(200);
    await lider.agente.get('/auth/usuarios').expect(403);
  });

  it('usuário removido do banco perde a sessão na hora', async () => {
    const colab = await criarUsuarioLogado(ctx, 'COLABORADOR');
    await colab.agente.get('/auth/me').expect(200);
    await ctx.prisma.user.delete({ where: { id: colab.user.id } });
    await colab.agente.get('/auth/me').expect(401);
  });

  it('usuário desativado não loga e perde a sessão existente', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const colab = await criarUsuarioLogado(ctx, 'COLABORADOR');
    await admin.agente
      .patch(`/auth/usuarios/${colab.user.id}/ativo`)
      .send({ ativo: false })
      .expect(200);
    await colab.agente.get('/auth/me').expect(401);
    await request(ctx.app)
      .post('/auth/login')
      .send({ email: colab.user.email, senha: SENHA_PADRAO })
      .expect(401);
  });

  it('logout invalida o token no servidor (não só apaga o cookie)', async () => {
    const colab = await criarUsuario(ctx, 'COLABORADOR');
    const servidor = ctx.app;
    const login = await request(servidor)
      .post('/auth/login')
      .send({ email: colab.email, senha: SENHA_PADRAO })
      .expect(200);
    const cookie = (
      login.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];

    await request(servidor).get('/auth/me').set('Cookie', cookie).expect(200);
    await request(servidor)
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(200);
    // Alguém que tivesse copiado o cookie antes do logout não consegue mais usá-lo.
    await request(servidor).get('/auth/me').set('Cookie', cookie).expect(401);
  });

  it('limita tentativas de login por e-mail (força bruta)', async () => {
    const alvo = await criarUsuario(ctx, 'ADMIN');
    const servidor = ctx.app;
    for (let i = 0; i < 10; i++) {
      await request(servidor)
        .post('/auth/login')
        .send({ email: alvo.email, senha: 'errada' })
        .expect(401);
    }
    await request(servidor)
      .post('/auth/login')
      .send({ email: alvo.email, senha: 'errada' })
      .expect(429);
    // Até a senha certa fica bloqueada enquanto dura a janela.
    await request(servidor)
      .post('/auth/login')
      .send({ email: alvo.email, senha: SENHA_PADRAO })
      .expect(429);
    // Outro usuário (mesmo IP) não é afetado — importante atrás de NAT/proxy.
    const outro = await criarUsuario(ctx, 'COLABORADOR');
    await request(servidor)
      .post('/auth/login')
      .send({ email: outro.email, senha: SENHA_PADRAO })
      .expect(200);
  });

  it('Coordenador não rebaixa nem desativa um Admin', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const admin = await criarUsuario(ctx, 'ADMIN');
    await lider.agente
      .patch(`/auth/usuarios/${admin.id}/papel`)
      .send({ papelGlobal: 'COLABORADOR' })
      .expect(403);
    await lider.agente
      .patch(`/auth/usuarios/${admin.id}/ativo`)
      .send({ ativo: false })
      .expect(403);
    const depois = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
    });
    expect(depois).toMatchObject({ papel_global: 'ADMIN', ativo: true });
  });

  it('e-mail de login não diferencia maiúsculas', async () => {
    const colab = await criarUsuario(ctx, 'COLABORADOR');
    await request(ctx.app)
      .post('/auth/login')
      .send({ email: colab.email.toUpperCase(), senha: SENHA_PADRAO })
      .expect(200);
  });
});
