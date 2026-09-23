import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

export type TipoRecursoRestringivel = 'projeto' | 'area' | 'pasta';
type Papel = 'ADMIN' | 'LIDER' | 'REVISOR' | 'COLABORADOR';

interface RecursoRestringivel {
  id: string;
  restrito: boolean;
  criado_por_id: string | null;
}

const NOME_ENTIDADE: Record<TipoRecursoRestringivel, string> = {
  projeto: 'Projeto',
  area: 'Area',
  pasta: 'Pasta',
};

const CAMPO_FK: Record<TipoRecursoRestringivel, 'projeto_id' | 'area_id' | 'pasta_id'> = {
  projeto: 'projeto_id',
  area: 'area_id',
  pasta: 'pasta_id',
};

// Listas de Acesso — grupos de nome livre (definidos pelo Admin em
// Configurações) usados só pra RESTRINGIR a visibilidade de um recurso
// específico. Por padrão (`restrito = false`) nada muda em relação ao
// comportamento histórico do sistema: qualquer usuário autenticado vê tudo.
// Ver docs/adr para o racional completo desta decisão.
@Injectable()
export class AcessoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // --- Listas ------------------------------------------------------------

  async criarLista(workspaceId: string, nome: string, userId: string) {
    const lista = await this.prisma.lista.create({ data: { workspace_id: workspaceId, nome } });
    await this.auditoriaService.registrar(userId, 'CRIAR', 'Lista', lista.id, null, lista);
    return lista;
  }

  listarListasPorWorkspace(workspaceId: string) {
    return this.prisma.lista.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { nome: 'asc' },
      include: { membros: { include: { user: { select: { id: true, nome: true, email: true } } } } },
    });
  }

  async renomearLista(id: string, nome: string, userId: string) {
    const anterior = await this.prisma.lista.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundException('Lista não encontrada.');
    const atualizado = await this.prisma.lista.update({ where: { id }, data: { nome } });
    await this.auditoriaService.registrar(userId, 'ATUALIZAR', 'Lista', id, anterior, atualizado);
    return atualizado;
  }

  async removerLista(id: string, userId: string) {
    const anterior = await this.prisma.lista.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundException('Lista não encontrada.');
    await this.prisma.lista.delete({ where: { id } });
    await this.auditoriaService.registrar(userId, 'REMOVER', 'Lista', id, anterior, null);
    return { ok: true };
  }

  async adicionarMembro(listaId: string, membroId: string, autorId: string) {
    await this.prisma.listaMembro.upsert({
      where: { lista_id_user_id: { lista_id: listaId, user_id: membroId } },
      create: { lista_id: listaId, user_id: membroId },
      update: {},
    });
    await this.auditoriaService.registrar(autorId, 'ADICIONAR_MEMBRO', 'Lista', listaId, null, { user_id: membroId });
    return { ok: true };
  }

  async removerMembro(listaId: string, membroId: string, autorId: string) {
    await this.prisma.listaMembro.deleteMany({ where: { lista_id: listaId, user_id: membroId } });
    await this.auditoriaService.registrar(autorId, 'REMOVER_MEMBRO', 'Lista', listaId, { user_id: membroId }, null);
    return { ok: true };
  }

  // --- Compartilhamento por recurso ----------------------------------------

  async obterCompartilhamento(tipo: TipoRecursoRestringivel, id: string) {
    const campo = CAMPO_FK[tipo];
    const recurso = await (this.prisma[tipo] as any).findUnique({ where: { id }, select: { id: true, restrito: true } });
    if (!recurso) throw new NotFoundException(`${NOME_ENTIDADE[tipo]} não encontrado(a).`);

    const acessos = await this.prisma.acessoRecurso.findMany({
      where: { [campo]: id },
      include: {
        lista: { select: { id: true, nome: true } },
        user: { select: { id: true, nome: true, email: true } },
      },
    });

    return {
      restrito: recurso.restrito,
      listas: acessos.filter((a) => a.lista).map((a) => a.lista!),
      usuarios: acessos.filter((a) => a.user).map((a) => a.user!),
    };
  }

  async definirCompartilhamento(
    tipo: TipoRecursoRestringivel,
    id: string,
    dto: { restrito: boolean; listaIds: string[]; userIds: string[] },
    autorId: string,
  ) {
    const campo = CAMPO_FK[tipo];
    const writes: any[] = [
      (this.prisma[tipo] as any).update({ where: { id }, data: { restrito: dto.restrito } }),
      this.prisma.acessoRecurso.deleteMany({ where: { [campo]: id } }),
    ];
    if (dto.listaIds.length > 0 || dto.userIds.length > 0) {
      writes.push(
        this.prisma.acessoRecurso.createMany({
          data: [
            ...dto.listaIds.map((listaId) => ({ [campo]: id, lista_id: listaId })),
            ...dto.userIds.map((userId) => ({ [campo]: id, user_id: userId })),
          ],
        }),
      );
    }
    await this.prisma.$transaction(writes);
    await this.auditoriaService.registrar(autorId, 'ATUALIZAR_COMPARTILHAMENTO', NOME_ENTIDADE[tipo], id, null, dto);
    return this.obterCompartilhamento(tipo, id);
  }

  // --- Filtro de visibilidade ------------------------------------------------

  /// ADMIN sempre vê tudo. Um recurso não-restrito é visível pra qualquer
  /// autenticado (comportamento padrão, nunca muda). Um recurso restrito só
  /// é visível pra quem criou ou tem AcessoRecurso — direto ou via alguma
  /// Lista da qual o usuário é membro.
  async idsVisiveis<T extends RecursoRestringivel>(tipo: TipoRecursoRestringivel, candidatos: T[], userId: string, papel: Papel): Promise<Set<string>> {
    if (papel === 'ADMIN') return new Set(candidatos.map((c) => c.id));

    const restritos = candidatos.filter((c) => c.restrito && c.criado_por_id !== userId);
    if (restritos.length === 0) {
      return new Set(candidatos.map((c) => c.id));
    }

    const campo = CAMPO_FK[tipo];
    const acessos = await this.prisma.acessoRecurso.findMany({
      where: {
        [campo]: { in: restritos.map((r) => r.id) },
        OR: [{ user_id: userId }, { lista: { membros: { some: { user_id: userId } } } }],
      },
      select: { [campo]: true },
    });
    const idsLiberados = new Set(acessos.map((a: any) => a[campo] as string));

    return new Set(
      candidatos.filter((c) => !c.restrito || c.criado_por_id === userId || idsLiberados.has(c.id)).map((c) => c.id),
    );
  }

  async podeVer(tipo: TipoRecursoRestringivel, recurso: RecursoRestringivel, userId: string, papel: Papel): Promise<boolean> {
    const visiveis = await this.idsVisiveis(tipo, [recurso], userId, papel);
    return visiveis.has(recurso.id);
  }
}
