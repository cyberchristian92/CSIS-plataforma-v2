import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    const statusEntrega = dto.status === 'APROVADO' ? 'APROVADA' : 'REJEITADA';
    const statusMissao =
      dto.status === 'APROVADO' ? 'APROVADA' : 'EM_ANDAMENTO';

    const { revisao, entrega } = await this.prisma.$transaction(async (tx) => {
      const entrega = await tx.entrega.findUnique({
        where: { id: entregaId },
        include: {
          missao: { include: { responsaveis: { select: { user_id: true } } } },
        },
      });
      if (!entrega) {
        throw new NotFoundException('Entrega não encontrada.');
      }

      // Segregation of Duties: quem executou a missão não avalia o resultado —
      // nem o autor desta entrega, nem qualquer outro responsável pela missão
      // (senão bastava um colega "entregar" pra que o responsável aprovasse o
      // próprio trabalho).
      const ehResponsavel = entrega.missao.responsaveis.some(
        (r) => r.user_id === revisorId,
      );
      if (entrega.autor_id === revisorId || ehResponsavel) {
        throw new ForbiddenException(
          'Você não pode revisar uma entrega de missão pela qual é responsável (Segregation of Duties).',
        );
      }

      // Cada entrega é avaliada uma única vez, e só a que está aguardando
      // revisão — uma entrega antiga ou já avaliada não muda mais o status da
      // missão (o histórico precisa refletir exatamente o que foi decidido).
      if (
        entrega.status !== 'EM_REVISAO' ||
        entrega.missao.status !== 'EM_REVISAO'
      ) {
        throw new BadRequestException(
          `Esta entrega não está aguardando revisão (status: ${entrega.status}).`,
        );
      }

      const { count } = await tx.entrega.updateMany({
        where: { id: entregaId, status: 'EM_REVISAO' },
        data: { status: statusEntrega },
      });
      if (count === 0) {
        throw new BadRequestException(
          'Esta entrega acabou de ser revisada por outra pessoa.',
        );
      }
      await tx.missao.update({
        where: { id: entrega.missao_id },
        data: { status: statusMissao },
      });
      const revisao = await tx.revisao.create({
        data: {
          entrega_id: entregaId,
          revisor_id: revisorId,
          status: dto.status,
          comentario: dto.comentario,
        },
      });
      return { revisao, entrega };
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { missao, ...entregaAnterior } = entrega;
    await this.auditoriaService.registrar(
      revisorId,
      'REVISAR',
      'Entrega',
      entregaId,
      entregaAnterior,
      {
        revisao_status: dto.status,
        entrega_status: statusEntrega,
        missao_status: statusMissao,
        comentario: dto.comentario ?? null,
      },
    );

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
