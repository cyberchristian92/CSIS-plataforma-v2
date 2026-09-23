import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

/// Fluxo Missão → Entrega → Revisão (RF03, RF04, RNF03 do TCC).
describe('Fluxo de entrega e revisão', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  async function cenario() {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const especialista = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const outroColaborador = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const revisor = await criarUsuarioLogado(ctx, 'REVISOR');
    const { projeto } = await criarHierarquia(ctx, lider.user.id);
    const missao = await ctx.prisma.missao.create({
      data: {
        projeto_id: projeto.id,
        titulo: 'Extrair mensagens',
        responsaveis: { create: { user_id: especialista.user.id } },
      },
    });
    return { lider, especialista, outroColaborador, revisor, projeto, missao };
  }

  async function entregar(c: Awaited<ReturnType<typeof cenario>>) {
    await c.especialista.agente
      .patch(`/missoes/${c.missao.id}/iniciar`)
      .expect(200);
    const res = await c.especialista.agente
      .post(`/missoes/${c.missao.id}/entregas`)
      .send({ conteudo: 'relatório parcial' })
      .expect(201);
    return res.body as { id: string };
  }

  it('fluxo feliz: responsável entrega, revisor aprova', async () => {
    const c = await cenario();
    const entrega = await entregar(c);
    await c.revisor.agente
      .post(`/entregas/${entrega.id}/revisoes`)
      .send({ status: 'APROVADO' })
      .expect(201);
    const missao = await ctx.prisma.missao.findUniqueOrThrow({
      where: { id: c.missao.id },
    });
    expect(missao.status).toBe('APROVADA');
  });

  it('rejeição devolve a missão para correção e permite reenvio (RF04)', async () => {
    const c = await cenario();
    const primeira = await entregar(c);
    await c.revisor.agente
      .post(`/entregas/${primeira.id}/revisoes`)
      .send({ status: 'REJEITADO', comentario: 'faltou hash' })
      .expect(201);
    await c.especialista.agente
      .post(`/missoes/${c.missao.id}/entregas`)
      .send({ conteudo: 'v2' })
      .expect(201);
  });

  it('só um responsável pela missão pode entregar', async () => {
    const c = await cenario();
    await c.especialista.agente
      .patch(`/missoes/${c.missao.id}/iniciar`)
      .expect(200);
    await c.outroColaborador.agente
      .post(`/missoes/${c.missao.id}/entregas`)
      .send({ conteudo: 'entrega de terceiro' })
      .expect(403);
  });

  it('não aceita entrega de missão que não está em andamento', async () => {
    const c = await cenario();
    // PENDENTE: ainda não foi iniciada
    await c.especialista.agente
      .post(`/missoes/${c.missao.id}/entregas`)
      .send({ conteudo: 'x' })
      .expect(400);
    // EM_REVISAO: já há uma entrega aguardando revisão
    await entregar(c);
    await c.especialista.agente
      .post(`/missoes/${c.missao.id}/entregas`)
      .send({ conteudo: 'x' })
      .expect(400);
  });

  it('missão aprovada não pode ser reaberta por nova entrega nem por "iniciar"', async () => {
    const c = await cenario();
    const entrega = await entregar(c);
    await c.revisor.agente
      .post(`/entregas/${entrega.id}/revisoes`)
      .send({ status: 'APROVADO' })
      .expect(201);

    await c.especialista.agente
      .post(`/missoes/${c.missao.id}/entregas`)
      .send({ conteudo: 'x' })
      .expect(400);
    await c.especialista.agente
      .patch(`/missoes/${c.missao.id}/iniciar`)
      .expect(400);
    await c.lider.agente.patch(`/missoes/${c.missao.id}/iniciar`).expect(400);
    const missao = await ctx.prisma.missao.findUniqueOrThrow({
      where: { id: c.missao.id },
    });
    expect(missao.status).toBe('APROVADA');
  });

  it('SoD: responsável pela missão não aprova a própria missão, mesmo que outra pessoa tenha feito a entrega', async () => {
    const c = await cenario();
    // Revisor também é responsável pela missão; a entrega foi feita pelo outro responsável.
    await ctx.prisma.missaoResponsavel.create({
      data: { missao_id: c.missao.id, user_id: c.revisor.user.id },
    });
    const entrega = await entregar(c);
    await c.revisor.agente
      .post(`/entregas/${entrega.id}/revisoes`)
      .send({ status: 'APROVADO' })
      .expect(403);
  });

  it('SoD: autor da entrega não revisa a própria entrega', async () => {
    const c = await cenario();
    await ctx.prisma.user.update({
      where: { id: c.especialista.user.id },
      data: { papel_global: 'REVISOR' },
    });
    const entrega = await entregar(c);
    await c.especialista.agente
      .post(`/entregas/${entrega.id}/revisoes`)
      .send({ status: 'APROVADO' })
      .expect(403);
  });

  it('entrega já revisada não pode ser revisada de novo', async () => {
    const c = await cenario();
    const entrega = await entregar(c);
    await c.revisor.agente
      .post(`/entregas/${entrega.id}/revisoes`)
      .send({ status: 'REJEITADO' })
      .expect(201);
    await c.lider.agente
      .post(`/entregas/${entrega.id}/revisoes`)
      .send({ status: 'APROVADO' })
      .expect(400);
    const missao = await ctx.prisma.missao.findUniqueOrThrow({
      where: { id: c.missao.id },
    });
    expect(missao.status).toBe('EM_ANDAMENTO');
  });

  it('comentário removido fica registrado na auditoria', async () => {
    const c = await cenario();
    const comentario = await c.especialista.agente
      .post(`/missoes/${c.missao.id}/comentarios`)
      .send({ texto: 'observação importante' })
      .expect(201);
    await c.especialista.agente
      .delete(`/comentarios/${comentario.body.id}`)
      .expect(200);
    const log = await ctx.prisma.logAuditoria.findFirst({
      where: {
        acao: 'REMOVER',
        entidade: 'ComentarioMissao',
        entidade_id: comentario.body.id,
      },
    });
    expect(log?.dados_anteriores).toMatchObject({
      texto: 'observação importante',
    });
  });
});
