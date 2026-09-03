import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { sha256Buffer } from './utils/hash.util';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');

@Injectable()
export class ArquivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async enviar(
    projetoId: string,
    file: Express.Multer.File,
    enviadoPor: string,
    entregaId: string | undefined,
    missaoId: string | undefined,
    pastaId: string | undefined,
  ) {
    const hash = sha256Buffer(file.buffer);
    const id = randomUUID();
    const caminho = join(UPLOADS_DIR, `${id}-${file.originalname}`);

    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(caminho, file.buffer);

    const arquivo = await this.prisma.arquivo.create({
      data: {
        id,
        projeto_id: projetoId,
        entrega_id: entregaId,
        missao_id: missaoId,
        pasta_id: pastaId,
        nome: file.originalname,
        caminho,
        hash_sha256: hash,
        tamanho: file.size,
        tipo_mime: file.mimetype,
        enviado_por: enviadoPor,
      },
    });

    // Equivalente às tarefas de serviço automáticas do BPMN (hash + auditoria a cada upload).
    await this.auditoriaService.registrar(enviadoPor, 'UPLOAD', 'Arquivo', arquivo.id, null, {
      nome: arquivo.nome,
      hash_sha256: arquivo.hash_sha256,
      tamanho: arquivo.tamanho,
    });

    return arquivo;
  }

  listarPorProjeto(projetoId: string, missaoId?: string, pastaId?: string) {
    return this.prisma.arquivo.findMany({
      where: {
        projeto_id: projetoId,
        missao_id: missaoId,
        ...(pastaId !== undefined ? { pasta_id: pastaId === 'raiz' ? null : pastaId } : {}),
      },
      orderBy: { enviado_em: 'desc' },
    });
  }

  async buscar(id: string) {
    const arquivo = await this.prisma.arquivo.findUnique({ where: { id } });
    if (!arquivo) {
      throw new NotFoundException('Arquivo não encontrado.');
    }
    return arquivo;
  }

  async verificarIntegridade(id: string) {
    const arquivo = await this.buscar(id);
    const conteudo = await readFile(arquivo.caminho);
    const hashAtual = sha256Buffer(conteudo);
    return { integro: hashAtual === arquivo.hash_sha256, hash_original: arquivo.hash_sha256, hash_atual: hashAtual };
  }

  // Só troca o nome de exibição (`nome`) — o arquivo em disco continua no
  // mesmo `caminho` (que já carrega um prefixo de id, nunca colide) e o hash
  // de integridade não é afetado. É esse `nome` que o compilador de laudo usa
  // pra resolver uma referência tipo `logo.png` no markdown (arquivos na raiz
  // do projeto, ver LaudoCompilerService.materializarArquivosDoProjeto).
  async renomear(id: string, novoNome: string, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.arquivo.update({ where: { id }, data: { nome: novoNome } });
    await this.auditoriaService.registrar(userId, 'RENOMEAR', 'Arquivo', id, { nome: anterior.nome }, { nome: novoNome });
    return atualizado;
  }
}
