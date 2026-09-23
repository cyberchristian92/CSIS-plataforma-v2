import { unlink, writeFile } from 'node:fs/promises';
import yauzl from 'yauzl';
import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
  alocar,
} from './helpers';

async function lerManifesto(zip: Buffer): Promise<Record<string, unknown>> {
  const arquivo = await yauzl.fromBufferPromise(zip, { lazyEntries: true });
  for await (const entrada of arquivo.eachEntry()) {
    if (entrada.fileName !== 'manifesto.json') continue;
    const partes: Buffer[] = [];
    for await (const parte of await arquivo.openReadStreamPromise(entrada))
      partes.push(parte as Buffer);
    return JSON.parse(Buffer.concat(partes).toString('utf8')) as Record<
      string,
      unknown
    >;
  }
  throw new Error('manifesto.json ausente');
}

function binario(
  res: any,
  callback: (erro: Error | null, corpo: Buffer) => void,
) {
  const partes: Buffer[] = [];
  res.on('data', (parte: Buffer) => partes.push(parte));
  res.on('end', () => callback(null, Buffer.concat(partes)));
}

describe('Pastas, arquivos e exportação', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  it('recusa mover uma pasta para dentro dela mesma ou de uma descendente (ciclo)', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const a = await agente
      .post(`/projetos/${projeto.id}/pastas`)
      .send({ nome: 'A' })
      .expect(201);
    const b = await agente
      .post(`/projetos/${projeto.id}/pastas`)
      .send({ nome: 'B', pastaPaiId: a.body.id })
      .expect(201);

    await agente
      .patch(`/pastas/${a.body.id}`)
      .send({ pastaPaiId: a.body.id })
      .expect(400);
    await agente
      .patch(`/pastas/${a.body.id}`)
      .send({ pastaPaiId: b.body.id })
      .expect(400);
    const pastaA = await ctx.prisma.pasta.findUniqueOrThrow({
      where: { id: a.body.id },
    });
    expect(pastaA.pasta_pai_id).toBeNull();
  });

  it('recusa pasta-pai de outro projeto', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'LIDER');
    const um = await criarHierarquia(ctx, user.id);
    const outro = await criarHierarquia(ctx, user.id);
    const estrangeira = await ctx.prisma.pasta.create({
      data: { projeto_id: outro.projeto.id, nome: 'Outra' },
    });
    await agente
      .post(`/projetos/${um.projeto.id}/pastas`)
      .send({ nome: 'X', pastaPaiId: estrangeira.id })
      .expect(400);
    const local = await ctx.prisma.pasta.create({
      data: { projeto_id: um.projeto.id, nome: 'Local' },
    });
    await agente
      .patch(`/pastas/${local.id}`)
      .send({ pastaPaiId: estrangeira.id })
      .expect(400);
  });

  it('permite mover pasta de volta para a raiz', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const a = await ctx.prisma.pasta.create({
      data: { projeto_id: projeto.id, nome: 'A' },
    });
    const b = await ctx.prisma.pasta.create({
      data: { projeto_id: projeto.id, nome: 'B', pasta_pai_id: a.id },
    });
    await agente
      .patch(`/pastas/${b.id}`)
      .send({ pastaPaiId: null })
      .expect(200);
    const pastaB = await ctx.prisma.pasta.findUniqueOrThrow({
      where: { id: b.id },
    });
    expect(pastaB.pasta_pai_id).toBeNull();
  });

  it('preserva acentos no nome do arquivo enviado', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const res = await agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('conteúdo'), 'relatório_perícia.txt')
      .expect(201);
    expect(res.body.nome).toBe('relatório_perícia.txt');
  });

  it('recusa upload apontando para pasta, missão ou entrega de outro projeto', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'LIDER');
    const um = await criarHierarquia(ctx, user.id);
    const outro = await criarHierarquia(ctx, user.id);
    const pasta = await ctx.prisma.pasta.create({
      data: { projeto_id: outro.projeto.id, nome: 'Outra' },
    });
    const missao = await ctx.prisma.missao.create({
      data: { projeto_id: outro.projeto.id, titulo: 'Outra' },
    });
    const entrega = await ctx.prisma.entrega.create({
      data: { missao_id: missao.id, autor_id: user.id },
    });

    for (const query of [
      `pastaId=${pasta.id}`,
      `missaoId=${missao.id}`,
      `entregaId=${entrega.id}`,
    ]) {
      await agente
        .post(`/projetos/${um.projeto.id}/arquivos?${query}`)
        .attach('arquivo', Buffer.from('x'), 'x.txt')
        .expect(400);
    }
  });

  it('só quem enviou (ou Admin/Coordenador) pode excluir um arquivo', async () => {
    const dono = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const colega = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, dono.user.id);
    await alocar(ctx, projeto.id, colega.user.id);
    const res = await dono.agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('evidência'), 'e.txt')
      .expect(201);
    await colega.agente.delete(`/arquivos/${res.body.id}`).expect(403);
    await dono.agente.delete(`/arquivos/${res.body.id}`).expect(200);
  });

  it('só o autor (ou Admin/Coordenador) pode excluir um documento', async () => {
    const autor = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const colega = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, autor.user.id);
    await alocar(ctx, projeto.id, colega.user.id);
    const doc = await autor.agente
      .post(`/projetos/${projeto.id}/documentos`)
      .send({ conteudo: '# laudo' })
      .expect(201);
    await colega.agente.delete(`/documentos/${doc.body.id}`).expect(403);
    await autor.agente.delete(`/documentos/${doc.body.id}`).expect(200);
  });

  it('exportação sinaliza no manifesto um arquivo que sumiu do disco em vez de omiti-lo em silêncio', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const up = await agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('prova'), 'prova.txt')
      .expect(201);
    const registro = await ctx.prisma.arquivo.findUniqueOrThrow({
      where: { id: up.body.id },
    });
    await unlink(registro.caminho);

    const res = await agente
      .get(`/projetos/${projeto.id}/exportar`)
      .buffer(true)
      .parse(binario)
      .expect(200);
    const manifesto = await lerManifesto(res.body as Buffer);
    expect(manifesto.arquivos_ausentes).toEqual([
      expect.objectContaining({
        id: up.body.id,
        nome: 'prova.txt',
        hash_sha256: up.body.hash_sha256,
      }),
    ]);
  });

  it('permite baixar o arquivo enviado, com o hash de integridade no cabeçalho', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const up = await agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('bytes da evidência'), 'laudo final.pdf')
      .expect(201);
    const res = await agente
      .get(`/arquivos/${up.body.id}/download`)
      .buffer(true)
      .parse(binario)
      .expect(200);
    expect((res.body as Buffer).toString('utf8')).toBe('bytes da evidência');
    expect(res.headers['x-hash-sha256']).toBe(up.body.hash_sha256);
    expect(res.headers['content-disposition']).toContain(
      "filename*=UTF-8''laudo%20final.pdf",
    );
  });

  it('download recusa arquivo adulterado em disco', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'COLABORADOR');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const up = await agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('original'), 'prova.txt')
      .expect(201);
    const registro = await ctx.prisma.arquivo.findUniqueOrThrow({
      where: { id: up.body.id },
    });
    await writeFile(registro.caminho, 'adulterado');
    const res = await agente
      .get(`/arquivos/${up.body.id}/download`)
      .expect(409);
    expect(res.body.message).toMatch(/integridade/i);
  });

  it('não expõe o caminho interno do servidor na resposta do upload', async () => {
    const { agente, user } = await criarUsuarioLogado(ctx, 'LIDER');
    const { projeto } = await criarHierarquia(ctx, user.id);
    const up = await agente
      .post(`/projetos/${projeto.id}/arquivos`)
      .attach('arquivo', Buffer.from('prova'), 'prova.txt')
      .expect(201);
    expect(up.body).not.toHaveProperty('caminho');
    const lista = await agente
      .get(`/projetos/${projeto.id}/arquivos`)
      .expect(200);
    expect(lista.body[0]).not.toHaveProperty('caminho');
  });
});
