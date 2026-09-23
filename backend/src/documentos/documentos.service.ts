import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EVT_CONTEUDO_ALTERADO, EVT_CONTEUDO_REMOVIDO } from '../integridade/integridade.events';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  async criar(projetoId: string, dto: CreateDocumentoDto, autorId: string) {
    const documento = await this.prisma.documento.create({
      data: {
        projeto_id: projetoId,
        missao_id: dto.missaoId,
        pasta_id: dto.pastaId === 'raiz' ? null : dto.pastaId,
        autor_id: autorId,
        conteudo: dto.conteudo,
        tags: dto.tags ?? [],
      },
    });
    await this.auditoriaService.registrar(autorId, 'CRIAR', 'Documento', documento.id, null, documento);
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'documento', id: documento.id, userId: autorId });
    return documento;
  }

  listarPorProjeto(projetoId: string, missaoId?: string, pastaId?: string) {
    return this.prisma.documento.findMany({
      where: {
        projeto_id: projetoId,
        missao_id: missaoId,
        ...(pastaId !== undefined ? { pasta_id: pastaId === 'raiz' ? null : pastaId } : {}),
      },
      orderBy: { atualizado_em: 'desc' },
    });
  }

  async criarEmWorkspace(workspaceId: string, dto: CreateDocumentoDto, autorId: string) {
    const documento = await this.prisma.documento.create({
      data: { workspace_id: workspaceId, pasta_id: dto.pastaId === 'raiz' ? null : dto.pastaId, autor_id: autorId, conteudo: dto.conteudo, tags: dto.tags ?? [] },
    });
    await this.auditoriaService.registrar(autorId, 'CRIAR', 'Documento', documento.id, null, documento);
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'documento', id: documento.id, userId: autorId });
    return documento;
  }

  listarPorWorkspace(workspaceId: string, pastaId?: string) {
    return this.prisma.documento.findMany({
      where: { workspace_id: workspaceId, ...(pastaId !== undefined ? { pasta_id: pastaId === 'raiz' ? null : pastaId } : {}) },
      orderBy: { atualizado_em: 'desc' },
    });
  }

  async criarEmArea(areaId: string, dto: CreateDocumentoDto, autorId: string) {
    const documento = await this.prisma.documento.create({
      data: { area_id: areaId, pasta_id: dto.pastaId === 'raiz' ? null : dto.pastaId, autor_id: autorId, conteudo: dto.conteudo, tags: dto.tags ?? [] },
    });
    await this.auditoriaService.registrar(autorId, 'CRIAR', 'Documento', documento.id, null, documento);
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'documento', id: documento.id, userId: autorId });
    return documento;
  }

  listarPorArea(areaId: string, pastaId?: string) {
    return this.prisma.documento.findMany({
      where: { area_id: areaId, ...(pastaId !== undefined ? { pasta_id: pastaId === 'raiz' ? null : pastaId } : {}) },
      orderBy: { atualizado_em: 'desc' },
    });
  }

  async buscar(id: string) {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }
    return documento;
  }

  async atualizar(id: string, dto: UpdateDocumentoDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.documento.update({
      where: { id },
      data: { conteudo: dto.conteudo, tags: dto.tags, pasta_id: dto.pastaId === 'raiz' ? null : dto.pastaId },
    });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'Documento', id, anterior, atualizado);
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'documento', id, userId });
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    await this.prisma.documento.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'Documento', id, anterior, null);
    // Não há mais o próprio nó pra recalcular — sobe direto a partir do
    // escopo em que ele vivia (com o filho já removido do banco).
    this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
      escopo: {
        pasta_id: anterior.pasta_id,
        missao_id: anterior.missao_id,
        projeto_id: anterior.projeto_id,
        area_id: anterior.area_id,
        workspace_id: anterior.workspace_id,
      },
      userId,
    });
    return { ok: true };
  }
}
