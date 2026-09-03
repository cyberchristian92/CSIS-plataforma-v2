import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateComentarioDto } from './dto/create-comentario.dto';

@Injectable()
export class ComentariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(missaoId: string, dto: CreateComentarioDto, autorId: string) {
    const comentario = await this.prisma.comentarioMissao.create({
      data: { missao_id: missaoId, autor_id: autorId, texto: dto.texto },
    });
    await this.auditoriaService.registrar(autorId, 'COMENTAR', 'Missao', missaoId, null, { texto: dto.texto });
    return this.prisma.comentarioMissao.findUnique({
      where: { id: comentario.id },
      include: { autor: { select: { id: true, nome: true } } },
    });
  }

  listarPorMissao(missaoId: string) {
    return this.prisma.comentarioMissao.findMany({
      where: { missao_id: missaoId },
      orderBy: { criado_em: 'asc' },
      include: { autor: { select: { id: true, nome: true } } },
    });
  }

  async remover(id: string, userId: string, papel: string) {
    const comentario = await this.prisma.comentarioMissao.findUnique({ where: { id } });
    if (!comentario) {
      throw new NotFoundException('Comentário não encontrado.');
    }
    const podeRemoverQualquer = papel === 'ADMIN' || papel === 'LIDER';
    if (comentario.autor_id !== userId && !podeRemoverQualquer) {
      throw new ForbiddenException('Você só pode remover os próprios comentários.');
    }
    await this.prisma.comentarioMissao.delete({ where: { id } });
    return { ok: true };
  }
}
