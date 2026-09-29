import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateEntregaDto } from './dto/create-entrega.dto';

@Injectable()
export class EntregasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  /// Só quem é responsável pela missão entrega, e só com a missão EM_ANDAMENTO
  /// (iniciada, ou devolvida por uma rejeição). Sem isto, um terceiro podia
  /// entregar no lugar do responsável — e o responsável então aprovava o
  /// próprio trabalho, contornando a Segregação de Funções — ou reabrir uma
  /// missão já APROVADA mandando uma entrega nova.
  async criar(missaoId: string, dto: CreateEntregaDto, autorId: string) {
    const entrega = await this.prisma.$transaction(async (tx) => {
      const missao = await tx.missao.findUnique({
        where: { id: missaoId },
        include: { responsaveis: { select: { user_id: true } } },
      });
      if (!missao) {
        throw new NotFoundException('Missão não encontrada.');
      }
      if (!missao.responsaveis.some((r) => r.user_id === autorId)) {
        throw new ForbiddenException(
          'Só um responsável pela missão pode enviar entregas.',
        );
      }
      if (missao.status !== 'EM_ANDAMENTO') {
        throw new BadRequestException(
          `Só é possível entregar uma missão em andamento (status atual: ${missao.status}). ` +
            'Inicie a missão, ou aguarde a revisão da entrega anterior.',
        );
      }
      // updateMany com o status no filtro: se duas entregas chegarem ao mesmo
      // tempo, só a primeira muda a missão — a segunda vê count 0 e desiste.
      const { count } = await tx.missao.updateMany({
        where: { id: missaoId, status: 'EM_ANDAMENTO' },
        data: { status: 'EM_REVISAO' },
      });
      if (count === 0) {
        throw new BadRequestException(
          'A missão mudou de status durante a entrega — recarregue e tente de novo.',
        );
      }
      return tx.entrega.create({
        data: {
          missao_id: missaoId,
          autor_id: autorId,
          conteudo: dto.conteudo,
        },
      });
    });

    await this.auditoriaService.registrar(
      autorId,
      'SUBMETER',
      'Entrega',
      entrega.id,
      null,
      entrega,
    );
    return entrega;
  }

  listarPorMissao(missaoId: string) {
    return this.prisma.entrega.findMany({
      where: { missao_id: missaoId },
      orderBy: { criado_em: 'desc' },
      include: {
        autor: { select: { id: true, nome: true, email: true } },
        // Histórico completo de avaliações de cada entrega (inclusive
        // autoaprovações) — a missão guarda todas as revisões, não só o status.
        revisoes: {
          orderBy: { criado_em: 'asc' },
          include: {
            revisor: { select: { id: true, nome: true, email: true } },
          },
        },
        // O que foi entregue junto (laudo, evidências) — o revisor avalia a
        // entrega pelo histórico. Caminho no disco nunca sai da API.
        arquivos: {
          orderBy: { enviado_em: 'asc' },
          omit: { caminho: true },
        },
      },
    });
  }

  async buscar(id: string) {
    const entrega = await this.prisma.entrega.findUnique({
      where: { id },
      include: {
        autor: { select: { id: true, nome: true, email: true } },
        revisoes: true,
        arquivos: { omit: { caminho: true } },
        missao: true,
      },
    });
    if (!entrega) {
      throw new NotFoundException('Entrega não encontrada.');
    }
    return entrega;
  }
}
