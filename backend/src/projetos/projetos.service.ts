import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EscopoService } from '../acesso/escopo.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  EVT_CONTEUDO_REMOVIDO,
  EVT_HIERARQUIA_ALTERADA,
} from '../integridade/integridade.events';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { UpdateProjetoDto } from './dto/update-projeto.dto';

@Injectable()
export class ProjetosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly eventos: EventEmitter2,
    private readonly escopoService: EscopoService,
  ) {}

  async criar(areaId: string, dto: CreateProjetoDto, userId: string) {
    const projeto = await this.prisma.projeto.create({
      data: {
        area_id: areaId,
        nome: dto.nome,
        descricao: dto.descricao,
        prazo: dto.prazo ? new Date(dto.prazo) : undefined,
        criado_por_id: userId,
        // Board Kanban nasce com as mesmas 5 colunas que existiam como status
        // antes — livres pra renomear/reordenar/excluir depois.
        colunas: {
          create: [
            { nome: 'Pendente', ordem: 0 },
            { nome: 'Em Andamento', ordem: 1 },
            { nome: 'Em Revisão', ordem: 2 },
            { nome: 'Aprovada', ordem: 3 },
            { nome: 'Rejeitada', ordem: 4 },
          ],
        },
      },
    });
    await this.auditoriaService.registrar(
      userId,
      'CRIAR',
      'Projeto',
      projeto.id,
      null,
      projeto,
    );
    this.eventos.emit(EVT_HIERARQUIA_ALTERADA, {
      tipo: 'projeto',
      id: projeto.id,
      userId,
    });
    return projeto;
  }

  async listarPorArea(areaId: string, user: AuthenticatedUser) {
    const projetos = await this.prisma.projeto.findMany({
      where: { area_id: areaId },
      orderBy: { nome: 'asc' },
    });
    return this.escopoService.filtrarProjetos(user, projetos);
  }

  async buscar(id: string, user?: AuthenticatedUser) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      include: {
        missoes: {
          orderBy: { ordem: 'asc' },
          include: {
            coluna: true,
            responsaveis: {
              include: {
                user: { select: { id: true, nome: true, email: true } },
              },
            },
            labels: { include: { label: true } },
          },
        },
        colunas: { orderBy: { ordem: 'asc' } },
        labels: { orderBy: { nome: 'asc' } },
        documentos: true,
        arquivos: { omit: { caminho: true } },
      },
    });
    if (!projeto) {
      throw new NotFoundException('Projeto não encontrado.');
    }
    // O acesso ao projeto em si é checado pelo EscopoGuard na rota; aqui só
    // some o conteúdo que está dentro de pastas restritas sem acesso.
    if (user) {
      const escopo = { projeto_id: projeto.id };
      projeto.arquivos = await this.escopoService.filtrarPorPasta(
        user,
        escopo,
        projeto.arquivos,
      );
      projeto.documentos = await this.escopoService.filtrarPorPasta(
        user,
        escopo,
        projeto.documentos,
      );
    }
    return projeto;
  }

  async atualizar(id: string, dto: UpdateProjetoDto, userId: string) {
    const anterior = await this.buscar(id);
    const atualizado = await this.prisma.projeto.update({
      where: { id },
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        status: dto.status,
        prazo: dto.prazo ? new Date(dto.prazo) : undefined,
        capa_url: dto.capa_url,
        video_url: dto.video_url,
        publico: dto.publico,
      },
    });
    await this.auditoriaService.registrar(
      userId,
      'ATUALIZAR',
      'Projeto',
      id,
      anterior,
      atualizado,
    );
    return atualizado;
  }

  async remover(id: string, userId: string) {
    const anterior = await this.buscar(id);
    await this.prisma.projeto.delete({ where: { id } });
    await this.auditoriaService.registrar(
      userId,
      'REMOVER',
      'Projeto',
      id,
      anterior,
      null,
    );
    this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
      escopo: {
        pasta_id: null,
        missao_id: null,
        projeto_id: null,
        area_id: anterior.area_id,
        workspace_id: null,
      },
      userId,
    });
    return { ok: true };
  }
}
