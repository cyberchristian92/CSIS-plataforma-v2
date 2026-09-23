import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateColunaDto } from './dto/create-coluna.dto';
import { UpdateColunaDto } from './dto/update-coluna.dto';
import { ReorderColunasDto } from './dto/reorder-colunas.dto';

@Injectable()
export class ColunasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(projetoId: string, dto: CreateColunaDto, userId: string) {
    const ordem = await this.prisma.coluna.count({ where: { projeto_id: projetoId } });
    const coluna = await this.prisma.coluna.create({
      data: { projeto_id: projetoId, nome: dto.nome, limite_wip: dto.limiteWip, ordem },
    });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'Coluna', coluna.id, null, coluna);
    return coluna;
  }

  listarPorProjeto(projetoId: string) {
    return this.prisma.coluna.findMany({ where: { projeto_id: projetoId }, orderBy: { ordem: 'asc' } });
  }

  async buscar(id: string) {
    const coluna = await this.prisma.coluna.findUnique({ where: { id } });
    if (!coluna) {
      throw new NotFoundException('Coluna não encontrada.');
    }
    return coluna;
  }

  async atualizar(id: string, dto: UpdateColunaDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.coluna.update({
      where: { id },
      data: {
        nome: dto.nome,
        // `undefined` no dto.limiteWip preserva o valor atual (Prisma ignora
        // chaves `undefined`); `null` explícito limpa o limite.
        limite_wip: dto.limiteWip,
      },
    });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'Coluna', id, anterior, atualizado);
    return atualizado;
  }

  async reordenar(projetoId: string, dto: ReorderColunasDto, userId: string) {
    await this.prisma.$transaction(
      dto.ordens.map(({ id, ordem }) =>
        this.prisma.coluna.update({ where: { id, projeto_id: projetoId }, data: { ordem } }),
      ),
    );
    await this.auditoriaService.registrar(
      userId,
      'REORDENAR',
      'Coluna',
      projetoId,
      null,
      dto.ordens.map(({ id, ordem }) => ({ id, ordem })),
    );
    return this.listarPorProjeto(projetoId);
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    const missoesNaColuna = await this.prisma.missao.count({ where: { coluna_id: id } });
    if (missoesNaColuna > 0) {
      throw new ConflictException('Mova os cards para outra coluna antes de excluir esta.');
    }
    await this.prisma.coluna.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'Coluna', id, anterior, null);
    return { ok: true };
  }
}
