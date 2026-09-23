import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';
import * as digestApi from 'multiformats/hashes/digest';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  EVT_CONTEUDO_ALTERADO,
  EVT_CONTEUDO_REMOVIDO,
  EVT_HIERARQUIA_ALTERADA,
  EVT_PASTA_ALTERADA,
  type ConteudoAlteradoEvent,
  type EscopoRemovidoEvent,
  type HierarquiaAlteradaEvent,
  type PastaAlteradaEvent,
} from './integridade.events';

const SHA2_256_MULTICODEC = 0x12;

interface NoFilho {
  nome: string;
  cid: string;
}

// Escopo mutuamente exclusivo compartilhado por Pasta/Arquivo/Documento (ver
// prisma/schema.prisma) — usado pra descobrir o "pai" na árvore ao subir a
// cascata de recálculo.
interface EscopoConteudo {
  pasta_id: string | null;
  missao_id: string | null;
  projeto_id: string | null;
  area_id: string | null;
  workspace_id: string | null;
}

type TipoDono = 'pasta' | 'missao' | 'projeto' | 'area' | 'workspace';

// Motor de integridade (Merkle Tree) — ver ADR-0002. Cada nó de "diretório"
// (Workspace/Área/Projeto/Missão/Pasta) guarda em `ipfs_cid` um hash
// derivado dos CIDs dos filhos diretos; qualquer mudança num nó de folha
// (Arquivo/Documento) dispara um recálculo em cascata, subindo a árvore até
// o Workspace. O recálculo roda fora do ciclo de vida da requisição HTTP
// (via eventos do @nestjs/event-emitter) pra não deixar upload/edição mais
// lentos — a 100% consistência síncrona não é necessária aqui porque o
// Postgres continua sendo a fonte da verdade (ver ADR-0001); o CID é
// "eventualmente consistente" dentro do mesmo processo, tipicamente em
// milissegundos.
@Injectable()
export class IntegridadeService {
  private readonly logger = new Logger(IntegridadeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // --- Primitivas de hash ---------------------------------------------------

  async hashConteudo(bytes: Uint8Array): Promise<string> {
    const digest = await sha256.digest(bytes);
    return CID.create(1, raw.code, digest).toString();
  }

  /// Formata um SHA-256 já calculado (ex.: `Arquivo.hash_sha256`) como CID,
  /// sem reprocessar o conteúdo — mantém `hash_sha256` (hash forense, ver
  /// Cap. 4 do TCC) e `ipfs_cid` (endereço) necessariamente consistentes
  /// entre si, e evita I/O extra de reler o arquivo do disco.
  private cidDeSha256Hex(hex: string): string {
    const digest = digestApi.create(SHA2_256_MULTICODEC, Buffer.from(hex, 'hex'));
    return CID.create(1, raw.code, digest).toString();
  }

  /// Hash de um "diretório": serializa os filhos ordenados deterministicamente
  /// por nome e calcula o CID desse blob. É uma simplificação do UnixFS real
  /// do IPFS (que usa dag-pb) — não produz um CID literalmente igual ao de um
  /// `ipfs add` de um diretório de verdade, só precisa ser determinístico e
  /// sensível a qualquer mudança em qualquer filho (ver ADR-0002).
  private async hashDiretorio(filhos: NoFilho[]): Promise<string> {
    const ordenados = [...filhos].sort((a, b) => a.nome.localeCompare(b.nome));
    const bytes = new TextEncoder().encode(JSON.stringify(ordenados));
    return this.hashConteudo(bytes);
  }

  private paiDe(no: EscopoConteudo): { tipo: TipoDono; id: string } | null {
    if (no.pasta_id) return { tipo: 'pasta', id: no.pasta_id };
    if (no.missao_id) return { tipo: 'missao', id: no.missao_id };
    if (no.projeto_id) return { tipo: 'projeto', id: no.projeto_id };
    if (no.area_id) return { tipo: 'area', id: no.area_id };
    if (no.workspace_id) return { tipo: 'workspace', id: no.workspace_id };
    return null;
  }

  private async registrarCid(entidade: string, id: string, anterior: string | null, novo: string, userId: string | null) {
    if (anterior === novo) return;
    await this.auditoria.registrar(userId, 'CID_ATUALIZADO', entidade, id, { ipfs_cid: anterior }, { ipfs_cid: novo });
  }

  // --- Folhas de conteúdo ----------------------------------------------------

  async recalcularArquivo(id: string, userId: string | null): Promise<void> {
    const arquivo = await this.prisma.arquivo.findUnique({ where: { id } });
    if (!arquivo) return;
    const novoCid = this.cidDeSha256Hex(arquivo.hash_sha256);
    if (novoCid !== arquivo.ipfs_cid) {
      await this.prisma.arquivo.update({ where: { id }, data: { ipfs_cid: novoCid } });
      await this.registrarCid('Arquivo', id, arquivo.ipfs_cid, novoCid, userId);
    }
    await this.subirCascata(arquivo, userId);
  }

  async recalcularDocumento(id: string, userId: string | null): Promise<void> {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) return;
    const novoCid = await this.hashConteudo(new TextEncoder().encode(documento.conteudo));
    if (novoCid !== documento.ipfs_cid) {
      await this.prisma.documento.update({ where: { id }, data: { ipfs_cid: novoCid } });
      await this.registrarCid('Documento', id, documento.ipfs_cid, novoCid, userId);
    }
    await this.subirCascata(documento, userId);
  }

  // --- Nós de diretório -------------------------------------------------------

  private async recalcularPasta(id: string, userId: string | null): Promise<void> {
    const pasta = await this.prisma.pasta.findUnique({ where: { id } });
    if (!pasta) return;

    const [subpastas, arquivos, documentos] = await Promise.all([
      this.prisma.pasta.findMany({ where: { pasta_pai_id: id }, select: { nome: true, ipfs_cid: true } }),
      this.prisma.arquivo.findMany({ where: { pasta_id: id }, select: { nome: true, ipfs_cid: true } }),
      this.prisma.documento.findMany({ where: { pasta_id: id }, select: { id: true, ipfs_cid: true } }),
    ]);

    const filhos: NoFilho[] = [
      ...subpastas.map((p) => ({ nome: `pasta:${p.nome}`, cid: p.ipfs_cid ?? '' })),
      ...arquivos.map((a) => ({ nome: `arquivo:${a.nome}`, cid: a.ipfs_cid ?? '' })),
      ...documentos.map((d) => ({ nome: `documento:${d.id}`, cid: d.ipfs_cid ?? '' })),
    ];

    const novoCid = await this.hashDiretorio(filhos);
    if (novoCid !== pasta.ipfs_cid) {
      await this.prisma.pasta.update({ where: { id }, data: { ipfs_cid: novoCid } });
      await this.registrarCid('Pasta', id, pasta.ipfs_cid, novoCid, userId);
    }
    // Pasta usa `pasta_pai_id` (não `pasta_id`) pro próprio pai — normaliza
    // pro formato de EscopoConteudo antes de continuar subindo.
    await this.subirCascata(
      {
        pasta_id: pasta.pasta_pai_id,
        missao_id: pasta.pasta_pai_id ? null : pasta.missao_id,
        projeto_id: pasta.pasta_pai_id ? null : pasta.projeto_id,
        area_id: pasta.pasta_pai_id ? null : pasta.area_id,
        workspace_id: pasta.pasta_pai_id ? null : pasta.workspace_id,
      },
      userId,
    );
  }

  private async recalcularDono(tipo: Exclude<TipoDono, 'pasta'>, id: string, userId: string | null): Promise<void> {
    if (tipo === 'missao') return this.recalcularMissao(id, userId);
    if (tipo === 'projeto') return this.recalcularProjeto(id, userId);
    if (tipo === 'area') return this.recalcularArea(id, userId);
    return this.recalcularWorkspace(id, userId);
  }

  private async filhosDeConteudoSolto(escopo: 'missao_id' | 'projeto_id' | 'area_id' | 'workspace_id', id: string): Promise<NoFilho[]> {
    const [pastasRaiz, arquivos, documentos] = await Promise.all([
      this.prisma.pasta.findMany({ where: { [escopo]: id, pasta_pai_id: null }, select: { nome: true, ipfs_cid: true } }),
      this.prisma.arquivo.findMany({ where: { [escopo]: id, pasta_id: null }, select: { nome: true, ipfs_cid: true } }),
      this.prisma.documento.findMany({ where: { [escopo]: id, pasta_id: null }, select: { id: true, ipfs_cid: true } }),
    ]);
    return [
      ...pastasRaiz.map((p) => ({ nome: `pasta:${p.nome}`, cid: p.ipfs_cid ?? '' })),
      ...arquivos.map((a) => ({ nome: `arquivo:${a.nome}`, cid: a.ipfs_cid ?? '' })),
      ...documentos.map((d) => ({ nome: `documento:${d.id}`, cid: d.ipfs_cid ?? '' })),
    ];
  }

  private async recalcularMissao(id: string, userId: string | null): Promise<void> {
    const missao = await this.prisma.missao.findUnique({ where: { id } });
    if (!missao) return;
    const filhos = await this.filhosDeConteudoSolto('missao_id', id);
    const novoCid = await this.hashDiretorio(filhos);
    if (novoCid !== missao.ipfs_cid) {
      await this.prisma.missao.update({ where: { id }, data: { ipfs_cid: novoCid } });
      await this.registrarCid('Missao', id, missao.ipfs_cid, novoCid, userId);
    }
    await this.subirCascata({ pasta_id: null, missao_id: null, projeto_id: missao.projeto_id, area_id: null, workspace_id: null }, userId);
  }

  private async recalcularProjeto(id: string, userId: string | null): Promise<void> {
    const projeto = await this.prisma.projeto.findUnique({ where: { id } });
    if (!projeto) return;
    const [soltos, missoes] = await Promise.all([
      this.filhosDeConteudoSolto('projeto_id', id),
      this.prisma.missao.findMany({ where: { projeto_id: id }, select: { id: true, titulo: true, ipfs_cid: true } }),
    ]);
    const filhos: NoFilho[] = [
      ...soltos,
      ...missoes.map((m) => ({ nome: `missao:${m.titulo}:${m.id}`, cid: m.ipfs_cid ?? '' })),
    ];
    const novoCid = await this.hashDiretorio(filhos);
    if (novoCid !== projeto.ipfs_cid) {
      await this.prisma.projeto.update({ where: { id }, data: { ipfs_cid: novoCid } });
      await this.registrarCid('Projeto', id, projeto.ipfs_cid, novoCid, userId);
    }
    await this.subirCascata({ pasta_id: null, missao_id: null, projeto_id: null, area_id: projeto.area_id, workspace_id: null }, userId);
  }

  private async recalcularArea(id: string, userId: string | null): Promise<void> {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) return;
    const [soltos, projetos] = await Promise.all([
      this.filhosDeConteudoSolto('area_id', id),
      this.prisma.projeto.findMany({ where: { area_id: id }, select: { id: true, nome: true, ipfs_cid: true } }),
    ]);
    const filhos: NoFilho[] = [
      ...soltos,
      ...projetos.map((p) => ({ nome: `projeto:${p.nome}:${p.id}`, cid: p.ipfs_cid ?? '' })),
    ];
    const novoCid = await this.hashDiretorio(filhos);
    if (novoCid !== area.ipfs_cid) {
      await this.prisma.area.update({ where: { id }, data: { ipfs_cid: novoCid } });
      await this.registrarCid('Area', id, area.ipfs_cid, novoCid, userId);
    }
    await this.subirCascata({ pasta_id: null, missao_id: null, projeto_id: null, area_id: null, workspace_id: area.workspace_id }, userId);
  }

  private async recalcularWorkspace(id: string, userId: string | null): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });
    if (!workspace) return;
    const [soltos, areas] = await Promise.all([
      this.filhosDeConteudoSolto('workspace_id', id),
      this.prisma.area.findMany({ where: { workspace_id: id }, select: { id: true, nome: true, ipfs_cid: true } }),
    ]);
    const filhos: NoFilho[] = [
      ...soltos,
      ...areas.map((a) => ({ nome: `area:${a.nome}:${a.id}`, cid: a.ipfs_cid ?? '' })),
    ];
    const novoCid = await this.hashDiretorio(filhos);
    if (novoCid !== workspace.ipfs_cid) {
      await this.prisma.workspace.update({ where: { id }, data: { ipfs_cid: novoCid } });
      await this.registrarCid('Workspace', id, workspace.ipfs_cid, novoCid, userId);
    }
    // Workspace é a raiz — a cascata termina aqui.
  }

  async subirCascata(no: EscopoConteudo, userId: string | null): Promise<void> {
    const pai = this.paiDe(no);
    if (!pai) return;
    if (pai.tipo === 'pasta') {
      await this.recalcularPasta(pai.id, userId);
    } else {
      await this.recalcularDono(pai.tipo, pai.id, userId);
    }
  }

  // --- Listeners de evento -----------------------------------------------------
  // Disparados pelos services de conteúdo (arquivos/documentos/pastas) e de
  // hierarquia (missões/projetos/áreas) após criar/atualizar/remover — ver
  // integridade.events.ts. Rodam fire-and-forget (a requisição HTTP original
  // já respondeu antes disso terminar).

  @OnEvent(EVT_CONTEUDO_ALTERADO)
  async aoAlterarConteudo(evento: ConteudoAlteradoEvent) {
    try {
      if (evento.tipo === 'arquivo') await this.recalcularArquivo(evento.id, evento.userId);
      else await this.recalcularDocumento(evento.id, evento.userId);
    } catch (err) {
      this.logger.error(`Falha ao recalcular integridade de ${evento.tipo} ${evento.id}`, err as Error);
    }
  }

  @OnEvent(EVT_PASTA_ALTERADA)
  async aoAlterarPasta(evento: PastaAlteradaEvent) {
    try {
      await this.recalcularPasta(evento.id, evento.userId);
    } catch (err) {
      this.logger.error(`Falha ao recalcular integridade da pasta ${evento.id}`, err as Error);
    }
  }

  @OnEvent(EVT_CONTEUDO_REMOVIDO)
  async aoRemoverNo(evento: EscopoRemovidoEvent) {
    try {
      await this.subirCascata(evento.escopo, evento.userId);
    } catch (err) {
      this.logger.error('Falha ao recalcular integridade após remoção', err as Error);
    }
  }

  @OnEvent(EVT_HIERARQUIA_ALTERADA)
  async aoAlterarHierarquia(evento: HierarquiaAlteradaEvent) {
    try {
      await this.recalcularDono(evento.tipo, evento.id, evento.userId);
    } catch (err) {
      this.logger.error(`Falha ao recalcular integridade de ${evento.tipo} ${evento.id}`, err as Error);
    }
  }

  // --- Recálculo completo (populamento retroativo / admin) ---------------------

  /// Varre tudo, de baixo pra cima, e recalcula cada nível — usado tanto pra
  /// popular dados que já existiam antes da camada de integridade existir
  /// quanto como uma ação manual de admin ("recalcular tudo") pra cobrir os
  /// casos que ainda não emitem evento automaticamente (criar/remover
  /// Projeto/Área diretamente, sem passar por conteúdo).
  async recalcularTudo(userId: string | null): Promise<{ arquivos: number; documentos: number; pastas: number; missoes: number; projetos: number; areas: number; workspaces: number }> {
    const [arquivos, documentos] = await Promise.all([
      this.prisma.arquivo.findMany({ select: { id: true } }),
      this.prisma.documento.findMany({ select: { id: true } }),
    ]);
    for (const a of arquivos) await this.recalcularArquivoIsolado(a.id, userId);
    for (const d of documentos) await this.recalcularDocumentoIsolado(d.id, userId);

    // Pastas: precisa respeitar profundidade (folhas antes das raízes) —
    // reordena por distância até a raiz em vez de assumir uma ordem qualquer.
    const pastas = await this.prisma.pasta.findMany({ select: { id: true, pasta_pai_id: true } });
    for (const p of this.ordenarPorProfundidade(pastas)) await this.recalcularPasta(p.id, userId);

    const missoes = await this.prisma.missao.findMany({ select: { id: true } });
    for (const m of missoes) await this.recalcularMissao(m.id, userId);

    const projetos = await this.prisma.projeto.findMany({ select: { id: true } });
    for (const p of projetos) await this.recalcularProjeto(p.id, userId);

    const areas = await this.prisma.area.findMany({ select: { id: true } });
    for (const a of areas) await this.recalcularArea(a.id, userId);

    const workspaces = await this.prisma.workspace.findMany({ select: { id: true } });
    for (const w of workspaces) await this.recalcularWorkspace(w.id, userId);

    return {
      arquivos: arquivos.length,
      documentos: documentos.length,
      pastas: pastas.length,
      missoes: missoes.length,
      projetos: projetos.length,
      areas: areas.length,
      workspaces: workspaces.length,
    };
  }

  /// Variantes sem `subirCascata` — usadas só por `recalcularTudo`, que já
  /// recalcula cada nível explicitamente em ordem (folha -> raiz), então
  /// subir a cascata a cada folha seria trabalho redundante.
  private async recalcularArquivoIsolado(id: string, userId: string | null) {
    const arquivo = await this.prisma.arquivo.findUnique({ where: { id } });
    if (!arquivo) return;
    const novoCid = this.cidDeSha256Hex(arquivo.hash_sha256);
    if (novoCid !== arquivo.ipfs_cid) {
      await this.prisma.arquivo.update({ where: { id }, data: { ipfs_cid: novoCid } });
      await this.registrarCid('Arquivo', id, arquivo.ipfs_cid, novoCid, userId);
    }
  }

  private async recalcularDocumentoIsolado(id: string, userId: string | null) {
    const documento = await this.prisma.documento.findUnique({ where: { id } });
    if (!documento) return;
    const novoCid = await this.hashConteudo(new TextEncoder().encode(documento.conteudo));
    if (novoCid !== documento.ipfs_cid) {
      await this.prisma.documento.update({ where: { id }, data: { ipfs_cid: novoCid } });
      await this.registrarCid('Documento', id, documento.ipfs_cid, novoCid, userId);
    }
  }

  private ordenarPorProfundidade(pastas: { id: string; pasta_pai_id: string | null }[]): { id: string; pasta_pai_id: string | null }[] {
    const porId = new Map(pastas.map((p) => [p.id, p]));
    const profundidade = (p: { id: string; pasta_pai_id: string | null }, visitados = new Set<string>()): number => {
      if (!p.pasta_pai_id || visitados.has(p.id)) return 0;
      const pai = porId.get(p.pasta_pai_id);
      if (!pai) return 0;
      return 1 + profundidade(pai, new Set(visitados).add(p.id));
    };
    return [...pastas].sort((a, b) => profundidade(b) - profundidade(a));
  }
}
