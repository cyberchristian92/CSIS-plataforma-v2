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
  EVT_CONTEUDO_REMOVIDO,
  EVT_PASTA_ALTERADA,
} from '../integridade/integridade.events';
import { CreatePastaDto } from './dto/create-pasta.dto';
import { UpdatePastaDto } from './dto/update-pasta.dto';

/// Dono de uma pasta: exatamente um entre Projeto, Área e Workspace.
export type EscopoPasta =
  { projeto_id: string } | { area_id: string } | { workspace_id: string };

const PAPEIS_GESTAO = new Set(['ADMIN', 'LIDER']);

@Injectable()
export class PastasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly escopoService: EscopoService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Pastas podem viver direto no Workspace ("Recursos": logos, templates,
  // prompts), na Área (ativos daquela área, à parte dos Projetos que ela
  // contém) ou no Projeto — mesmo modelo Pasta, escopo diferente. Ver nota
  // no schema.prisma.
  async criar(
    escopo: EscopoPasta,
    dto: CreatePastaDto,
    user: AuthenticatedUser,
  ) {
    if (dto.pastaPaiId) {
      await this.escopoService.assertPastaNoEscopo(dto.pastaPaiId, escopo);
      await this.escopoService.assertPodeAcessar(user, 'pasta', dto.pastaPaiId);
    }
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
    const pasta = await this.prisma.pasta.create({
      data: {
        ...escopo,
        pasta_pai_id: dto.pastaPaiId,
        missao_id: dto.missaoId,
        nome: dto.nome,
        // Quem cria sempre continua vendo a pasta, mesmo depois de restringi-la.
        criado_por_id: user.id,
      },
    });
    await this.auditoriaService.registrar(
      user.id,
      'CRIAR',
      'Pasta',
      pasta.id,
      null,
      pasta,
    );
    this.eventos.emit(EVT_PASTA_ALTERADA, { id: pasta.id, userId: user.id });
    return pasta;
  }

  async listar(
    escopo: EscopoPasta,
    user: AuthenticatedUser,
    pastaPaiId?: string,
  ) {
    const pastas = await this.prisma.pasta.findMany({
      where: {
        ...escopo,
        pasta_pai_id: pastaPaiId && pastaPaiId !== 'raiz' ? pastaPaiId : null,
      },
      orderBy: { nome: 'asc' },
    });
    const ocultas = await this.escopoService.pastasOcultas(user, escopo);
    return pastas.filter((p) => !ocultas.has(p.id));
  }

  async buscar(id: string) {
    const pasta = await this.prisma.pasta.findUnique({ where: { id } });
    if (!pasta) {
      throw new NotFoundException('Pasta não encontrada.');
    }
    return pasta;
  }

  async atualizar(id: string, dto: UpdatePastaDto, user: AuthenticatedUser) {
    const anterior = await this.buscar(id);
    const movendo =
      dto.pastaPaiId !== undefined && dto.pastaPaiId !== anterior.pasta_pai_id;
    if (movendo && dto.pastaPaiId) {
      await this.escopoService.assertPastaNoEscopo(
        dto.pastaPaiId,
        this.escopoDe(anterior),
      );
      await this.escopoService.assertPodeAcessar(user, 'pasta', dto.pastaPaiId);
      await this.assertSemCiclo(id, dto.pastaPaiId);
    }

    const atualizado = await this.prisma.pasta.update({
      where: { id },
      data: { nome: dto.nome, pasta_pai_id: dto.pastaPaiId },
    });
    await this.auditoriaService.registrar(
      user.id,
      'ATUALIZAR',
      'Pasta',
      id,
      anterior,
      atualizado,
    );
    this.eventos.emit(EVT_PASTA_ALTERADA, { id, userId: user.id });
    // Mover a pasta pra outro pai (ou pra raiz) esvazia o pai antigo — ele
    // também precisa recalcular, senão fica com um hash que ainda conta um
    // filho que já foi embora.
    if (movendo) {
      this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
        escopo: {
          pasta_id: anterior.pasta_pai_id,
          missao_id: anterior.pasta_pai_id ? null : anterior.missao_id,
          projeto_id: anterior.pasta_pai_id ? null : anterior.projeto_id,
          area_id: anterior.pasta_pai_id ? null : anterior.area_id,
          workspace_id: anterior.pasta_pai_id ? null : anterior.workspace_id,
        },
        userId: user.id,
      });
    }
    return atualizado;
  }

  /// Mover uma pasta para dentro de si mesma (ou de uma descendente) criaria
  /// um ciclo na árvore — e o recálculo de integridade, que sobe de filho
  /// para pai, entraria em loop infinito.
  private async assertSemCiclo(id: string, novoPaiId: string) {
    const visitados = new Set<string>();
    let atual: string | null = novoPaiId;
    while (atual && !visitados.has(atual)) {
      if (atual === id) {
        throw new BadRequestException(
          'Não é possível mover uma pasta para dentro dela mesma ou de uma subpasta dela.',
        );
      }
      visitados.add(atual);
      const pasta: { pasta_pai_id: string | null } | null =
        await this.prisma.pasta.findUnique({
          where: { id: atual },
          select: { pasta_pai_id: true },
        });
      atual = pasta?.pasta_pai_id ?? null;
    }
  }

  // Exclusão não-destrutiva: sub-pastas, arquivos e documentos que estavam
  // dentro dela sobem um nível (para a pasta_pai_id desta pasta, ou para a
  // raiz do escopo — projeto/área/workspace — se esta já era raiz). Nada é
  // apagado além da própria pasta. Replica o comportamento do FileBrowser
  // original (ver auditoria do Flutter).
  //
  // Restrita a quem criou ou à coordenação: como o conteúdo sobe de nível,
  // excluir uma pasta restrita deixaria o que estava nela visível para todos.
  async remover(id: string, user: AuthenticatedUser) {
    const anterior = await this.buscar(id);
    if (
      anterior.criado_por_id !== user.id &&
      !PAPEIS_GESTAO.has(user.papel_global)
    ) {
      throw new ForbiddenException(
        'Só quem criou a pasta (ou Admin/Coordenador) pode excluí-la.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.pasta.updateMany({
        where: { pasta_pai_id: id },
        data: { pasta_pai_id: anterior.pasta_pai_id },
      }),
      this.prisma.arquivo.updateMany({
        where: { pasta_id: id },
        data: { pasta_id: anterior.pasta_pai_id },
      }),
      this.prisma.documento.updateMany({
        where: { pasta_id: id },
        data: { pasta_id: anterior.pasta_pai_id },
      }),
      this.prisma.pasta.delete({ where: { id } }),
    ]);
    await this.auditoriaService.registrar(
      user.id,
      'REMOVER',
      'Pasta',
      id,
      anterior,
      null,
    );
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
      userId: user.id,
    });
    return { ok: true };
  }

  private escopoDe(pasta: {
    projeto_id: string | null;
    area_id: string | null;
    workspace_id: string | null;
  }): EscopoPasta {
    if (pasta.projeto_id) return { projeto_id: pasta.projeto_id };
    if (pasta.area_id) return { area_id: pasta.area_id };
    if (pasta.workspace_id) return { workspace_id: pasta.workspace_id };
    throw new BadRequestException('Pasta sem projeto/área/workspace.');
  }
}
