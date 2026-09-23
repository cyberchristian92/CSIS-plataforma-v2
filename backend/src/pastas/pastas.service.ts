import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EVT_CONTEUDO_REMOVIDO, EVT_PASTA_ALTERADA } from '../integridade/integridade.events';
import { CreatePastaDto } from './dto/create-pasta.dto';
import { UpdatePastaDto } from './dto/update-pasta.dto';

@Injectable()
export class PastasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly eventos: EventEmitter2,
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
    this.eventos.emit(EVT_PASTA_ALTERADA, { id: pasta.id, userId });
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
    this.eventos.emit(EVT_PASTA_ALTERADA, { id: pasta.id, userId });
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
    this.eventos.emit(EVT_PASTA_ALTERADA, { id: pasta.id, userId });
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
    this.eventos.emit(EVT_PASTA_ALTERADA, { id, userId });
    // Mover a pasta pra outro pai (ou pra raiz) esvazia o pai antigo — ele
    // também precisa recalcular, senão fica com um hash que ainda conta um
    // filho que já foi embora.
    if (dto.pastaPaiId !== undefined && dto.pastaPaiId !== anterior.pasta_pai_id) {
      this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
        escopo: {
          pasta_id: anterior.pasta_pai_id,
          missao_id: anterior.pasta_pai_id ? null : anterior.missao_id,
          projeto_id: anterior.pasta_pai_id ? null : anterior.projeto_id,
          area_id: anterior.pasta_pai_id ? null : anterior.area_id,
          workspace_id: anterior.pasta_pai_id ? null : anterior.workspace_id,
        },
        userId,
      });
    }
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
    // Sobe a partir de onde a pasta removida vivia — cobre tanto "ela sumiu"
    // quanto "os filhos dela agora estão direto aqui", já que os dois efeitos
    // acontecem no mesmo pai.
    this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
      escopo: {
        pasta_id: anterior.pasta_pai_id,
        missao_id: anterior.pasta_pai_id ? null : anterior.missao_id,
        projeto_id: anterior.pasta_pai_id ? null : anterior.projeto_id,
        area_id: anterior.pasta_pai_id ? null : anterior.area_id,
        workspace_id: anterior.pasta_pai_id ? null : anterior.workspace_id,
      },
      userId,
    });
    return { ok: true };
  }
}
