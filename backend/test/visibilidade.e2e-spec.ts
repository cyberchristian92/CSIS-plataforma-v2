import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

/// Visibilidade padrão (Arquitetura_Backend_Seguranca_CSIS.md, matriz RBAC):
/// o Colaborador só enxerga projetos em que está alocado, para os quais foi
/// incluído, ou marcados como públicos. Coordenação e revisão veem tudo que
/// não for restrito; Admin vê tudo.
describe('Visibilidade padrão por papel', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  it('colaborador não vê projeto em que não está alocado', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const aluno = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { workspace, area, projeto } = await criarHierarquia(
      ctx,
      admin.user.id,
    );
    await ctx.prisma.missao.create({
      data: { projeto_id: projeto.id, titulo: 'Caso de cliente' },
    });

    await aluno.agente.get(`/projetos/${projeto.id}`).expect(403);
    await aluno.agente.get(`/projetos/${projeto.id}/missoes`).expect(403);
    await aluno.agente.get(`/areas/${area.id}`).expect(403);
    const areas = await aluno.agente
      .get(`/workspaces/${workspace.id}/areas`)
      .expect(200);
    expect(areas.body).toEqual([]);
  });

  it('colaborador responsável por uma missão vê o projeto e a área dele', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const aluno = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { workspace, area, projeto } = await criarHierarquia(
      ctx,
      admin.user.id,
    );
    const outro = await ctx.prisma.projeto.create({
      data: { area_id: area.id, nome: 'Outro caso' },
    });
    await ctx.prisma.missao.create({
      data: {
        projeto_id: projeto.id,
        titulo: 'Minha',
        responsaveis: { create: { user_id: aluno.user.id } },
      },
    });

    await aluno.agente.get(`/projetos/${projeto.id}`).expect(200);
    await aluno.agente.get(`/areas/${area.id}`).expect(200);
    const areas = await aluno.agente
      .get(`/workspaces/${workspace.id}/areas`)
      .expect(200);
    expect(areas.body.map((a: { id: string }) => a.id)).toEqual([area.id]);
    const projetos = await aluno.agente
      .get(`/areas/${area.id}/projetos`)
      .expect(200);
    expect(projetos.body.map((p: { id: string }) => p.id)).toEqual([
      projeto.id,
    ]);
    await aluno.agente.get(`/projetos/${outro.id}`).expect(403);
    // O detalhe da área também não pode listar os outros casos.
    const detalheArea = await aluno.agente.get(`/areas/${area.id}`).expect(200);
    expect(detalheArea.body.projetos.map((p: { id: string }) => p.id)).toEqual([
      projeto.id,
    ]);
  });

  it('colaborador incluído no compartilhamento vê o projeto', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const aluno = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, admin.user.id);
    await admin.agente
      .put(`/compartilhamento/projeto/${projeto.id}`)
      .send({ restrito: false, listaIds: [], userIds: [aluno.user.id] })
      .expect(200);
    await aluno.agente.get(`/projetos/${projeto.id}`).expect(200);
  });

  it('projeto público é visível para qualquer colaborador', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const aluno = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, admin.user.id);
    await admin.agente
      .patch(`/projetos/${projeto.id}`)
      .send({ publico: true })
      .expect(200);
    await aluno.agente.get(`/projetos/${projeto.id}`).expect(200);
  });

  it('área pública mostra os próprios materiais, mas não abre os projetos dela', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const aluno = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { area, projeto } = await criarHierarquia(ctx, admin.user.id);
    await admin.agente
      .patch(`/areas/${area.id}`)
      .send({ publico: true })
      .expect(200);
    const doc = await ctx.prisma.documento.create({
      data: {
        area_id: area.id,
        autor_id: admin.user.id,
        conteudo: '# Material aberto',
      },
    });

    await aluno.agente.get(`/areas/${area.id}`).expect(200);
    await aluno.agente.get(`/documentos/${doc.id}`).expect(200);
    await aluno.agente.get(`/projetos/${projeto.id}`).expect(403);
    const projetos = await aluno.agente
      .get(`/areas/${area.id}/projetos`)
      .expect(200);
    expect(projetos.body).toEqual([]);
  });

  it('só Admin/Coordenador marcam algo como público', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const revisor = await criarUsuarioLogado(ctx, 'REVISOR');
    const { area } = await criarHierarquia(ctx, admin.user.id);
    await revisor.agente
      .patch(`/areas/${area.id}`)
      .send({ publico: true })
      .expect(403);
  });

  it('revisor e coordenador veem projetos não restritos mesmo sem alocação', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const revisor = await criarUsuarioLogado(ctx, 'REVISOR');
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, admin.user.id);
    await revisor.agente.get(`/projetos/${projeto.id}`).expect(200);
    await lider.agente.get(`/projetos/${projeto.id}`).expect(200);
  });

  it('colaborador perde o acesso quando deixa de ser responsável', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const aluno = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, admin.user.id);
    const missao = await ctx.prisma.missao.create({
      data: {
        projeto_id: projeto.id,
        titulo: 'Temporária',
        responsaveis: { create: { user_id: aluno.user.id } },
      },
    });
    await aluno.agente.get(`/projetos/${projeto.id}`).expect(200);
    await admin.agente
      .patch(`/missoes/${missao.id}/atribuir`)
      .send({ responsavelIds: [] })
      .expect(200);
    await aluno.agente.get(`/projetos/${projeto.id}`).expect(403);
  });
});
