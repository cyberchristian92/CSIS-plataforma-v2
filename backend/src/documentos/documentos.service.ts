import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(projetoId: string, dto: CreateDocumentoDto, autorId: string) {
    const documento = await this.prisma.documento.create({
      data: {
        projeto_id: projetoId,
        missao_id: dto.missaoId,
        pasta_id: dto.pastaId === 'raiz' ? null : dto.pastaId,
        autor_id: autorId,
        conteudo: dto.conteudo,
        tags: dto.tags ?? [],
      },
    });
    await this.auditoriaService.registrar(autorId, 'CRIAR', 'Documento', documento.id, null, documento);
    return documento;
  }

  listarPorProjeto(projetoId: string, missaoId?: string, pastaId?: string) {
    return this.prisma.documento.findMany({
      where: {
        projeto_id: projetoId,
        missao_id: missaoId,
        ...(pastaId !== undefined ? { pasta_id: pastaId === 'raiz' ? null : pastaId } : {}),
      },
      orderBy: { atualizado_em: 'desc' },
    });
  }

  async buscar(id: string) {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) {
      throw new NotFoundException('Documento não encontrado.');
    }
    return documento;
  }

  async atualizar(id: string, dto: UpdateDocumentoDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.documento.update({
      where: { id },
      data: { conteudo: dto.conteudo, tags: dto.tags, pasta_id: dto.pastaId === 'raiz' ? null : dto.pastaId },
    });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'Documento', id, anterior, atualizado);
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    await this.prisma.documento.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'Documento', id, anterior, null);
    return { ok: true };
  }
}
