import {
  Contexto,
  alocar,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

/// O que o explorador de arquivos (estilo Drive) precisa da API.
describe('Explorador de arquivos', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  it('lista todas as pastas do escopo (para busca e caminho), escondendo as restritas', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const colab = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, admin.user.id);
    await alocar(ctx, projeto.id, colab.user.id);
    const a = await ctx.prisma.pasta.create({
      data: { projeto_id: projeto.id, nome: 'A' },
    });
    const b = await ctx.prisma.pasta.create({
      data: { projeto_id: projeto.id, nome: 'B', pasta_pai_id: a.id },
    });
    const secreta = await ctx.prisma.pasta.create({
      data: { projeto_id: projeto.id, nome: 'Secreta' },
    });
    const dentro = await ctx.prisma.pasta.create({
      data: {
        projeto_id: projeto.id,
        nome: 'Dentro',
        pasta_pai_id: secreta.id,
      },
    });
    await admin.agente
      .put(`/compartilhamento/pasta/${secreta.id}`)
      .send({ restrito: true, listaIds: [], userIds: [] })
      .expect(200);

    const res = await colab.agente
      .get(`/projetos/${projeto.id}/pastas?todas=true`)
      .expect(200);
    const ids = res.body.map((p: { id: string }) => p.id);
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(ids).not.toContain(secreta.id);
    expect(ids).not.toContain(dentro.id);
  });

  it('arquivos vêm com o nome de quem enviou', async () => {
    const { agente, user } = await criarUsuarioLogado(
      ctx,
      'LIDER',
      'Perita Fulana',
    );
    const { projeto } = await criarHierarquia(ctx, user.id);
    await agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('x'), 'a.txt')
      .expect(201);
    const lista = await agente
      .get(`/projetos/${projeto.id}/arquivos`)
      .expect(200);
    expect(lista.body[0]).toMatchObject({ enviado_por_nome: 'Perita Fulana' });
  });

  it('visualização inline: mostra no navegador e registra VISUALIZAR (não DOWNLOAD)', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const up = await agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('conteúdo visível'), 'nota.txt')
      .expect(201);
    const res = await agente
      .get(`/arquivos/${up.body.id}/download?inline=1`)
      .expect(200);
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    const log = await ctx.prisma.logAuditoria.findFirst({
      where: { entidade_id: up.body.id, acao: 'VISUALIZAR' },
    });
    expect(log).not.toBeNull();
  });

  it('visualização inline nunca executa conteúdo: HTML/SVG vão como texto ou são recusados', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const html = await agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('<script>alert(1)</script>'), {
        filename: 'ataque.html',
        contentType: 'text/html',
      })
      .expect(201);
    const res = await agente
      .get(`/arquivos/${html.body.id}/download?inline=1`)
      .expect(415);
    expect(res.headers['content-type']).not.toMatch(/text\/html/);
    // Download normal continua possível, mas sempre como anexo e isolado.
    const baixado = await agente
      .get(`/arquivos/${html.body.id}/download`)
      .expect(200);
    expect(baixado.headers['content-disposition']).toMatch(/^attachment;/);
    expect(baixado.headers['x-content-type-options']).toBe('nosniff');
    expect(baixado.headers['content-security-policy']).toContain('sandbox');
  });

  it('histórico do arquivo: a cadeia de custódia dele, com quem fez cada ação', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER', 'Coordenadora Ana');
    const intruso = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, lider.user.id);
    const up = await lider.agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('prova'), 'prova.bin')
      .expect(201);
    await lider.agente
      .patch(`/arquivos/${up.body.id}`)
      .send({ nome: 'prova-renomeada.bin' })
      .expect(200);
    await lider.agente.get(`/arquivos/${up.body.id}/download`).expect(200);

    const res = await lider.agente
      .get(`/arquivos/${up.body.id}/historico`)
      .expect(200);
    expect(res.body.map((l: { acao: string }) => l.acao)).toEqual([
      'UPLOAD',
      'RENOMEAR',
      'DOWNLOAD',
    ]);
    expect(res.body[0].user).toMatchObject({ nome: 'Coordenadora Ana' });

    await intruso.agente.get(`/arquivos/${up.body.id}/historico`).expect(403);
  });

  it('histórico do documento', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const doc = await agente
      .post(`/projetos/${projeto.id}/documentos`)
      .send({ conteudo: '# v1' })
      .expect(201);
    await agente
      .patch(`/documentos/${doc.body.id}`)
      .send({ conteudo: '# v2' })
      .expect(200);
    const res = await agente
      .get(`/documentos/${doc.body.id}/historico`)
      .expect(200);
    expect(res.body.map((l: { acao: string }) => l.acao)).toEqual([
      'CRIAR',
      'ATUALIZAR',
    ]);
  });
});
