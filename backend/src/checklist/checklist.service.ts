import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(missaoId: string, dto: CreateChecklistItemDto, userId: string) {
    const total = await this.prisma.checklistItem.count({ where: { missao_id: missaoId } });
    const item = await this.prisma.checklistItem.create({
      data: { missao_id: missaoId, texto: dto.texto, ordem: total },
    });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'ChecklistItem', item.id, null, item);
    return item;
  }

  listarPorMissao(missaoId: string) {
    return this.prisma.checklistItem.findMany({ where: { missao_id: missaoId }, orderBy: { ordem: 'asc' } });
  }

  async atualizar(id: string, dto: UpdateChecklistItemDto, userId: string) {
    const anterior = await this.prisma.checklistItem.findUnique({ where: { id } });
    if (!anterior) {
      throw new NotFoundException('Item de checklist não encontrado.');
    }
    const atualizado = await this.prisma.checklistItem.update({
      where: { id },
      data: { texto: dto.texto, concluido: dto.concluido },
    });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'ChecklistItem', id, anterior, atualizado);
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.prisma.checklistItem.findUnique({ where: { id } });
    if (!anterior) {
      throw new NotFoundException('Item de checklist não encontrado.');
    }
    await this.prisma.checklistItem.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'ChecklistItem', id, anterior, null);
    return { ok: true };
  }
}
