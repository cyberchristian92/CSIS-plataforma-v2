import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EVT_CONTEUDO_REMOVIDO, EVT_HIERARQUIA_ALTERADA } from '../integridade/integridade.events';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly eventos: EventEmitter2,
  ) {}

  async criar(workspaceId: string, dto: CreateAreaDto, userId: string) {
    const area = await this.prisma.area.create({
      data: { ...dto, workspace_id: workspaceId },
    });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'Area', area.id, null, area);
    this.eventos.emit(EVT_HIERARQUIA_ALTERADA, { tipo: 'area', id: area.id, userId });
    return area;
  }

  listarPorWorkspace(workspaceId: string) {
    return this.prisma.area.findMany({ where: { workspace_id: workspaceId }, orderBy: { nome: 'asc' } });
  }

  async buscar(id: string) {
    const area = await this.prisma.area.findUnique({ where: { id }, include: { projetos: true } });
    if (!area) {
      throw new NotFoundException('Área não encontrada.');
    }
    return area;
  }

  async atualizar(id: string, dto: UpdateAreaDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.area.update({ where: { id }, data: dto });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'Area', id, anterior, atualizado);
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    await this.prisma.area.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'Area', id, anterior, null);
    this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
      escopo: { pasta_id: null, missao_id: null, projeto_id: null, area_id: null, workspace_id: anterior.workspace_id },
      userId,
    });
    return { ok: true };
  }
}
