import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MissoesService } from '../missoes/missoes.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

export interface ResumoNotificacoes {
  /// Cadastros aguardando aprovação (quem pode ver a fila de solicitações).
  solicitacoes_cadastro?: number;
  /// Entregas aguardando revisão que a pessoa pode ver.
  fila_revisao?: number;
  /// Missões da pessoa devolvidas pelo revisor para correção.
  missoes_devolvidas: number;
}

const EQUIPE_DE_REVISAO = new Set(['ADMIN', 'LIDER', 'REVISOR']);

/// O que o sino do topo mostra: só contagens do que pede ação da pessoa.
@Injectable()
export class NotificacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missoesService: MissoesService,
  ) {}

  async resumo(user: AuthenticatedUser): Promise<ResumoNotificacoes> {
    const minhas = await this.missoesService.listarPorResponsavel(user);
    const resumo: ResumoNotificacoes = {
      missoes_devolvidas: minhas.filter(
        (m) =>
          m.status === 'EM_ANDAMENTO' &&
          m.ultima_entrega?.status === 'REJEITADA',
      ).length,
    };
    if (EQUIPE_DE_REVISAO.has(user.papel_global)) {
      resumo.solicitacoes_cadastro = await this.prisma.user.count({
        where: { situacao: 'PENDENTE' },
      });
      resumo.fila_revisao = (
        await this.missoesService.listarEmRevisao(user)
      ).length;
    }
    return resumo;
  }
}
