import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateRevisaoDto } from './dto/create-revisao.dto';

@Injectable()
export class RevisoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(entregaId: string, dto: CreateRevisaoDto, revisorId: string) {
    const entrega = await this.prisma.entrega.findUnique({ where: { id: entregaId } });
    if (!entrega) {
      throw new NotFoundException('Entrega não encontrada.');
    }

    // Segregation of Duties: quem executou a missão não pode revisar a própria entrega.
    if (entrega.autor_id === revisorId) {
      throw new ForbiddenException('Você não pode revisar a própria entrega (Segregation of Duties).');
    }

    const statusEntrega = dto.status === 'APROVADO' ? 'APROVADA' : 'REJEITADA';
    const statusMissao = dto.status === 'APROVADO' ? 'APROVADA' : 'EM_ANDAMENTO';

    const revisao = await this.prisma.$transaction(async (tx) => {
      const nova = await tx.revisao.create({
        data: {
          entrega_id: entregaId,
          revisor_id: revisorId,
          status: dto.status,
          comentario: dto.comentario,
        },
      });
      await tx.entrega.update({ where: { id: entregaId }, data: { status: statusEntrega } });
      await tx.missao.update({ where: { id: entrega.missao_id }, data: { status: statusMissao } });
      return nova;
    });

    await this.auditoriaService.registrar(revisorId, 'REVISAR', 'Entrega', entregaId, entrega, {
      revisao_status: dto.status,
      entrega_status: statusEntrega,
      missao_status: statusMissao,
    });

    return revisao;
  }

  listarPorEntrega(entregaId: string) {
    return this.prisma.revisao.findMany({
      where: { entrega_id: entregaId },
      orderBy: { criado_em: 'desc' },
      include: { revisor: { select: { id: true, nome: true, email: true } } },
    });
  }
}
