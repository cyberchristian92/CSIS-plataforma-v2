import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateEntregaDto } from './dto/create-entrega.dto';

@Injectable()
export class EntregasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(missaoId: string, dto: CreateEntregaDto, autorId: string) {
    const entrega = await this.prisma.$transaction(async (tx) => {
      const nova = await tx.entrega.create({
        data: { missao_id: missaoId, autor_id: autorId, conteudo: dto.conteudo },
      });
      await tx.missao.update({ where: { id: missaoId }, data: { status: 'EM_REVISAO' } });
      return nova;
    });

    await this.auditoriaService.registrar(autorId, 'SUBMETER', 'Entrega', entrega.id, null, entrega);
    return entrega;
  }

  listarPorMissao(missaoId: string) {
    return this.prisma.entrega.findMany({
      where: { missao_id: missaoId },
      orderBy: { criado_em: 'desc' },
      include: { autor: { select: { id: true, nome: true, email: true } } },
    });
  }

  async buscar(id: string) {
    const entrega = await this.prisma.entrega.findUnique({
      where: { id },
      include: {
        autor: { select: { id: true, nome: true, email: true } },
        revisoes: true,
        arquivos: true,
        missao: true,
      },
    });
    if (!entrega) {
      throw new NotFoundException('Entrega não encontrada.');
    }
    return entrega;
  }
}
