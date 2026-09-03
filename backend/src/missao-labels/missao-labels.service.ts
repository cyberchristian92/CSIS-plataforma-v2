import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateMissaoLabelDto } from './dto/create-missao-label.dto';
import { UpdateMissaoLabelDto } from './dto/update-missao-label.dto';

@Injectable()
export class MissaoLabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(projetoId: string, dto: CreateMissaoLabelDto, userId: string) {
    const label = await this.prisma.missaoLabel.create({
      data: { projeto_id: projetoId, nome: dto.nome, cor: dto.cor },
    });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'MissaoLabel', label.id, null, label);
    return label;
  }

  listarPorProjeto(projetoId: string) {
    return this.prisma.missaoLabel.findMany({ where: { projeto_id: projetoId }, orderBy: { nome: 'asc' } });
  }

  async buscar(id: string) {
    const label = await this.prisma.missaoLabel.findUnique({ where: { id } });
    if (!label) {
      throw new NotFoundException('Label não encontrada.');
    }
    return label;
  }

  async atualizar(id: string, dto: UpdateMissaoLabelDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.missaoLabel.update({
      where: { id },
      data: { nome: dto.nome, cor: dto.cor },
    });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'MissaoLabel', id, anterior, atualizado);
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    await this.prisma.missaoLabel.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'MissaoLabel', id, anterior, null);
    return { ok: true };
  }
}
