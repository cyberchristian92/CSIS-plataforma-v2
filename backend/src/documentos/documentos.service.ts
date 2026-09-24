import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EscopoService } from '../acesso/escopo.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  EVT_CONTEUDO_ALTERADO,
  EVT_CONTEUDO_REMOVIDO,
} from '../integridade/integridade.events';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';

/// Dono de um documento: exatamente um entre Projeto, Área e Workspace.
export type EscopoDocumento =
  { projeto_id: string } | { area_id: string } | { workspace_id: string };

const PAPEIS_GESTAO = new Set(['ADMIN', 'LIDER']);

function pastaDoDto(pastaId: string | undefined): string | null | undefined {
  return pastaId === 'raiz' ? null : pastaId;
}

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly escopoService: EscopoService,
    private readonly eventos: EventEmitter2,
  ) {}

  async criar(
    escopo: EscopoDocumento,
    dto: CreateDocumentoDto,
    autorId: string,
  ) {
    const pastaId = pastaDoDto(dto.pastaId);
    if (pastaId) await this.escopoService.assertPastaNoEscopo(pastaId, escopo);
    if (dto.missaoId) {
      const missao = await this.prisma.missao.findUnique({
        where: { id: dto.missaoId },
        select: { projeto_id: true },
      });
      if (
        !missao ||
        !('projeto_id' in escopo) ||
        missao.projeto_id !== escopo.projeto_id
      ) {
        throw new BadRequestException(
          'A missão informada não existe ou pertence a outro projeto.',
        );
      }
    }

    const documento = await this.prisma.documento.create({
      data: {
        ...escopo,
        missao_id: dto.missaoId,
        pasta_id: pastaId,
        autor_id: autorId,
        conteudo: dto.conteudo,
        tags: dto.tags ?? [],
      },
    });
    await this.auditoriaService.registrar(
      autorId,
      'CRIAR',
      'Documento',
      documento.id,
      null,
      documento,
    );
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, {
      tipo: 'documento',
      id: documento.id,
      userId: autorId,
    });
    return documento;
  }

  async listar(
    escopo: EscopoDocumento,
    user: AuthenticatedUser,
    filtros: { missaoId?: string; pastaId?: string } = {},
  ) {
    const documentos = await this.prisma.documento.findMany({
      where: {
        ...escopo,
        missao_id: filtros.missaoId,
        ...(filtros.pastaId !== undefined
          ? { pasta_id: filtros.pastaId === 'raiz' ? null : filtros.pastaId }
          : {}),
      },
      orderBy: { atualizado_em: 'desc' },
    });
    return this.escopoService.filtrarPorPasta(user, escopo, documentos);
  }

  historico(id: string) {
    return this.auditoriaService.historico('Documento', id);
  }

  async buscar(id: string) {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }
    return documento;
  }

  async atualizar(
    id: string,
    dto: UpdateDocumentoDto,
    user: AuthenticatedUser,
  ) {
    const anterior = await this.buscar(id);
    const pastaId = pastaDoDto(dto.pastaId);
    if (pastaId && pastaId !== anterior.pasta_id) {
      // Mover para outra pasta: precisa ser do mesmo dono e visível para quem move.
      const escopo = this.escopoDe(anterior);
      await this.escopoService.assertPastaNoEscopo(pastaId, escopo);
      await this.escopoService.assertPodeAcessar(user, 'pasta', pastaId);
    }
    const atualizado = await this.prisma.documento.update({
      where: { id },
      data: { conteudo: dto.conteudo, tags: dto.tags, pasta_id: pastaId },
    });
    await this.auditoriaService.registrar(
      user.id,
      'ATUALIZAR',
      'Documento',
      id,
      anterior,
      atualizado,
    );
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, {
      tipo: 'documento',
      id,
      userId: user.id,
    });
    return atualizado;
  }

  /// Documento só é excluído pelo autor ou pela coordenação — edição continua
  /// colaborativa (vários peritos escrevem o mesmo laudo), exclusão não.
  async remover(id: string, user: AuthenticatedUser) {
    const anterior = await this.buscar(id);
    if (
      anterior.autor_id !== user.id &&
      !PAPEIS_GESTAO.has(user.papel_global)
    ) {
      throw new ForbiddenException(
        'Só o autor do documento (ou Admin/Coordenador) pode excluí-lo.',
      );
    }
    await this.prisma.documento.delete({ where: { id } });
    await this.auditoriaService.registrar(
      user.id,
      'REMOVER',
      'Documento',
      id,
      anterior,
      null,
    );
    // Não há mais o próprio nó pra recalcular — sobe direto a partir do
    // escopo em que ele vivia (com o filho já removido do banco).
    this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
      escopo: {
        pasta_id: anterior.pasta_id,
        missao_id: anterior.missao_id,
        projeto_id: anterior.projeto_id,
        area_id: anterior.area_id,
        workspace_id: anterior.workspace_id,
      },
      userId: user.id,
    });
    return { ok: true };
  }

  private escopoDe(doc: {
    projeto_id: string | null;
    area_id: string | null;
    workspace_id: string | null;
  }): EscopoDocumento {
    if (doc.projeto_id) return { projeto_id: doc.projeto_id };
    if (doc.area_id) return { area_id: doc.area_id };
    if (doc.workspace_id) return { workspace_id: doc.workspace_id };
    throw new BadRequestException('Documento sem projeto/área/workspace.');
  }
}
