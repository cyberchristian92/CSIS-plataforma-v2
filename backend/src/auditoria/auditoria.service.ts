import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    userId: string | null,
    acao: string,
    entidade: string,
    entidadeId: string,
    dadosAnteriores?: Prisma.InputJsonValue | null,
    dadosNovos?: Prisma.InputJsonValue | null,
  ) {
    return this.prisma.logAuditoria.create({
      data: {
        user_id: userId,
        acao,
        entidade,
        entidade_id: entidadeId,
        dados_anteriores: dadosAnteriores ?? undefined,
        dados_novos: dadosNovos ?? undefined,
      },
    });
  }

  async listar(query: QueryAuditoriaDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.LogAuditoriaWhereInput = {
      entidade: query.entidade,
      entidade_id: query.entidadeId,
      user_id: query.userId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.logAuditoria.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, nome: true, email: true } } },
      }),
      this.prisma.logAuditoria.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /// Usado pela exportação de projeto: toda a trilha de auditoria de um
  /// conjunto de entidades relacionadas (projeto, suas missões, entregas,
  /// arquivos, documentos, pastas), em ordem cronológica.
  listarPorEntidades(entidadeIds: string[]) {
    return this.prisma.logAuditoria.findMany({
      where: { entidade_id: { in: entidadeIds } },
      orderBy: { timestamp: 'asc' },
      include: { user: { select: { id: true, nome: true, email: true } } },
    });
  }
}
