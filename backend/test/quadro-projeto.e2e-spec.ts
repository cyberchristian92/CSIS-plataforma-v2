import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

/// Quadro do projeto no modelo do Trello: "Adicionar um cartão" no pé de uma
/// lista cria o cartão naquela lista, no fim dela.
describe('Quadro do projeto: criar cartão numa lista', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  it('o cartão nasce na lista escolhida, depois dos que já estão nela', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, lider.user.id);
    const emAndamento = await ctx.prisma.coluna.create({
      data: { projeto_id: projeto.id, nome: 'Em andamento', ordem: 1 },
    });
    await ctx.prisma.missao.create({
      data: {
        projeto_id: projeto.id,
        titulo: 'Já estava aqui',
        coluna_id: emAndamento.id,
        ordem: 0,
      },
    });

    const res = await lider.agente
      .post(`/projetos/${projeto.id}/missoes`)
      .send({ titulo: 'Coletar logs', colunaId: emAndamento.id })
      .expect(201);

    expect(res.body.coluna_id).toBe(emAndamento.id);
    expect(res.body.ordem).toBe(1);
  });

  it('lista de outro projeto é recusada', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, lider.user.id);
    const outro = await criarHierarquia(ctx, lider.user.id);
    const listaAlheia = await ctx.prisma.coluna.findFirstOrThrow({
      where: { projeto_id: outro.projeto.id },
    });
    await lider.agente
      .post(`/projetos/${projeto.id}/missoes`)
      .send({ titulo: 'Coletar logs', colunaId: listaAlheia.id })
      .expect(400);
  });

  it('sem lista informada, continua indo para a primeira', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, lider.user.id);
    const primeira = await ctx.prisma.coluna.findFirstOrThrow({
      where: { projeto_id: projeto.id },
    });
    const res = await lider.agente
      .post(`/projetos/${projeto.id}/missoes`)
      .send({ titulo: 'Sem lista' })
      .expect(201);
    expect(res.body.coluna_id).toBe(primeira.id);
  });
});
