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

      // Segregation of Duties: quem executou a missão (o autor desta entrega
      // ou qualquer responsável por ela) não a avalia pelo caminho normal.
      // Exceção do TCC (v4, seções 4.2 e 8.3): em vez de uma trava absoluta,
      // a autoaprovação é tolerada — só para aprovar, justificativa opcional, e
      // registrada em destaque. A garantia passa da trava para a
      // responsabilização pela trilha de auditoria.
      const ehExecutor =
        entrega.autor_id === revisorId ||
        entrega.missao.responsaveis.some((r) => r.user_id === revisorId);
      if (ehExecutor) {
        if (!dto.autoaprovacao || dto.status !== 'APROVADO') {
          throw new ForbiddenException(
            'Você executou esta missão: outra pessoa deve revisá-la. Em caso excepcional (sem revisor disponível), use a autoaprovação.',
          );
        }
      }
      const autoaprovacao = ehExecutor;

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
          autoaprovacao,
          justificativa: autoaprovacao
            ? dto.justificativa?.trim() || null
            : null,
        },
      });
      return { revisao, entrega };
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { missao, ...entregaAnterior } = entrega;
    await this.auditoriaService.registrar(
      revisorId,
      revisao.autoaprovacao ? 'AUTOAPROVAR' : 'REVISAR',
      'Entrega',
      entregaId,
      entregaAnterior,
      {
        revisao_status: dto.status,
        entrega_status: statusEntrega,
        missao_status: statusMissao,
        comentario: dto.comentario ?? null,
        ...(revisao.autoaprovacao
          ? { justificativa: revisao.justificativa }
          : {}),
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
