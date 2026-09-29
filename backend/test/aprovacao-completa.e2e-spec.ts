import request from 'supertest';
import {
  Contexto,
  SENHA_PADRAO,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
  logar,
} from './helpers';

function emailUnico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.local`;
}

/// Aprovar um cadastro já deixa a pessoa pronta para trabalhar: papel,
/// equipes (Listas de Acesso) e áreas definidos na mesma decisão.
describe('Aprovação de cadastro com equipes e áreas', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
    await ctx.prisma.campoInscricao.updateMany({ data: { arquivado: true } });
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  /// Candidato com cadastro já na fila (PENDENTE), pronto para a decisão.
  async function candidatoPendente() {
    const email = emailUnico('candidato');
    await request(ctx.app)
      .post('/inscricao')
      .field('nome', 'Candidato Novo')
      .field('email', email)
      .field('senha', SENHA_PADRAO)
      .field('respostas', '{}')
      .expect(201);
    const user = await ctx.prisma.user.update({
      where: { email },
      data: { situacao: 'PENDENTE' },
      include: { inscricao: true },
    });
    return { user, inscricaoId: user.inscricao!.id };
  }

  it('aprovar com equipes e áreas: a pessoa entra já na equipe e enxergando só as áreas liberadas', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const liberada = await criarHierarquia(ctx);
    const outra = await criarHierarquia(ctx);
    const equipe = await ctx.prisma.lista.create({
      data: { workspace_id: liberada.workspace.id, nome: 'Equipe mobile' },
    });
    const { user, inscricaoId } = await candidatoPendente();

    await lider.agente
      .post(`/inscricoes/${inscricaoId}/aprovar`)
      .send({
        papelGlobal: 'COLABORADOR',
        listaIds: [equipe.id],
        areaIds: [liberada.area.id],
      })
      .expect(201);

    const membro = await ctx.prisma.listaMembro.findUnique({
      where: { lista_id_user_id: { lista_id: equipe.id, user_id: user.id } },
    });
    expect(membro).not.toBeNull();

    const agente = await logar(ctx, user.email);
    await agente.get(`/areas/${liberada.area.id}`).expect(200);
    await agente.get(`/areas/${outra.area.id}`).expect(403);
  });

  it('equipe ou área inexistente recusa a aprovação inteira, sem aprovar pela metade', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { area } = await criarHierarquia(ctx);
    const { user, inscricaoId } = await candidatoPendente();

    await lider.agente
      .post(`/inscricoes/${inscricaoId}/aprovar`)
      .send({
        papelGlobal: 'COLABORADOR',
        listaIds: ['00000000-0000-0000-0000-000000000000'],
        areaIds: [area.id],
      })
      .expect(400);

    const depois = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(depois.situacao).toBe('PENDENTE');
    const acessos = await ctx.prisma.acessoRecurso.count({
      where: { user_id: user.id },
    });
    expect(acessos).toBe(0);
  });

  it('a decisão fica na auditoria com as equipes e áreas liberadas', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { area } = await criarHierarquia(ctx);
    const { user, inscricaoId } = await candidatoPendente();

    await lider.agente
      .post(`/inscricoes/${inscricaoId}/aprovar`)
      .send({ papelGlobal: 'REVISOR', areaIds: [area.id] })
      .expect(201);

    const log = await ctx.prisma.logAuditoria.findFirstOrThrow({
      where: { acao: 'APROVAR_INSCRICAO', entidade_id: user.id },
    });
    expect(log.dados_novos).toMatchObject({
      papel_global: 'REVISOR',
      lista_ids: [],
      area_ids: [area.id],
    });
  });
});
