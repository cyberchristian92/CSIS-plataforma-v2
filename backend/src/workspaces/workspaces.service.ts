import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(dto: CreateWorkspaceDto, userId: string) {
    const workspace = await this.prisma.workspace.create({ data: dto });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'Workspace', workspace.id, null, workspace);
    return workspace;
  }

  listar() {
    return this.prisma.workspace.findMany({ orderBy: { nome: 'asc' } });
  }

  async buscar(id: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id }, include: { areas: true } });
    if (!workspace) {
      throw new NotFoundException('Workspace não encontrado.');
    }
    return workspace;
  }

  async atualizar(id: string, dto: UpdateWorkspaceDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.workspace.update({ where: { id }, data: dto });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'Workspace', id, anterior, atualizado);
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    await this.prisma.workspace.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'Workspace', id, anterior, null);
    return { ok: true };
  }
}
