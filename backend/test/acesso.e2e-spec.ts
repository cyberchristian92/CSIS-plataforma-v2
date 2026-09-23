import yauzl from 'yauzl';
import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

/// Listas de Acesso: um recurso marcado `restrito` precisa ficar inacessível
/// por QUALQUER rota — não só ao abrir o próprio recurso, mas também por
/// todo conteúdo que vive dentro dele (missões, arquivos, documentos...).
describe('Listas de Acesso — recurso restrito', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  async function cenarioProjetoRestrito() {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const intruso = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const convidado = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { area, projeto, workspace } = await criarHierarquia(
      ctx,
      admin.user.id,
    );

    const missao = await ctx.prisma.missao.create({
      data: { projeto_id: projeto.id, titulo: 'Sigilosa' },
    });
    const documento = await ctx.prisma.documento.create({
      data: {
        projeto_id: projeto.id,
        autor_id: admin.user.id,
        conteudo: '# segredo',
      },
    });
    const pasta = await ctx.prisma.pasta.create({
      data: { projeto_id: projeto.id, nome: 'Evidências' },
    });
    const arquivo = await ctx.prisma.arquivo.create({
      data: {
        projeto_id: projeto.id,
        nome: 'x.bin',
        caminho: '/nao/existe',
        hash_sha256: 'abc',
        tamanho: 1,
        tipo_mime: 'application/octet-stream',
        enviado_por: admin.user.id,
      },
    });
    const entrega = await ctx.prisma.entrega.create({
      data: {
        missao_id: missao.id,
        autor_id: admin.user.id,
        conteudo: 'resultado',
      },
    });
    const comentario = await ctx.prisma.comentarioMissao.create({
      data: { missao_id: missao.id, autor_id: admin.user.id, texto: 'nota' },
    });

    await admin.agente
      .put(`/compartilhamento/projeto/${projeto.id}`)
      .send({ restrito: true, listaIds: [], userIds: [convidado.user.id] })
      .expect(200);

    return {
      admin,
      intruso,
      convidado,
      workspace,
      area,
      projeto,
      missao,
      documento,
      pasta,
      arquivo,
      entrega,
      comentario,
    };
  }

  it('bloqueia toda rota de leitura de conteúdo do projeto para quem não tem acesso', async () => {
    const c = await cenarioProjetoRestrito();
    const rotas = [
      `/projetos/${c.projeto.id}`,
      `/projetos/${c.projeto.id}/missoes`,
      `/projetos/${c.projeto.id}/arquivos`,
      `/projetos/${c.projeto.id}/documentos`,
      `/projetos/${c.projeto.id}/pastas`,
      `/projetos/${c.projeto.id}/colunas`,
      `/projetos/${c.projeto.id}/labels`,
      `/projetos/${c.projeto.id}/exportar`,
      `/missoes/${c.missao.id}`,
      `/missoes/${c.missao.id}/entregas`,
      `/missoes/${c.missao.id}/comentarios`,
      `/missoes/${c.missao.id}/checklist`,
      `/entregas/${c.entrega.id}`,
      `/entregas/${c.entrega.id}/revisoes`,
      `/documentos/${c.documento.id}`,
      `/documentos/${c.documento.id}/laudo/pdf`,
      `/arquivos/${c.arquivo.id}`,
      `/arquivos/${c.arquivo.id}/verificar`,
      `/integridade/projeto/${c.projeto.id}`,
      `/integridade/missao/${c.missao.id}`,
      `/integridade/pasta/${c.pasta.id}`,
    ];
    for (const rota of rotas) {
      const res = await c.intruso.agente.get(rota);
      expect({ rota, status: res.status }).toEqual({ rota, status: 403 });
    }
  });

  it('bloqueia escrita em conteúdo do projeto para quem não tem acesso', async () => {
    const c = await cenarioProjetoRestrito();
    const a = c.intruso.agente;
    const tentativas: [string, () => PromiseLike<{ status: number }>][] = [
      [
        'criar documento',
        () =>
          a
            .post(`/projetos/${c.projeto.id}/documentos`)
            .send({ conteudo: 'x' }),
      ],
      [
        'criar pasta',
        () => a.post(`/projetos/${c.projeto.id}/pastas`).send({ nome: 'x' }),
      ],
      [
        'editar documento',
        () =>
          a
            .patch(`/documentos/${c.documento.id}`)
            .send({ conteudo: 'adulterado' }),
      ],
      ['excluir documento', () => a.delete(`/documentos/${c.documento.id}`)],
      ['excluir arquivo', () => a.delete(`/arquivos/${c.arquivo.id}`)],
      [
        'renomear pasta',
        () => a.patch(`/pastas/${c.pasta.id}`).send({ nome: 'renomeada' }),
      ],
      [
        'comentar',
        () =>
          a.post(`/missoes/${c.missao.id}/comentarios`).send({ texto: 'x' }),
      ],
      [
        'checklist',
        () => a.post(`/missoes/${c.missao.id}/checklist`).send({ texto: 'x' }),
      ],
      [
        'tags',
        () => a.patch(`/missoes/${c.missao.id}/tags`).send({ tags: ['x'] }),
      ],
      ['excluir comentário', () => a.delete(`/comentarios/${c.comentario.id}`)],
      [
        'upload',
        () =>
          a
            .post(`/projetos/${c.projeto.id}/arquivos`)
            .attach('arquivo', Buffer.from('x'), 'x.txt'),
      ],
    ];
    for (const [acao, executar] of tentativas) {
      const res = await executar();
      expect({ acao, status: res.status }).toEqual({ acao, status: 403 });
    }
    const doc = await ctx.prisma.documento.findUnique({
      where: { id: c.documento.id },
    });
    expect(doc?.conteudo).toBe('# segredo');
  });

  it('libera o conteúdo para quem foi incluído no compartilhamento', async () => {
    const c = await cenarioProjetoRestrito();
    await c.convidado.agente
      .get(`/projetos/${c.projeto.id}/missoes`)
      .expect(200);
    await c.convidado.agente.get(`/missoes/${c.missao.id}`).expect(200);
    await c.convidado.agente.get(`/documentos/${c.documento.id}`).expect(200);
  });

  it('libera o conteúdo para quem está numa Lista com acesso', async () => {
    const c = await cenarioProjetoRestrito();
    const lista = await ctx.prisma.lista.create({
      data: { workspace_id: c.workspace.id, nome: 'Equipe' },
    });
    await ctx.prisma.listaMembro.create({
      data: { lista_id: lista.id, user_id: c.intruso.user.id },
    });
    await c.admin.agente
      .put(`/compartilhamento/projeto/${c.projeto.id}`)
      .send({ restrito: true, listaIds: [lista.id], userIds: [] })
      .expect(200);
    await c.intruso.agente.get(`/projetos/${c.projeto.id}/missoes`).expect(200);
  });

  it('não expõe missões de projeto restrito na fila de revisão', async () => {
    const c = await cenarioProjetoRestrito();
    await ctx.prisma.missao.update({
      where: { id: c.missao.id },
      data: { status: 'EM_REVISAO' },
    });
    const revisor = await criarUsuarioLogado(ctx, 'REVISOR');
    const res = await revisor.agente.get('/missoes/em-revisao').expect(200);
    expect(res.body.map((m: { id: string }) => m.id)).not.toContain(
      c.missao.id,
    );
  });

  it('restrição na Área vale para os projetos dentro dela', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const intruso = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { area, projeto } = await criarHierarquia(ctx, admin.user.id);
    await admin.agente
      .put(`/compartilhamento/area/${area.id}`)
      .send({ restrito: true, listaIds: [], userIds: [] })
      .expect(200);

    await intruso.agente.get(`/projetos/${projeto.id}`).expect(403);
    await intruso.agente.get(`/projetos/${projeto.id}/missoes`).expect(403);
    await intruso.agente.get(`/areas/${area.id}/projetos`).expect(403);
  });

  it('pasta restrita esconde o próprio conteúdo, inclusive das listagens do projeto', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const colega = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, admin.user.id);
    const pasta = await ctx.prisma.pasta.create({
      data: { projeto_id: projeto.id, nome: 'Restrita' },
    });
    const sub = await ctx.prisma.pasta.create({
      data: { projeto_id: projeto.id, nome: 'Sub', pasta_pai_id: pasta.id },
    });
    const arquivo = await ctx.prisma.arquivo.create({
      data: {
        projeto_id: projeto.id,
        pasta_id: sub.id,
        nome: 'escondido.bin',
        caminho: '/nao/existe',
        hash_sha256: 'abc',
        tamanho: 1,
        tipo_mime: 'application/octet-stream',
        enviado_por: admin.user.id,
      },
    });
    const documento = await ctx.prisma.documento.create({
      data: {
        projeto_id: projeto.id,
        pasta_id: pasta.id,
        autor_id: admin.user.id,
        conteudo: 'oculto',
      },
    });
    await admin.agente
      .put(`/compartilhamento/pasta/${pasta.id}`)
      .send({ restrito: true, listaIds: [], userIds: [] })
      .expect(200);

    // O projeto em si continua visível...
    await colega.agente.get(`/projetos/${projeto.id}`).expect(200);
    // ...mas nada que esteja dentro da pasta restrita (nem em subpastas dela).
    await colega.agente.get(`/arquivos/${arquivo.id}`).expect(403);
    await colega.agente.get(`/documentos/${documento.id}`).expect(403);
    await colega.agente
      .get(`/projetos/${projeto.id}/pastas?pastaPaiId=${pasta.id}`)
      .expect(403);
    await colega.agente
      .get(`/projetos/${projeto.id}/arquivos?pastaId=${sub.id}`)
      .expect(403);

    const arquivos = await colega.agente
      .get(`/projetos/${projeto.id}/arquivos`)
      .expect(200);
    expect(arquivos.body.map((a: { id: string }) => a.id)).not.toContain(
      arquivo.id,
    );
    const documentos = await colega.agente
      .get(`/projetos/${projeto.id}/documentos`)
      .expect(200);
    expect(documentos.body.map((d: { id: string }) => d.id)).not.toContain(
      documento.id,
    );
    const pastas = await colega.agente
      .get(`/projetos/${projeto.id}/pastas`)
      .expect(200);
    expect(pastas.body.map((p: { id: string }) => p.id)).not.toContain(
      pasta.id,
    );
    const detalhe = await colega.agente
      .get(`/projetos/${projeto.id}`)
      .expect(200);
    expect(
      detalhe.body.arquivos.map((a: { id: string }) => a.id),
    ).not.toContain(arquivo.id);
    expect(
      detalhe.body.documentos.map((d: { id: string }) => d.id),
    ).not.toContain(documento.id);
  });

  it('Coordenador sem acesso não consegue desfazer a restrição de um projeto', async () => {
    const c = await cenarioProjetoRestrito();
    const liderDeFora = await criarUsuarioLogado(ctx, 'LIDER');
    await liderDeFora.agente
      .get(`/compartilhamento/projeto/${c.projeto.id}`)
      .expect(403);
    await liderDeFora.agente
      .put(`/compartilhamento/projeto/${c.projeto.id}`)
      .send({ restrito: false, listaIds: [], userIds: [] })
      .expect(403);
    const projeto = await ctx.prisma.projeto.findUniqueOrThrow({
      where: { id: c.projeto.id },
    });
    expect(projeto.restrito).toBe(true);
  });

  it('recusa tipo de recurso inválido no compartilhamento', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    await admin.agente
      .get(`/compartilhamento/user/${admin.user.id}`)
      .expect(400);
    await admin.agente
      .get(`/compartilhamento/missao/${admin.user.id}`)
      .expect(400);
  });

  it('exportação não inclui conteúdo de pasta restrita sem acesso', async () => {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, admin.user.id);
    const pasta = await ctx.prisma.pasta.create({
      data: { projeto_id: projeto.id, nome: 'Sigilo' },
    });
    await ctx.prisma.documento.create({
      data: {
        projeto_id: projeto.id,
        pasta_id: pasta.id,
        autor_id: admin.user.id,
        conteudo: 'CONTEUDO-SIGILOSO',
      },
    });
    await admin.agente
      .put(`/compartilhamento/pasta/${pasta.id}`)
      .send({ restrito: true, listaIds: [], userIds: [] })
      .expect(200);
    const res = await lider.agente
      .get(`/projetos/${projeto.id}/exportar`)
      .buffer(true)
      .parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on('data', (p: Buffer) => partes.push(p));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      })
      .expect(200);
    // zip comprimido: procura no manifesto (deflate) seria frágil; o
    // conteúdo sigiloso não pode aparecer nem descompactado nem no nome.
    const zip = await yauzl.fromBufferPromise(res.body as Buffer, {
      lazyEntries: true,
    });
    let tudo = '';
    for await (const entrada of zip.eachEntry()) {
      tudo += entrada.fileName;
      for await (const parte of await zip.openReadStreamPromise(entrada))
        tudo += (parte as Buffer).toString('utf8');
    }
    expect(tudo).not.toContain('CONTEUDO-SIGILOSO');
    expect(tudo).toContain('"itens_omitidos_por_restricao_de_acesso": 2');
  });

  it('quem cria uma pasta continua vendo ela depois de restringi-la', async () => {
    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, lider.user.id);
    const criada = await lider.agente
      .post(`/projetos/${projeto.id}/pastas`)
      .send({ nome: 'Minha' })
      .expect(201);
    await lider.agente
      .put(`/compartilhamento/pasta/${criada.body.id}`)
      .send({ restrito: true, listaIds: [], userIds: [] })
      .expect(200);
    await lider.agente
      .get(`/projetos/${projeto.id}/pastas?pastaPaiId=${criada.body.id}`)
      .expect(200);
  });
});
