import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

/// Quadro livre (Minhas Missões): a missão pode voltar de etapa, a entrega
/// pode ser retirada e uma missão aprovada pode ser reaberta — sem trava,
/// mas cada movimento fica na auditoria (TCC, cap. 4.2 e 8.3). Os passos
/// do processo (iniciar, entregar, revisar) continuam nas ações próprias.
describe('Quadro livre: mover a missão de status', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  async function cenario() {
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
    return { especialista, revisor, projeto, missao };
  }

  async function status(missaoId: string) {
    return (
      await ctx.prisma.missao.findUniqueOrThrow({ where: { id: missaoId } })
    ).status;
  }

  it('volta de Em Andamento para Pendente, e a auditoria registra de onde para onde', async () => {
    const { especialista, missao } = await cenario();
    await especialista.agente
      .patch(`/missoes/${missao.id}/iniciar`)
      .expect(200);

    await especialista.agente
      .patch(`/missoes/${missao.id}/status`)
      .send({ status: 'PENDENTE' })
      .expect(200);

    expect(await status(missao.id)).toBe('PENDENTE');
    const log = await ctx.prisma.logAuditoria.findFirstOrThrow({
      where: { acao: 'MOVER_STATUS', entidade_id: missao.id },
    });
    expect(log.user_id).toBe(especialista.user.id);
    expect(log.dados_anteriores).toMatchObject({ status: 'EM_ANDAMENTO' });
    expect(log.dados_novos).toMatchObject({ status: 'PENDENTE' });
  });

  it('retirar da revisão: a entrega fica RETIRADA e dá para entregar de novo', async () => {
    const { especialista, missao } = await cenario();
    await especialista.agente
      .patch(`/missoes/${missao.id}/iniciar`)
      .expect(200);
    const entrega = await especialista.agente
      .post(`/missoes/${missao.id}/entregas`)
      .send({ conteudo: 'v1' })
      .expect(201);

    await especialista.agente
      .patch(`/missoes/${missao.id}/status`)
      .send({ status: 'EM_ANDAMENTO' })
      .expect(200);

    expect(await status(missao.id)).toBe('EM_ANDAMENTO');
    const retirada = await ctx.prisma.entrega.findUniqueOrThrow({
      where: { id: entrega.body.id },
    });
    expect(retirada.status).toBe('RETIRADA');
    await especialista.agente
      .post(`/missoes/${missao.id}/entregas`)
      .send({ conteudo: 'v2' })
      .expect(201);
  });

  it('reabre uma missão aprovada; a aprovação continua no histórico', async () => {
    const { especialista, revisor, missao } = await cenario();
    await especialista.agente
      .patch(`/missoes/${missao.id}/iniciar`)
      .expect(200);
    const entrega = await especialista.agente
      .post(`/missoes/${missao.id}/entregas`)
      .send({ conteudo: 'v1' })
      .expect(201);
    await revisor.agente
      .post(`/entregas/${entrega.body.id}/revisoes`)
      .send({ status: 'APROVADO' })
      .expect(201);

    await especialista.agente
      .patch(`/missoes/${missao.id}/status`)
      .send({ status: 'EM_ANDAMENTO' })
      .expect(200);

    expect(await status(missao.id)).toBe('EM_ANDAMENTO');
    const aprovada = await ctx.prisma.entrega.findUniqueOrThrow({
      where: { id: entrega.body.id },
    });
    expect(aprovada.status).toBe('APROVADA');
  });

  it('quem não é responsável nem da equipe de gestão/revisão não move', async () => {
    const { missao, projeto } = await cenario();
    const outro = await criarUsuarioLogado(ctx, 'COLABORADOR');
    await ctx.prisma.missao.create({
      data: {
        projeto_id: projeto.id,
        titulo: 'Outra',
        responsaveis: { create: { user_id: outro.user.id } },
      },
    });
    await outro.agente
      .patch(`/missoes/${missao.id}/status`)
      .send({ status: 'EM_ANDAMENTO' })
      .expect(403);
  });

  it('quadro livre de verdade: vai direto para Em Revisão ou Aprovada, e fica na auditoria', async () => {
    const { especialista, missao } = await cenario();
    await especialista.agente
      .patch(`/missoes/${missao.id}/status`)
      .send({ status: 'APROVADA' })
      .expect(200);
    expect(await status(missao.id)).toBe('APROVADA');
    await especialista.agente
      .patch(`/missoes/${missao.id}/status`)
      .send({ status: 'EM_REVISAO' })
      .expect(200);
    expect(await status(missao.id)).toBe('EM_REVISAO');
    const movimentos = await ctx.prisma.logAuditoria.count({
      where: { acao: 'MOVER_STATUS', entidade_id: missao.id },
    });
    expect(movimentos).toBe(2);
  });

  it('status que não existe é recusado', async () => {
    const { especialista, missao } = await cenario();
    await especialista.agente
      .patch(`/missoes/${missao.id}/status`)
      .send({ status: 'QUALQUER' })
      .expect(400);
  });
});
