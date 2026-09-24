import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIR_LAUDO_TESTE } from './env-teste';
import {
  Contexto,
  criarApp,
  criarHierarquia,
  criarUsuarioLogado,
  encerrar,
} from './helpers';

/// O backend não chama o Pandoc: deixa um pedido na pasta compartilhada e
/// espera o motor (backend/pandoc/worker.sh) responder. Aqui um worker falso
/// faz o papel do motor, seguindo o mesmo protocolo.
describe('Laudo — fila do motor de compilação', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  async function documentoDeProjeto() {
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const { projeto } = await criarHierarquia(ctx, admin.user.id);
    const documento = await ctx.prisma.documento.create({
      data: {
        projeto_id: projeto.id,
        autor_id: admin.user.id,
        conteudo: '# Laudo de teste',
      },
    });
    return { admin, documento };
  }

  /// Responde ao próximo pedido do documento como o worker real faria.
  function workerFalso(documentoId: string, sucesso: boolean) {
    const dir = join(DIR_LAUDO_TESTE, documentoId);
    let pedido: { template: string } | null = null;
    let fonte = '';
    const intervalo = setInterval(() => {
      if (!existsSync(join(dir, 'pedido.json'))) return;
      clearInterval(intervalo);
      renameSync(join(dir, 'pedido.json'), join(dir, 'pedido.processando'));
      pedido = JSON.parse(readFileSync(join(dir, 'pedido.processando'), 'utf8'));
      fonte = readFileSync(join(dir, 'laudo.md'), 'utf8');
      if (sucesso) writeFileSync(join(dir, 'laudo.pdf'), '%PDF-1.7 falso');
      writeFileSync(join(dir, 'laudo.log'), sucesso ? '' : '! LaTeX Error: erro de teste');
      writeFileSync(join(dir, 'resultado.json'), JSON.stringify({ sucesso }));
    }, 100);
    return { recebido: () => ({ pedido, fonte }), parar: () => clearInterval(intervalo) };
  }

  it('entrega o pedido ao motor e devolve o PDF gerado', async () => {
    const { admin, documento } = await documentoDeProjeto();
    const worker = workerFalso(documento.id, true);

    const res = await admin.agente
      .post(`/documentos/${documento.id}/laudo/compilar`)
      .send({})
      .expect(201);
    worker.parar();

    expect(res.body.sucesso).toBe(true);
    expect(worker.recebido()).toEqual({
      pedido: { template: 'eisvogel' },
      fonte: '# Laudo de teste',
    });
    const pdf = await admin.agente
      .get(`/documentos/${documento.id}/laudo/pdf`)
      .expect(200);
    expect(pdf.body.toString()).toContain('%PDF');
  });

  it('repassa o log quando a compilação falha', async () => {
    const { admin, documento } = await documentoDeProjeto();
    const worker = workerFalso(documento.id, false);

    const res = await admin.agente
      .post(`/documentos/${documento.id}/laudo/compilar`)
      .send({})
      .expect(201);
    worker.parar();

    expect(res.body).toEqual({
      sucesso: false,
      log: '! LaTeX Error: erro de teste',
    });
  });

  it('avisa em poucos segundos quando o motor está parado', async () => {
    const { admin, documento } = await documentoDeProjeto();
    const inicio = Date.now();

    const res = await admin.agente
      .post(`/documentos/${documento.id}/laudo/compilar`)
      .send({})
      .expect(201);

    expect(res.body.sucesso).toBe(false);
    expect(res.body.log).toMatch(/motor de geração de PDF não respondeu/);
    expect(Date.now() - inicio).toBeLessThan(15_000);
    // O pedido sai da fila para não ser compilado depois, já velho.
    expect(existsSync(join(DIR_LAUDO_TESTE, documento.id, 'pedido.json'))).toBe(false);
  }, 20_000);
});
