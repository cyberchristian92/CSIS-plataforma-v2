import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AcessoService } from './acesso.service';

/// Tipos de recurso que uma rota pode referenciar por id. Todos se resolvem
/// para uma "cadeia de escopo": as Pastas acima dele (de baixo pra cima), o
/// Projeto e a Área a que pertence — que são exatamente os três níveis que
/// podem ser marcados `restrito` (ver model Lista no schema.prisma).
export const TIPOS_ALVO = [
  'workspace',
  'area',
  'projeto',
  'missao',
  'pasta',
  'arquivo',
  'documento',
  'entrega',
  'comentario',
  'checklist',
  'coluna',
  'label',
] as const;
export type TipoAlvo = (typeof TIPOS_ALVO)[number];

export interface CadeiaEscopo {
  workspaceId: string | null;
  areaId: string | null;
  projetoId: string | null;
  /// Pastas que contêm o recurso, da mais próxima para a raiz (inclui o
  /// próprio recurso quando ele é uma Pasta).
  pastaIds: string[];
}

interface DonoConteudo {
  workspace_id: string | null;
  area_id: string | null;
  projeto_id: string | null;
  missao_id: string | null;
}

interface PastaNo {
  id: string;
  pasta_pai_id: string | null;
  restrito: boolean;
  criado_por_id: string | null;
}

/// Profundidade máxima aceita numa árvore de pastas. Existe só para que um
/// ciclo gravado no banco por algum caminho não previsto nunca vire loop
/// infinito aqui — o caminho normal (PastasService) já recusa criar ciclos.
const PROFUNDIDADE_MAXIMA = 256;

/// Aplica as Listas de Acesso a QUALQUER recurso, não só a Projeto/Área:
/// para acessar uma missão, um arquivo, um comentário... é preciso poder ver
/// a Área, o Projeto e cada Pasta acima dele. Uma restrição num nível mais
/// alto vale para tudo que está dentro dele (mesmo modelo do Google Drive).
@Injectable()
export class EscopoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acessoService: AcessoService,
  ) {}

  async resolverCadeia(tipo: TipoAlvo, id: string): Promise<CadeiaEscopo> {
    switch (tipo) {
      case 'workspace': {
        const ws = await this.prisma.workspace.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!ws) throw new NotFoundException('Workspace não encontrado.');
        return {
          workspaceId: ws.id,
          areaId: null,
          projetoId: null,
          pastaIds: [],
        };
      }
      case 'area': {
        const area = await this.prisma.area.findUnique({
          where: { id },
          select: { id: true, workspace_id: true },
        });
        if (!area) throw new NotFoundException('Área não encontrada.');
        return {
          workspaceId: area.workspace_id,
          areaId: area.id,
          projetoId: null,
          pastaIds: [],
        };
      }
      case 'projeto':
        return this.cadeiaDoProjeto(id);
      case 'missao': {
        const missao = await this.prisma.missao.findUnique({
          where: { id },
          select: { projeto_id: true },
        });
        if (!missao) throw new NotFoundException('Missão não encontrada.');
        return this.cadeiaDoProjeto(missao.projeto_id);
      }
      case 'entrega': {
        const entrega = await this.prisma.entrega.findUnique({
          where: { id },
          select: { missao: { select: { projeto_id: true } } },
        });
        if (!entrega) throw new NotFoundException('Entrega não encontrada.');
        return this.cadeiaDoProjeto(entrega.missao.projeto_id);
      }
      case 'comentario': {
        const comentario = await this.prisma.comentarioMissao.findUnique({
          where: { id },
          select: { missao: { select: { projeto_id: true } } },
        });
        if (!comentario)
          throw new NotFoundException('Comentário não encontrado.');
        return this.cadeiaDoProjeto(comentario.missao.projeto_id);
      }
      case 'checklist': {
        const item = await this.prisma.checklistItem.findUnique({
          where: { id },
          select: { missao: { select: { projeto_id: true } } },
        });
        if (!item)
          throw new NotFoundException('Item de checklist não encontrado.');
        return this.cadeiaDoProjeto(item.missao.projeto_id);
      }
      case 'coluna': {
        const coluna = await this.prisma.coluna.findUnique({
          where: { id },
          select: { projeto_id: true },
        });
        if (!coluna) throw new NotFoundException('Coluna não encontrada.');
        return this.cadeiaDoProjeto(coluna.projeto_id);
      }
      case 'label': {
        const label = await this.prisma.missaoLabel.findUnique({
          where: { id },
          select: { projeto_id: true },
        });
        if (!label) throw new NotFoundException('Label não encontrada.');
        return this.cadeiaDoProjeto(label.projeto_id);
      }
      case 'pasta': {
        const pasta = await this.prisma.pasta.findUnique({ where: { id } });
        if (!pasta) throw new NotFoundException('Pasta não encontrada.');
        return this.cadeiaDeConteudo(pasta, pasta.id);
      }
      case 'arquivo': {
        const arquivo = await this.prisma.arquivo.findUnique({ where: { id } });
        if (!arquivo) throw new NotFoundException('Arquivo não encontrado.');
        return this.cadeiaDeConteudo(arquivo, arquivo.pasta_id);
      }
      case 'documento': {
        const documento = await this.prisma.documento.findUnique({
          where: { id },
        });
        if (!documento)
          throw new NotFoundException('Documento não encontrado.');
        return this.cadeiaDeConteudo(documento, documento.pasta_id);
      }
    }
  }

  async assertPodeAcessar(
    user: AuthenticatedUser,
    tipo: TipoAlvo,
    id: string,
  ): Promise<CadeiaEscopo> {
    const cadeia = await this.resolverCadeia(tipo, id);
    if (!(await this.podeAcessarCadeia(user, cadeia))) {
      throw new ForbiddenException('Você não tem acesso a este recurso.');
    }
    return cadeia;
  }

  async podeAcessarCadeia(
    user: AuthenticatedUser,
    cadeia: CadeiaEscopo,
  ): Promise<boolean> {
    if (user.papel_global === 'ADMIN') return true;
    const { id: userId, papel_global: papel } = user;

    if (cadeia.areaId) {
      const area = await this.prisma.area.findUniqueOrThrow({
        where: { id: cadeia.areaId },
        select: { id: true, restrito: true, criado_por_id: true },
      });
      if (!(await this.acessoService.podeVer('area', area, userId, papel)))
        return false;
    }
    if (cadeia.projetoId) {
      const projeto = await this.prisma.projeto.findUniqueOrThrow({
        where: { id: cadeia.projetoId },
        select: { id: true, restrito: true, criado_por_id: true },
      });
      if (
        !(await this.acessoService.podeVer('projeto', projeto, userId, papel))
      )
        return false;
    }
    // Colaborador: visibilidade padrão restrita (além de `restrito`). O
    // projeto precisa estar aberto a ele; conteúdo solto numa Área exige que
    // a Área esteja aberta a ele.
    if (papel === 'COLABORADOR') {
      if (cadeia.projetoId) {
        const abertos = await this.projetosAbertosAoColaborador(userId, [
          cadeia.projetoId,
        ]);
        if (!abertos.has(cadeia.projetoId)) return false;
      } else if (cadeia.areaId) {
        const abertas = await this.areasAbertasAoColaborador(userId, [
          cadeia.areaId,
        ]);
        if (!abertas.has(cadeia.areaId)) return false;
      }
    }
    if (cadeia.pastaIds.length > 0) {
      const pastas = await this.prisma.pasta.findMany({
        where: { id: { in: cadeia.pastaIds } },
        select: { id: true, restrito: true, criado_por_id: true },
      });
      const visiveis = await this.acessoService.idsVisiveis(
        'pasta',
        pastas,
        userId,
        papel,
      );
      if (pastas.some((p) => !visiveis.has(p.id))) return false;
    }
    return true;
  }

  /// Filtra projetos pelo que o usuário pode ver: `restrito` para todos
  /// (menos Admin) e, para Colaborador, também a visibilidade padrão restrita.
  async filtrarProjetos<
    T extends { id: string; restrito: boolean; criado_por_id: string | null },
  >(user: AuthenticatedUser, projetos: T[]): Promise<T[]> {
    if (user.papel_global === 'ADMIN') return projetos;
    const naoRestritos = await this.acessoService.idsVisiveis(
      'projeto',
      projetos,
      user.id,
      user.papel_global,
    );
    const abertos =
      user.papel_global === 'COLABORADOR'
        ? await this.projetosAbertosAoColaborador(
            user.id,
            projetos.map((p) => p.id),
          )
        : null;
    return projetos.filter(
      (p) => naoRestritos.has(p.id) && (!abertos || abertos.has(p.id)),
    );
  }

  async filtrarAreas<
    T extends { id: string; restrito: boolean; criado_por_id: string | null },
  >(user: AuthenticatedUser, areas: T[]): Promise<T[]> {
    if (user.papel_global === 'ADMIN') return areas;
    const naoRestritas = await this.acessoService.idsVisiveis(
      'area',
      areas,
      user.id,
      user.papel_global,
    );
    const abertas =
      user.papel_global === 'COLABORADOR'
        ? await this.areasAbertasAoColaborador(
            user.id,
            areas.map((a) => a.id),
          )
        : null;
    return areas.filter(
      (a) => naoRestritas.has(a.id) && (!abertas || abertas.has(a.id)),
    );
  }

  /// Critério de "participação" de um Colaborador num Projeto: marcado
  /// público, criado por ele, incluído no compartilhamento (direto ou via
  /// Lista), ou responsável por alguma missão do projeto (alocação).
  private participacaoEmProjeto(userId: string) {
    return {
      OR: [
        { publico: true },
        { criado_por_id: userId },
        {
          acessos: {
            some: {
              OR: [
                { user_id: userId },
                { lista: { membros: { some: { user_id: userId } } } },
              ],
            },
          },
        },
        { missoes: { some: { responsaveis: { some: { user_id: userId } } } } },
      ],
    };
  }

  private async projetosAbertosAoColaborador(
    userId: string,
    projetoIds: string[],
  ): Promise<Set<string>> {
    if (projetoIds.length === 0) return new Set();
    const abertos = await this.prisma.projeto.findMany({
      where: { id: { in: projetoIds }, ...this.participacaoEmProjeto(userId) },
      select: { id: true },
    });
    return new Set(abertos.map((p) => p.id));
  }

  /// Área aberta a um Colaborador: marcada pública, criada por ele, incluída
  /// no compartilhamento, ou com algum projeto aberto a ele (senão ele não
  /// conseguiria navegar até o próprio projeto).
  private async areasAbertasAoColaborador(
    userId: string,
    areaIds: string[],
  ): Promise<Set<string>> {
    if (areaIds.length === 0) return new Set();
    const abertas = await this.prisma.area.findMany({
      where: {
        id: { in: areaIds },
        OR: [
          { publico: true },
          { criado_por_id: userId },
          {
            acessos: {
              some: {
                OR: [
                  { user_id: userId },
                  { lista: { membros: { some: { user_id: userId } } } },
                ],
              },
            },
          },
          { projetos: { some: this.participacaoEmProjeto(userId) } },
        ],
      },
      select: { id: true },
    });
    return new Set(abertas.map((a) => a.id));
  }

  /// Ids das pastas que o usuário NÃO pode ver dentro de um escopo (Projeto,
  /// Área ou Workspace) — as restritas sem acesso e tudo que está abaixo
  /// delas. Usado para filtrar listagens (arquivos/documentos/pastas) sem
  /// precisar checar item por item.
  async pastasOcultas(
    user: AuthenticatedUser,
    escopo: { projeto_id?: string; area_id?: string; workspace_id?: string },
  ): Promise<Set<string>> {
    if (user.papel_global === 'ADMIN') return new Set();
    const pastas: PastaNo[] = await this.prisma.pasta.findMany({
      where: escopo,
      select: {
        id: true,
        pasta_pai_id: true,
        restrito: true,
        criado_por_id: true,
      },
    });
    if (!pastas.some((p) => p.restrito)) return new Set();

    const visiveis = await this.acessoService.idsVisiveis(
      'pasta',
      pastas,
      user.id,
      user.papel_global,
    );
    const ocultas = new Set(
      pastas.filter((p) => !visiveis.has(p.id)).map((p) => p.id),
    );

    // Propaga para os descendentes: filho de pasta oculta também é oculto.
    const filhosPorPai = new Map<string, string[]>();
    for (const p of pastas) {
      if (!p.pasta_pai_id) continue;
      filhosPorPai.set(p.pasta_pai_id, [
        ...(filhosPorPai.get(p.pasta_pai_id) ?? []),
        p.id,
      ]);
    }
    const fila = [...ocultas];
    while (fila.length > 0) {
      const atual = fila.pop()!;
      for (const filho of filhosPorPai.get(atual) ?? []) {
        if (!ocultas.has(filho)) {
          ocultas.add(filho);
          fila.push(filho);
        }
      }
    }
    return ocultas;
  }

  /// Remove de uma listagem os itens que estão dentro de pastas ocultas.
  async filtrarPorPasta<T extends { pasta_id: string | null }>(
    user: AuthenticatedUser,
    escopo: { projeto_id?: string; area_id?: string; workspace_id?: string },
    itens: T[],
  ): Promise<T[]> {
    const ocultas = await this.pastasOcultas(user, escopo);
    return ocultas.size === 0
      ? itens
      : itens.filter((i) => !i.pasta_id || !ocultas.has(i.pasta_id));
  }

  /// Filtra uma lista de projetos (de áreas possivelmente diferentes) pelo
  /// que o usuário pode ver — usado por listagens globais (fila de revisão).
  async idsProjetosVisiveis(
    user: AuthenticatedUser,
    projetoIds: string[],
  ): Promise<Set<string>> {
    const unicos = [...new Set(projetoIds)];
    if (user.papel_global === 'ADMIN') return new Set(unicos);
    const visiveis = new Set<string>();
    for (const id of unicos) {
      if (await this.podeAcessarCadeia(user, await this.cadeiaDoProjeto(id)))
        visiveis.add(id);
    }
    return visiveis;
  }

  /// Garante que `pastaId` existe e pertence ao mesmo dono (Projeto/Área/
  /// Workspace) indicado — impede anexar conteúdo a uma pasta de outro caso.
  async assertPastaNoEscopo(
    pastaId: string,
    escopo: { projeto_id?: string; area_id?: string; workspace_id?: string },
  ): Promise<void> {
    const pasta = await this.prisma.pasta.findUnique({
      where: { id: pastaId },
    });
    const mesmoEscopo =
      pasta &&
      (escopo.projeto_id === undefined ||
        pasta.projeto_id === escopo.projeto_id) &&
      (escopo.area_id === undefined || pasta.area_id === escopo.area_id) &&
      (escopo.workspace_id === undefined ||
        pasta.workspace_id === escopo.workspace_id);
    if (!mesmoEscopo) {
      throw new BadRequestException(
        'A pasta informada não existe ou pertence a outro projeto/área.',
      );
    }
  }

  private async cadeiaDoProjeto(projetoId: string): Promise<CadeiaEscopo> {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: {
        id: true,
        area_id: true,
        area: { select: { workspace_id: true } },
      },
    });
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');
    return {
      workspaceId: projeto.area.workspace_id,
      areaId: projeto.area_id,
      projetoId: projeto.id,
      pastaIds: [],
    };
  }

  /// Conteúdo (Pasta/Arquivo/Documento) pode viver num Workspace, numa Área,
  /// num Projeto ou numa Missão — e opcionalmente dentro de uma pasta.
  private async cadeiaDeConteudo(
    dono: DonoConteudo,
    pastaInicial: string | null,
  ): Promise<CadeiaEscopo> {
    let base: CadeiaEscopo;
    if (dono.projeto_id) {
      base = await this.cadeiaDoProjeto(dono.projeto_id);
    } else if (dono.missao_id) {
      const missao = await this.prisma.missao.findUniqueOrThrow({
        where: { id: dono.missao_id },
        select: { projeto_id: true },
      });
      base = await this.cadeiaDoProjeto(missao.projeto_id);
    } else if (dono.area_id) {
      base = await this.resolverCadeia('area', dono.area_id);
    } else {
      base = {
        workspaceId: dono.workspace_id,
        areaId: null,
        projetoId: null,
        pastaIds: [],
      };
    }
    return { ...base, pastaIds: await this.ancestraisDaPasta(pastaInicial) };
  }

  private async ancestraisDaPasta(pastaId: string | null): Promise<string[]> {
    const cadeia: string[] = [];
    let atual = pastaId;
    while (
      atual &&
      cadeia.length < PROFUNDIDADE_MAXIMA &&
      !cadeia.includes(atual)
    ) {
      cadeia.push(atual);
      const pasta = await this.prisma.pasta.findUnique({
        where: { id: atual },
        select: { pasta_pai_id: true },
      });
      atual = pasta?.pasta_pai_id ?? null;
    }
    return cadeia;
  }
}
