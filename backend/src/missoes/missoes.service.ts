import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EscopoService } from '../acesso/escopo.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PALETA_HEX } from '../common/constants/paleta-cores';
import {
  EVT_CONTEUDO_REMOVIDO,
  EVT_HIERARQUIA_ALTERADA,
} from '../integridade/integridade.events';
import { CreateMissaoDto } from './dto/create-missao.dto';
import { UpdateMissaoDto } from './dto/update-missao.dto';

const INCLUDE_PADRAO = {
  coluna: true,
  responsaveis: {
    include: { user: { select: { id: true, nome: true, email: true } } },
  },
  labels: { include: { label: true } },
} as const;

@Injectable()
export class MissoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly eventos: EventEmitter2,
    private readonly escopoService: EscopoService,
  ) {}

  async criar(projetoId: string, dto: CreateMissaoDto, userId: string) {
    // Board Kanban: a missão nova entra na primeira coluna do projeto (se
    // existir alguma), no fim dela — puramente organizacional, não influencia
    // `status` (que continua nascendo PENDENTE por padrão do schema).
    const primeiraColuna = await this.prisma.coluna.findFirst({
      where: { projeto_id: projetoId },
      orderBy: { ordem: 'asc' },
    });
    const ordem = primeiraColuna
      ? await this.prisma.missao.count({
          where: { coluna_id: primeiraColuna.id },
        })
      : 0;

    const missao = await this.prisma.missao.create({
      data: {
        projeto_id: projetoId,
        titulo: dto.titulo,
        descricao: dto.descricao,
        criterio_aceite: dto.criterio_aceite,
        valor_bounty: dto.valor_bounty,
        prazo: dto.prazo ? new Date(dto.prazo) : undefined,
        coluna_id: primeiraColuna?.id,
        ordem,
      },
      include: INCLUDE_PADRAO,
    });
    await this.auditoriaService.registrar(
      userId,
      'CRIAR',
      'Missao',
      missao.id,
      null,
      missao,
    );
    this.eventos.emit(EVT_HIERARQUIA_ALTERADA, {
      tipo: 'missao',
      id: missao.id,
      userId,
    });
    return missao;
  }

  listarPorProjeto(projetoId: string) {
    return this.prisma.missao.findMany({
      where: { projeto_id: projetoId },
      orderBy: { ordem: 'asc' },
      include: INCLUDE_PADRAO,
    });
  }

  listarPorResponsavel(userId: string) {
    return this.prisma.missao.findMany({
      where: { responsaveis: { some: { user_id: userId } } },
      orderBy: { prazo: 'asc' },
      include: {
        ...INCLUDE_PADRAO,
        projeto: { select: { id: true, nome: true } },
      },
    });
  }

  // Fila de Revisão: missões aguardando aprovação, com a entrega mais recente
  // anexada — ADMIN/LIDER/REVISOR revisam de qualquer projeto que consigam
  // ver (projetos restritos sem acesso ficam de fora; a trava de SoD continua
  // sendo aplicada em revisoes.service.ts).
  async listarEmRevisao(user: AuthenticatedUser) {
    const missoes = await this.prisma.missao.findMany({
      where: { status: 'EM_REVISAO' },
      orderBy: { prazo: 'asc' },
      include: {
        ...INCLUDE_PADRAO,
        projeto: { select: { id: true, nome: true } },
        entregas: {
          orderBy: { criado_em: 'desc' },
          take: 1,
          include: { autor: { select: { id: true, nome: true, email: true } } },
        },
      },
    });
    const visiveis = await this.escopoService.idsProjetosVisiveis(
      user,
      missoes.map((m) => m.projeto_id),
    );
    return missoes.filter((m) => visiveis.has(m.projeto_id));
  }

  async buscar(id: string) {
    const missao = await this.prisma.missao.findUnique({
      where: { id },
      include: { entregas: true, ...INCLUDE_PADRAO },
    });
    if (!missao) {
      throw new NotFoundException('Missão não encontrada.');
    }
    return missao;
  }

  async atualizar(id: string, dto: UpdateMissaoDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.missao.update({
      where: { id },
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        criterio_aceite: dto.criterio_aceite,
        valor_bounty: dto.valor_bounty,
        prazo: dto.prazo ? new Date(dto.prazo) : undefined,
      },
      include: INCLUDE_PADRAO,
    });
    await this.auditoriaService.registrar(
      userId,
      'ATUALIZAR',
      'Missao',
      id,
      anterior,
      atualizado,
    );
    return atualizado;
  }

  async atribuir(id: string, responsavelIds: string[], userId: string) {
    const anterior = await this.buscar(id);
    const existentes = await this.prisma.user.count({
      where: { id: { in: responsavelIds }, ativo: true },
    });
    if (existentes !== new Set(responsavelIds).size) {
      throw new BadRequestException(
        'Algum responsável informado não existe ou está desativado.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.missaoResponsavel.deleteMany({ where: { missao_id: id } }),
      this.prisma.missaoResponsavel.createMany({
        data: responsavelIds.map((userIdResponsavel) => ({
          missao_id: id,
          user_id: userIdResponsavel,
        })),
        skipDuplicates: true,
      }),
    ]);
    const atualizado = await this.buscar(id);
    await this.auditoriaService.registrar(
      userId,
      'ATRIBUIR',
      'Missao',
      id,
      anterior,
      atualizado,
    );
    return atualizado;
  }

  async iniciar(id: string, userId: string, papel: string) {
    const missao = await this.buscar(id);
    const podeGerenciarTudo =
      papel === 'ADMIN' || papel === 'LIDER' || papel === 'REVISOR';
    const ehResponsavel = missao.responsaveis.some((r) => r.user_id === userId);

    if (!ehResponsavel && !podeGerenciarTudo) {
      throw new ForbiddenException(
        'Somente o especialista responsável (ou coordenação/revisão) pode iniciar esta missão.',
      );
    }
    // Só uma missão ainda não iniciada pode ser iniciada — sem esta trava,
    // "iniciar" reabria uma missão APROVADA ou tirava de EM_REVISAO uma
    // missão cuja entrega ainda nem foi avaliada.
    if (missao.status !== 'PENDENTE') {
      throw new BadRequestException(
        `Só é possível iniciar uma missão pendente (status atual: ${missao.status}).`,
      );
    }

    const atualizado = await this.prisma.missao.update({
      where: { id },
      data: { status: 'EM_ANDAMENTO' },
      include: INCLUDE_PADRAO,
    });
    await this.auditoriaService.registrar(
      userId,
      'INICIAR',
      'Missao',
      id,
      missao,
      atualizado,
    );
    return atualizado;
  }

  async atualizarTags(id: string, tags: string[], userId: string) {
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
      throw new BadRequestException('tags deve ser uma lista de textos.');
    }
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.missao.update({
      where: { id },
      data: { tags },
      include: INCLUDE_PADRAO,
    });
    await this.auditoriaService.registrar(
      userId,
      'ATUALIZAR_TAGS',
      'Missao',
      id,
      anterior.tags,
      tags,
    );
    return atualizado;
  }

  /// Drag-and-drop livre do board Kanban: sem checagem de papel, sem
  /// checagem de Segregação de Funções, e nunca toca em `status` — a missão
  /// pode ir pra qualquer coluna, em qualquer posição, a qualquer momento.
  /// A trava de SoD continua existindo só no fluxo Entrega→Revisão
  /// (`entregas.service.ts` / `revisoes.service.ts`), inalterado.
  async mover(
    id: string,
    colunaId: string | null,
    ordemAlvo: number,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const missao = await tx.missao.findUniqueOrThrow({ where: { id } });
      if (colunaId) {
        const coluna = await tx.coluna.findUnique({
          where: { id: colunaId },
          select: { projeto_id: true },
        });
        if (!coluna || coluna.projeto_id !== missao.projeto_id) {
          throw new BadRequestException(
            'A coluna de destino não existe ou pertence a outro projeto.',
          );
        }
      }

      // Fecha o buraco deixado na coluna de origem.
      await tx.missao.updateMany({
        where: { coluna_id: missao.coluna_id, ordem: { gt: missao.ordem } },
        data: { ordem: { decrement: 1 } },
      });
      // Abre espaço na posição-alvo da coluna de destino.
      await tx.missao.updateMany({
        where: { coluna_id: colunaId, ordem: { gte: ordemAlvo } },
        data: { ordem: { increment: 1 } },
      });

      const atualizado = await tx.missao.update({
        where: { id },
        data: { coluna_id: colunaId, ordem: ordemAlvo },
        include: INCLUDE_PADRAO,
      });
      await this.auditoriaService.registrar(
        userId,
        'MOVER',
        'Missao',
        id,
        missao,
        atualizado,
      );
      return atualizado;
    });
  }

  async atualizarCapa(id: string, corCapa: string | null, userId: string) {
    if (
      corCapa !== null &&
      corCapa !== undefined &&
      !(PALETA_HEX as readonly string[]).includes(corCapa)
    ) {
      throw new BadRequestException('Cor de capa inválida.');
    }
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.missao.update({
      where: { id },
      data: { cor_capa: corCapa },
      include: INCLUDE_PADRAO,
    });
    await this.auditoriaService.registrar(
      userId,
      'ATUALIZAR_CAPA',
      'Missao',
      id,
      anterior.cor_capa,
      corCapa,
    );
    return atualizado;
  }

  async atualizarLabels(id: string, labelIds: string[], userId: string) {
    const anterior = await this.buscar(id);
    if (
      !Array.isArray(labelIds) ||
      labelIds.some((l) => typeof l !== 'string')
    ) {
      throw new BadRequestException('labelIds deve ser uma lista de ids.');
    }
    const validas = await this.prisma.missaoLabel.count({
      where: { id: { in: labelIds }, projeto_id: anterior.projeto_id },
    });
    if (validas !== new Set(labelIds).size) {
      throw new BadRequestException(
        'Alguma label informada não existe ou pertence a outro projeto.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.missaoLabelMissao.deleteMany({ where: { missao_id: id } }),
      this.prisma.missaoLabelMissao.createMany({
        data: labelIds.map((labelId) => ({ missao_id: id, label_id: labelId })),
        skipDuplicates: true,
      }),
    ]);
    const atualizado = await this.buscar(id);
    await this.auditoriaService.registrar(
      userId,
      'ATUALIZAR_LABELS',
      'Missao',
      id,
      anterior.labels,
      atualizado.labels,
    );
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    await this.prisma.missao.delete({ where: { id } });
    await this.auditoriaService.registrar(
      userId,
      'REMOVER',
      'Missao',
      id,
      anterior,
      null,
    );
    this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
      escopo: {
        pasta_id: null,
        missao_id: null,
        projeto_id: anterior.projeto_id,
        area_id: null,
        workspace_id: null,
      },
      userId,
    });
    return { ok: true };
  }
}
