import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreatePastaDto } from './dto/create-pasta.dto';
import { UpdatePastaDto } from './dto/update-pasta.dto';

@Injectable()
export class PastasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(projetoId: string, dto: CreatePastaDto, userId: string) {
    const pasta = await this.prisma.pasta.create({
      data: {
        projeto_id: projetoId,
        pasta_pai_id: dto.pastaPaiId,
        missao_id: dto.missaoId,
        nome: dto.nome,
      },
    });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'Pasta', pasta.id, null, pasta);
    return pasta;
  }

  listarPorProjeto(projetoId: string, pastaPaiId?: string) {
    return this.prisma.pasta.findMany({
      where: { projeto_id: projetoId, pasta_pai_id: pastaPaiId ?? null },
      orderBy: { nome: 'asc' },
    });
  }

  async buscar(id: string) {
    const pasta = await this.prisma.pasta.findUnique({ where: { id } });
    if (!pasta) {
      throw new NotFoundException('Pasta não encontrada.');
    }
    return pasta;
  }

  async atualizar(id: string, dto: UpdatePastaDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.pasta.update({
      where: { id },
      data: { nome: dto.nome, pasta_pai_id: dto.pastaPaiId },
    });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'Pasta', id, anterior, atualizado);
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    await this.prisma.pasta.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'Pasta', id, anterior, null);
    return { ok: true };
  }
}
