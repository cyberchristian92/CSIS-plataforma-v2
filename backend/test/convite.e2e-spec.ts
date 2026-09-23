import request from 'supertest';
import {
  Contexto,
  criarApp,
  criarUsuarioLogado,
  encerrar,
  ultimoEmail,
} from './helpers';

function emailUnico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.local`;
}

/// Convite (Telas_Interface_Plataforma_CSIS.md, "Aceite de convite"): a
/// pessoa recebe um link e cria a própria senha — ninguém define senha por ela.
describe('Convite de usuário', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  it('admin convida, a pessoa define a própria senha e entra', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const email = emailUnico('convidado');
    const res = await admin.agente
      .post('/auth/convites')
      .send({ nome: 'Fulana Perita', email, papelGlobal: 'REVISOR' })
      .expect(201);
    expect(res.body.usuario).toMatchObject({ email, situacao: 'CONVIDADO' });
    // Sem SMTP configurado, a API devolve o link para o admin copiar.
    expect(res.body.email_enviado).toBe(false);
    expect(res.body.link).toContain('token=');

    const { token } = ultimoEmail(email);
    const servidor = request(ctx.app);
    await servidor
      .post('/auth/login')
      .send({ email, senha: 'SenhaNova123' })
      .expect(401);

    const previa = await servidor.get(`/auth/convites/${token}`).expect(200);
    expect(previa.body).toMatchObject({
      nome: 'Fulana Perita',
      email,
      papel_global: 'REVISOR',
    });

    await servidor
      .post('/auth/convites/aceitar')
      .send({ token, senha: 'SenhaNova123' })
      .expect(200);
    await servidor
      .post('/auth/login')
      .send({ email, senha: 'SenhaNova123' })
      .expect(200);
    // O link não vale uma segunda vez.
    await servidor
      .post('/auth/convites/aceitar')
      .send({ token, senha: 'OutraSenha123' })
      .expect(401);
  });

  it('e-mail de convite usa o nome da instância (white-label), não "CSIS" fixo', async () => {
    const marca = await request(ctx.app).get('/branding').expect(200);
    const nomeInstancia = marca.body.nome as string;
    expect(nomeInstancia).toBeTruthy();
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const email = emailUnico('marca');
    await admin.agente
      .post('/auth/convites')
      .send({ nome: 'Beltrano', email, papelGlobal: 'LIDER' })
      .expect(201);
    const mensagem = ultimoEmail(email);
    expect(mensagem.assunto).toContain(nomeInstancia);
    expect(mensagem.texto).toContain(nomeInstancia);
    expect(mensagem.texto).toContain('Coordenador');
    if (nomeInstancia !== 'CSIS')
      expect(`${mensagem.assunto} ${mensagem.texto}`).not.toContain('CSIS');
  });

  it('coordenador não convida alguém como Admin', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    await lider.agente
      .post('/auth/convites')
      .send({ nome: 'Xavier', email: emailUnico('x'), papelGlobal: 'ADMIN' })
      .expect(403);
  });

  it('não convida um e-mail que já tem conta', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    await admin.agente
      .post('/auth/convites')
      .send({ nome: 'Eu', email: admin.user.email, papelGlobal: 'COLABORADOR' })
      .expect(409);
  });

  it('token de convite não serve para redefinir senha (nem o contrário)', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const email = emailUnico('tipo');
    await admin.agente
      .post('/auth/convites')
      .send({ nome: 'Tipo', email, papelGlobal: 'COLABORADOR' })
      .expect(201);
    const { token } = ultimoEmail(email);
    await request(ctx.app)
      .post('/auth/redefinir-senha')
      .send({ token, novaSenha: 'SenhaNova123' })
      .expect(401);
  });

  it('admin pode reenviar o convite (o link anterior deixa de valer)', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const email = emailUnico('reenvio');
    const res = await admin.agente
      .post('/auth/convites')
      .send({ nome: 'Reenvio', email, papelGlobal: 'COLABORADOR' })
      .expect(201);
    const primeiro = ultimoEmail(email).token;
    await admin.agente
      .post(`/auth/convites/${res.body.usuario.id}/reenviar`)
      .expect(201);
    const segundo = ultimoEmail(email).token;
    expect(segundo).not.toBe(primeiro);
    await request(ctx.app).get(`/auth/convites/${primeiro}`).expect(401);
    await request(ctx.app).get(`/auth/convites/${segundo}`).expect(200);
  });

  it('cadastro direto com senha definida pelo admin não existe mais', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    await admin.agente
      .post('/auth/register')
      .send({
        nome: 'Y',
        email: emailUnico('y'),
        senha: 'SenhaDoAdmin1',
        papelGlobal: 'COLABORADOR',
      })
      .expect(404);
  });
});
