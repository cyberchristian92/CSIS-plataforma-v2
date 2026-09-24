import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EscopoService } from '../acesso/escopo.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  EVT_CONTEUDO_ALTERADO,
  EVT_CONTEUDO_REMOVIDO,
  EVT_HIERARQUIA_ALTERADA,
} from '../integridade/integridade.events';
import type { Documento, Pasta } from '@prisma/client';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { ESTRUTURA_INICIAL_PROJETO } from './estrutura-inicial';
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
    const { projeto, estrutura } = await this.prisma.$transaction(
      async (tx) => {
        const projeto = await tx.projeto.create({
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
        // Fluxo de trabalho padrão: Material → Processamento → Produção, cada
        // pasta com um Leia-me explicando como usá-la (estrutura-inicial.ts).
        // Na mesma transação: ou o projeto nasce completo, ou não nasce.
        const estrutura: { pasta: Pasta; documento: Documento }[] = [];
        for (const { pasta: nome, leiame } of ESTRUTURA_INICIAL_PROJETO) {
          const pasta = await tx.pasta.create({
            data: { projeto_id: projeto.id, nome, criado_por_id: userId },
          });
          const documento = await tx.documento.create({
            data: {
              projeto_id: projeto.id,
              pasta_id: pasta.id,
              autor_id: userId,
              conteudo: leiame,
            },
          });
          estrutura.push({ pasta, documento });
        }
        return { projeto, estrutura };
      },
    );

    await this.auditoriaService.registrar(
      userId,
      'CRIAR',
      'Projeto',
      projeto.id,
      null,
      projeto,
    );
    for (const { pasta, documento } of estrutura) {
      await this.auditoriaService.registrar(
        userId,
        'CRIAR',
        'Pasta',
        pasta.id,
        null,
        pasta,
      );
      await this.auditoriaService.registrar(
        userId,
        'CRIAR',
        'Documento',
        documento.id,
        null,
        {
          pasta_id: documento.pasta_id,
          titulo: documento.conteudo.split('\n')[0],
        },
      );
      this.eventos.emit(EVT_CONTEUDO_ALTERADO, {
        tipo: 'documento',
        id: documento.id,
        userId,
      });
    }
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
