import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CreatePastaDto } from './dto/create-pasta.dto';
import { UpdatePastaDto } from './dto/update-pasta.dto';

@Injectable()
export class PastasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async criar(projetoId: string, dto: CreatePastaDto, userId: string) {
    const pasta = await this.prisma.pasta.create({
      data: {
        projeto_id: projetoId,
        pasta_pai_id: dto.pastaPaiId,
        missao_id: dto.missaoId,
        nome: dto.nome,
      },
    });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'Pasta', pasta.id, null, pasta);
    return pasta;
  }

  listarPorProjeto(projetoId: string, pastaPaiId?: string) {
    return this.prisma.pasta.findMany({
      where: { projeto_id: projetoId, pasta_pai_id: pastaPaiId ?? null },
      orderBy: { nome: 'asc' },
    });
  }

  // Pastas genéricas direto no Workspace ("Recursos": logos, templates,
  // prompts) ou na Área (ativos daquela área, à parte dos Projetos que ela
  // contém) — mesmo modelo Pasta, escopo diferente. Ver nota no schema.prisma.
  async criarEmWorkspace(workspaceId: string, dto: CreatePastaDto, userId: string) {
    const pasta = await this.prisma.pasta.create({
      data: { workspace_id: workspaceId, pasta_pai_id: dto.pastaPaiId, nome: dto.nome },
    });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'Pasta', pasta.id, null, pasta);
    return pasta;
  }

  listarPorWorkspace(workspaceId: string, pastaPaiId?: string) {
    return this.prisma.pasta.findMany({
      where: { workspace_id: workspaceId, pasta_pai_id: pastaPaiId ?? null },
      orderBy: { nome: 'asc' },
    });
  }

  async criarEmArea(areaId: string, dto: CreatePastaDto, userId: string) {
    const pasta = await this.prisma.pasta.create({
      data: { area_id: areaId, pasta_pai_id: dto.pastaPaiId, nome: dto.nome },
    });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'Pasta', pasta.id, null, pasta);
    return pasta;
  }

  listarPorArea(areaId: string, pastaPaiId?: string) {
    return this.prisma.pasta.findMany({
      where: { area_id: areaId, pasta_pai_id: pastaPaiId ?? null },
      orderBy: { nome: 'asc' },
    });
  }

  async buscar(id: string) {
    const pasta = await this.prisma.pasta.findUnique({ where: { id } });
    if (!pasta) {
      throw new NotFoundException('Pasta não encontrada.');
    }
    return pasta;
  }

  async atualizar(id: string, dto: UpdatePastaDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.pasta.update({
      where: { id },
      data: { nome: dto.nome, pasta_pai_id: dto.pastaPaiId },
    });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'Pasta', id, anterior, atualizado);
    return atualizado;
  }

  // Exclusão não-destrutiva: sub-pastas, arquivos e documentos que estavam
  // dentro dela sobem um nível (para a pasta_pai_id desta pasta, ou para a
  // raiz do escopo — projeto/área/workspace — se esta já era raiz). Nada é
  // apagado além da própria pasta. Replica o comportamento do FileBrowser
  // original (ver auditoria do Flutter).
  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    await this.prisma.$transaction([
      this.prisma.pasta.updateMany({ where: { pasta_pai_id: id }, data: { pasta_pai_id: anterior.pasta_pai_id } }),
      this.prisma.arquivo.updateMany({ where: { pasta_id: id }, data: { pasta_id: anterior.pasta_pai_id } }),
      this.prisma.documento.updateMany({ where: { pasta_id: id }, data: { pasta_id: anterior.pasta_pai_id } }),
      this.prisma.pasta.delete({ where: { id } }),
    ]);
    await this.auditoriaService.registrar(userId, 'REMOVER', 'Pasta', id, anterior, null);
    return { ok: true };
  }
}
