import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

interface Cartao {
  id: string;
  checklist: { total: number; concluidos: number };
  contagens: { comentarios: number; anexos: number };
}

/// O card do quadro (estilo Trello) mostra, sem abrir a missão, o progresso
/// do checklist e quantos comentários e anexos ela tem — tanto no quadro do
/// projeto quanto em "Minhas Missões".
describe('Card da missão nos quadros', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  async function cenario() {
    const especialista = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx);
    const missao = await ctx.prisma.missao.create({
      data: {
        projeto_id: projeto.id,
        titulo: 'Extrair mensagens',
        responsaveis: { create: { user_id: especialista.user.id } },
      },
    });
    await ctx.prisma.checklistItem.createMany({
      data: [
        { missao_id: missao.id, texto: 'Calcular hash', concluido: true },
        { missao_id: missao.id, texto: 'Extrair WhatsApp', concluido: false },
      ],
    });
    await ctx.prisma.comentarioMissao.createMany({
      data: [
        { missao_id: missao.id, autor_id: especialista.user.id, texto: 'a' },
        { missao_id: missao.id, autor_id: especialista.user.id, texto: 'b' },
      ],
    });
    await especialista.agente
      .post(`/projetos/${projeto.id}/arquivos?missaoId=${missao.id}`)
      .attach('arquivo', Buffer.from('dump'), 'dump.bin')
      .expect(201);
    return { especialista, projeto, missao };
  }

  const esperado = {
    checklist: { total: 2, concluidos: 1 },
    contagens: { comentarios: 2, anexos: 1 },
  };

  it('quadro do projeto traz checklist, comentários e anexos de cada missão', async () => {
    const { especialista, projeto, missao } = await cenario();
    const res = await especialista.agente
      .get(`/projetos/${projeto.id}/missoes`)
      .expect(200);
    const cartao = (res.body as Cartao[]).find((m) => m.id === missao.id);
    expect(cartao).toMatchObject(esperado);
  });

  it('Minhas Missões traz as mesmas contagens', async () => {
    const { especialista, missao } = await cenario();
    const res = await especialista.agente.get('/missoes/minhas').expect(200);
    const cartao = (res.body as Cartao[]).find((m) => m.id === missao.id);
    expect(cartao).toMatchObject(esperado);
  });
});
