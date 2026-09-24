import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

/// Todo projeto novo nasce com o fluxo Material → Processamento → Produção,
/// cada pasta com um documento explicando como usá-la.
describe('Estrutura inicial de pastas do projeto', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  it('cria Material, Processamento e Produção, cada uma com seu Leia-me', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { area } = await criarHierarquia(ctx, lider.user.id);
    const projeto = await lider.agente
      .post(`/areas/${area.id}/projetos`)
      .send({ nome: 'Caso novo' })
      .expect(201);

    const pastas = await lider.agente
      .get(`/projetos/${projeto.body.id}/pastas`)
      .expect(200);
    expect(pastas.body.map((p: { nome: string }) => p.nome)).toEqual([
      'Material',
      'Processamento',
      'Produção',
    ]);

    for (const pasta of pastas.body as {
      id: string;
      nome: string;
      criado_por_id: string;
    }[]) {
      expect(pasta.criado_por_id).toBe(lider.user.id);
      const docs = await lider.agente
        .get(`/projetos/${projeto.body.id}/documentos?pastaId=${pasta.id}`)
        .expect(200);
      expect(docs.body).toHaveLength(1);
      expect(docs.body[0].conteudo).toMatch(
        new RegExp(`^# Leia-me — ${pasta.nome}`),
      );
    }

    // Os Leia-me não ficam soltos na raiz.
    const raiz = await lider.agente
      .get(`/projetos/${projeto.body.id}/documentos?pastaId=raiz`)
      .expect(200);
    expect(raiz.body).toEqual([]);
  });

  it('a criação da estrutura fica registrada na auditoria', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { area } = await criarHierarquia(ctx, lider.user.id);
    const projeto = await lider.agente
      .post(`/areas/${area.id}/projetos`)
      .send({ nome: 'Caso auditado' })
      .expect(201);
    const pastas = await ctx.prisma.pasta.findMany({
      where: { projeto_id: projeto.body.id },
    });
    const logs = await ctx.prisma.logAuditoria.count({
      where: {
        acao: 'CRIAR',
        entidade: 'Pasta',
        entidade_id: { in: pastas.map((p) => p.id) },
      },
    });
    expect(logs).toBe(3);
  });
});
