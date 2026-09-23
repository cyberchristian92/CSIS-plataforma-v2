import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EVT_CONTEUDO_ALTERADO, EVT_CONTEUDO_REMOVIDO } from '../integridade/integridade.events';
import { sha256Buffer } from './utils/hash.util';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');

@Injectable()
export class ArquivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly eventos: EventEmitter2,
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
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'arquivo', id: arquivo.id, userId: enviadoPor });

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

  async enviarEmWorkspace(workspaceId: string, file: Express.Multer.File, enviadoPor: string, pastaId: string | undefined) {
    const hash = sha256Buffer(file.buffer);
    const id = randomUUID();
    const caminho = join(UPLOADS_DIR, `${id}-${file.originalname}`);
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(caminho, file.buffer);
    const arquivo = await this.prisma.arquivo.create({
      data: { id, workspace_id: workspaceId, pasta_id: pastaId, nome: file.originalname, caminho, hash_sha256: hash, tamanho: file.size, tipo_mime: file.mimetype, enviado_por: enviadoPor },
    });
    await this.auditoriaService.registrar(enviadoPor, 'UPLOAD', 'Arquivo', arquivo.id, null, { nome: arquivo.nome, hash_sha256: arquivo.hash_sha256 });
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'arquivo', id: arquivo.id, userId: enviadoPor });
    return arquivo;
  }

  listarPorWorkspace(workspaceId: string, pastaId?: string) {
    return this.prisma.arquivo.findMany({
      where: { workspace_id: workspaceId, ...(pastaId !== undefined ? { pasta_id: pastaId === 'raiz' ? null : pastaId } : {}) },
      orderBy: { enviado_em: 'desc' },
    });
  }

  async enviarEmArea(areaId: string, file: Express.Multer.File, enviadoPor: string, pastaId: string | undefined) {
    const hash = sha256Buffer(file.buffer);
    const id = randomUUID();
    const caminho = join(UPLOADS_DIR, `${id}-${file.originalname}`);
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(caminho, file.buffer);
    const arquivo = await this.prisma.arquivo.create({
      data: { id, area_id: areaId, pasta_id: pastaId, nome: file.originalname, caminho, hash_sha256: hash, tamanho: file.size, tipo_mime: file.mimetype, enviado_por: enviadoPor },
    });
    await this.auditoriaService.registrar(enviadoPor, 'UPLOAD', 'Arquivo', arquivo.id, null, { nome: arquivo.nome, hash_sha256: arquivo.hash_sha256 });
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'arquivo', id: arquivo.id, userId: enviadoPor });
    return arquivo;
  }

  listarPorArea(areaId: string, pastaId?: string) {
    return this.prisma.arquivo.findMany({
      where: { area_id: areaId, ...(pastaId !== undefined ? { pasta_id: pastaId === 'raiz' ? null : pastaId } : {}) },
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
    // O nome entra na composição do hash do diretório-pai (ver
    // IntegridadeService.recalcularPasta) — mesmo sem o conteúdo mudar, o
    // hash do pai precisa refletir o novo nome.
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'arquivo', id, userId });
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    // Tolerante a arquivo já ausente do disco (ex.: alguém apagou manualmente)
    // — a exclusão do registro não deve travar por causa disso.
    await unlink(anterior.caminho).catch(() => undefined);
    await this.prisma.arquivo.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'Arquivo', id, {
      nome: anterior.nome,
      hash_sha256: anterior.hash_sha256,
    }, null);
    this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
      escopo: {
        pasta_id: anterior.pasta_id,
        missao_id: anterior.pasta_id ? null : anterior.missao_id,
        projeto_id: anterior.pasta_id ? null : anterior.projeto_id,
        area_id: anterior.pasta_id ? null : anterior.area_id,
        workspace_id: anterior.pasta_id ? null : anterior.workspace_id,
      },
      userId,
    });
    return { ok: true };
  }
}
