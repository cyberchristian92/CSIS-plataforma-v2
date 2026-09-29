import request from 'supertest';
import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuario,
  criarUsuarioLogado,
  encerrar,
  ultimoEmail,
} from './helpers';

function emailUnico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.local`;
}

interface Resumo {
  solicitacoes_cadastro?: number;
  fila_revisao?: number;
  missoes_devolvidas: number;
}

/// A equipe fica sabendo dos pedidos de cadastro sem precisar ir procurar:
/// e-mail para quem pode aprovar e o resumo do sino de notificações.
describe('Aviso de cadastro e resumo de notificações', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
    // Formulário só com nome/e-mail/senha: campos de outros testes ficariam
    // exigindo respostas.
    await ctx.prisma.campoInscricao.updateMany({ data: { arquivado: true } });
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  function inscrever(email: string) {
    return request(ctx.app)
      .post('/inscricao')
      .field('nome', 'Candidata Nova')
      .field('email', email)
      .field('senha', 'SenhaDaCandidata1')
      .field('respostas', '{}')
      .expect(201);
  }

  it('confirmar o e-mail do cadastro avisa Admins e Coordenadores ativos, com o link da solicitação', async () => {
    const admin = await criarUsuario(ctx, 'ADMIN');
    const lider = await criarUsuario(ctx, 'LIDER');
    const revisor = await criarUsuario(ctx, 'REVISOR');
    const especialista = await criarUsuario(ctx, 'COLABORADOR');
    const email = emailUnico('candidata');

    await inscrever(email);
    const { token } = ultimoEmail(email);
    await request(ctx.app)
      .post('/auth/confirmar-email')
      .send({ token })
      .expect(200);

    for (const quemAprova of [admin, lider]) {
      const aviso = ultimoEmail(quemAprova.email);
      expect(aviso.assunto).toMatch(/nova solicitação de cadastro/i);
      expect(aviso.texto).toContain('Candidata Nova');
      expect(aviso.texto).toContain(email);
      expect(aviso.texto).toContain('/usuarios?aba=solicitacoes');
    }
    // Quem não aprova cadastros não recebe o aviso.
    expect(() => ultimoEmail(revisor.email)).toThrow();
    expect(() => ultimoEmail(especialista.email)).toThrow();
  });

  it('cadastro com e-mail ainda não confirmado não avisa ninguém', async () => {
    const admin = await criarUsuario(ctx, 'ADMIN');
    await inscrever(emailUnico('sem-confirmar'));
    expect(() => ultimoEmail(admin.email)).toThrow();
  });

  it('resumo do sino: a equipe vê solicitações pendentes e a fila de revisão', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const antes = (await lider.agente.get('/notificacoes/resumo').expect(200))
      .body as Resumo;

    const email = emailUnico('pendente');
    await inscrever(email);
    const { token } = ultimoEmail(email);
    await request(ctx.app)
      .post('/auth/confirmar-email')
      .send({ token })
      .expect(200);

    const depois = (await lider.agente.get('/notificacoes/resumo').expect(200))
      .body as Resumo;
    expect(depois.solicitacoes_cadastro).toBe(
      (antes.solicitacoes_cadastro ?? 0) + 1,
    );
    expect(typeof depois.fila_revisao).toBe('number');
  });

  it('resumo do sino: o especialista vê as próprias missões devolvidas, e não a fila da equipe', async () => {
    const especialista = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const revisor = await criarUsuarioLogado(ctx, 'REVISOR');
    const { projeto } = await criarHierarquia(ctx);
    const missao = await ctx.prisma.missao.create({
      data: {
        projeto_id: projeto.id,
        titulo: 'Extrair mensagens',
        responsaveis: { create: { user_id: especialista.user.id } },
      },
    });
    await especialista.agente
      .patch(`/missoes/${missao.id}/iniciar`)
      .expect(200);
    const entrega = await especialista.agente
      .post(`/missoes/${missao.id}/entregas`)
      .send({ conteudo: 'v1' })
      .expect(201);
    await revisor.agente
      .post(`/entregas/${entrega.body.id}/revisoes`)
      .send({ status: 'REJEITADO', comentario: 'faltou o hash' })
      .expect(201);

    const res = await especialista.agente
      .get('/notificacoes/resumo')
      .expect(200);
    expect(res.body).toEqual({ missoes_devolvidas: 1 });
  });
});
