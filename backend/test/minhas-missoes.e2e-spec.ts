import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

interface MinhaMissao {
  id: string;
  projeto: { id: string; nome: string };
  checklist: { total: number; concluidos: number };
  ultima_entrega: {
    id: string;
    status: string;
    revisao: {
      status: string;
      comentario: string | null;
      revisor: { id: string; nome: string };
    } | null;
  } | null;
}

/// "Minhas Missões": a fila pessoal de trabalho do especialista.
describe('Minhas missões', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  async function missaoDe(
    projetoId: string,
    userId: string,
    titulo = 'Extrair mensagens',
  ) {
    return ctx.prisma.missao.create({
      data: {
        projeto_id: projetoId,
        titulo,
        responsaveis: { create: { user_id: userId } },
      },
    });
  }

  it('não lista missões de projeto arquivado', async () => {
    const especialista = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const ativo = await criarHierarquia(ctx);
    const arquivado = await criarHierarquia(ctx);
    const doAtivo = await missaoDe(ativo.projeto.id, especialista.user.id);
    const doArquivado = await missaoDe(
      arquivado.projeto.id,
      especialista.user.id,
    );
    await ctx.prisma.projeto.update({
      where: { id: arquivado.projeto.id },
      data: { status: 'ARQUIVADO' },
    });

    const res = await especialista.agente.get('/missoes/minhas').expect(200);
    const ids = (res.body as MinhaMissao[]).map((m) => m.id);
    expect(ids).toContain(doAtivo.id);
    expect(ids).not.toContain(doArquivado.id);
  });

  it('não lista missões de projeto a que a pessoa perdeu acesso', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const especialista = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const aberto = await criarHierarquia(ctx, admin.user.id);
    const fechado = await criarHierarquia(ctx, admin.user.id);
    const doAberto = await missaoDe(aberto.projeto.id, especialista.user.id);
    const doFechado = await missaoDe(fechado.projeto.id, especialista.user.id);
    await admin.agente
      .put(`/compartilhamento/projeto/${fechado.projeto.id}`)
      .send({ restrito: true, listaIds: [], userIds: [] })
      .expect(200);

    const res = await especialista.agente.get('/missoes/minhas').expect(200);
    const ids = (res.body as MinhaMissao[]).map((m) => m.id);
    expect(ids).toContain(doAberto.id);
    expect(ids).not.toContain(doFechado.id);
  });

  it('traz o projeto e o progresso do checklist', async () => {
    const especialista = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx);
    const missao = await missaoDe(projeto.id, especialista.user.id);
    await ctx.prisma.checklistItem.createMany({
      data: [
        { missao_id: missao.id, texto: 'Copiar imagem', concluido: true },
        { missao_id: missao.id, texto: 'Calcular hash', concluido: false },
        { missao_id: missao.id, texto: 'Extrair WhatsApp', concluido: false },
      ],
    });

    const res = await especialista.agente.get('/missoes/minhas').expect(200);
    const item = (res.body as MinhaMissao[]).find((m) => m.id === missao.id)!;
    expect(item.projeto).toEqual({ id: projeto.id, nome: projeto.nome });
    expect(item.checklist).toEqual({ total: 3, concluidos: 1 });
    expect(item.ultima_entrega).toBeNull();
  });

  it('missão devolvida traz a última entrega com quem rejeitou e por quê', async () => {
    const especialista = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const revisor = await criarUsuarioLogado(ctx, 'REVISOR', 'Revisora Ana');
    const { projeto } = await criarHierarquia(ctx);
    const missao = await missaoDe(projeto.id, especialista.user.id);
    await especialista.agente
      .patch(`/missoes/${missao.id}/iniciar`)
      .expect(200);
    const entrega = await especialista.agente
      .post(`/missoes/${missao.id}/entregas`)
      .send({ conteudo: 'v1' })
      .expect(201);
    await revisor.agente
      .post(`/entregas/${entrega.body.id}/revisoes`)
      .send({ status: 'REJEITADO', comentario: 'faltou o hash da imagem' })
      .expect(201);

    const res = await especialista.agente.get('/missoes/minhas').expect(200);
    const item = (res.body as MinhaMissao[]).find((m) => m.id === missao.id)!;
    expect(item.ultima_entrega).toMatchObject({
      id: entrega.body.id,
      status: 'REJEITADA',
      revisao: {
        status: 'REJEITADO',
        comentario: 'faltou o hash da imagem',
        revisor: { id: revisor.user.id, nome: 'Revisora Ana' },
      },
    });
  });

  it('histórico de entregas traz os arquivos anexados, sem o caminho no disco', async () => {
    const especialista = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx);
    const missao = await missaoDe(projeto.id, especialista.user.id);
    await especialista.agente
      .patch(`/missoes/${missao.id}/iniciar`)
      .expect(200);
    const entrega = await especialista.agente
      .post(`/missoes/${missao.id}/entregas`)
      .send({ conteudo: 'laudo em anexo' })
      .expect(201);
    await especialista.agente
      .post(
        `/projetos/${projeto.id}/arquivos?missaoId=${missao.id}&entregaId=${entrega.body.id}`,
      )
      .attach('arquivo', Buffer.from('%PDF laudo'), 'laudo.pdf')
      .expect(201);

    const res = await especialista.agente
      .get(`/missoes/${missao.id}/entregas`)
      .expect(200);
    const [ultima] = res.body as {
      arquivos: { nome: string; hash_sha256: string; caminho?: string }[];
    }[];
    expect(ultima.arquivos).toHaveLength(1);
    expect(ultima.arquivos[0].nome).toBe('laudo.pdf');
    expect(ultima.arquivos[0].hash_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(ultima.arquivos[0]).not.toHaveProperty('caminho');
  });
});
