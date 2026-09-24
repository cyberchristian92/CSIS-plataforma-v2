import { randomUUID } from 'node:crypto';
import { access, mkdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Arquivo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EscopoService } from '../acesso/escopo.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  EVT_CONTEUDO_ALTERADO,
  EVT_CONTEUDO_REMOVIDO,
} from '../integridade/integridade.events';
import {
  corrigirNomeUpload,
  nomeSeguroEmDisco,
  sha256Arquivo,
  uploadsDir,
} from './utils/armazenamento';

/// Dono de um arquivo: exatamente um entre Projeto, Área e Workspace.
export type EscopoArquivo =
  { projeto_id: string } | { area_id: string } | { workspace_id: string };

export interface ReferenciasUpload {
  pastaId?: string;
  missaoId?: string;
  entregaId?: string;
}

/// `caminho` é o caminho absoluto no disco do servidor — detalhe interno que
/// não tem motivo pra sair na API (e ajudaria quem tenta explorar o servidor).
export type ArquivoPublico = Omit<Arquivo, 'caminho'>;

export function paraPublico(arquivo: Arquivo): ArquivoPublico {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { caminho, ...publico } = arquivo;
  return publico;
}

const PAPEIS_GESTAO = new Set(['ADMIN', 'LIDER']);

@Injectable()
export class ArquivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly escopoService: EscopoService,
    private readonly eventos: EventEmitter2,
  ) {}

  /// Upload já gravado em disco pelo multer (arquivo temporário). Valida as
  /// referências, calcula o hash por streaming e só então move o arquivo
  /// para o lugar definitivo. Em qualquer falha, o temporário é apagado.
  async enviar(
    escopo: EscopoArquivo,
    file: Express.Multer.File,
    user: AuthenticatedUser,
    refs: ReferenciasUpload = {},
  ): Promise<ArquivoPublico> {
    try {
      await this.validarReferencias(escopo, refs, user);

      const nome = corrigirNomeUpload(file.originalname);
      const hash = await sha256Arquivo(file.path);
      const id = randomUUID();
      const caminho = join(uploadsDir(), `${id}-${nomeSeguroEmDisco(nome)}`);
      await mkdir(uploadsDir(), { recursive: true });
      await rename(file.path, caminho);

      const arquivo = await this.prisma.arquivo
        .create({
          data: {
            id,
            ...escopo,
            pasta_id: refs.pastaId,
            missao_id: refs.missaoId,
            entrega_id: refs.entregaId,
            nome,
            caminho,
            hash_sha256: hash,
            tamanho: file.size,
            tipo_mime: file.mimetype || 'application/octet-stream',
            enviado_por: user.id,
          },
        })
        .catch(async (erro: unknown) => {
          await unlink(caminho).catch(() => undefined);
          throw erro;
        });

      await this.auditoriaService.registrar(
        user.id,
        'UPLOAD',
        'Arquivo',
        arquivo.id,
        null,
        {
          nome: arquivo.nome,
          hash_sha256: arquivo.hash_sha256,
          tamanho: arquivo.tamanho,
        },
      );
      this.eventos.emit(EVT_CONTEUDO_ALTERADO, {
        tipo: 'arquivo',
        id: arquivo.id,
        userId: user.id,
      });
      return paraPublico(arquivo);
    } finally {
      // Se já foi movido, o temporário não existe mais e isto não faz nada.
      await unlink(file.path).catch(() => undefined);
    }
  }

  private async validarReferencias(
    escopo: EscopoArquivo,
    refs: ReferenciasUpload,
    user: AuthenticatedUser,
  ) {
    if (refs.pastaId) {
      await this.escopoService.assertPastaNoEscopo(refs.pastaId, escopo);
    }
    if ((refs.missaoId || refs.entregaId) && !('projeto_id' in escopo)) {
      throw new BadRequestException(
        'Missão/entrega só podem ser informadas em upload de projeto.',
      );
    }
    const projetoId = 'projeto_id' in escopo ? escopo.projeto_id : null;
    if (refs.missaoId) {
      const missao = await this.prisma.missao.findUnique({
        where: { id: refs.missaoId },
        select: { projeto_id: true },
      });
      if (!missao || missao.projeto_id !== projetoId) {
        throw new BadRequestException(
          'A missão informada não existe ou pertence a outro projeto.',
        );
      }
    }
    if (refs.entregaId) {
      const entrega = await this.prisma.entrega.findUnique({
        where: { id: refs.entregaId },
        include: { missao: { select: { projeto_id: true } } },
      });
      if (!entrega || entrega.missao.projeto_id !== projetoId) {
        throw new BadRequestException(
          'A entrega informada não existe ou pertence a outro projeto.',
        );
      }
      // Anexar depois de revisada mudaria o que foi aprovado/rejeitado.
      if (entrega.autor_id !== user.id || entrega.status !== 'EM_REVISAO') {
        throw new ForbiddenException(
          'Só o autor pode anexar arquivos à entrega, e só enquanto ela aguarda revisão.',
        );
      }
    }
  }

  async listar(
    escopo: EscopoArquivo,
    user: AuthenticatedUser,
    filtros: { missaoId?: string; pastaId?: string } = {},
  ): Promise<ArquivoPublico[]> {
    const arquivos = await this.prisma.arquivo.findMany({
      where: {
        ...escopo,
        missao_id: filtros.missaoId,
        ...(filtros.pastaId !== undefined
          ? { pasta_id: filtros.pastaId === 'raiz' ? null : filtros.pastaId }
          : {}),
      },
      orderBy: { enviado_em: 'desc' },
    });
    const visiveis = await this.escopoService.filtrarPorPasta(
      user,
      escopo,
      arquivos,
    );
    return this.comNomeDeQuemEnviou(visiveis.map(paraPublico));
  }

  /// `enviado_por` é um id solto (sem relação no schema): resolve os nomes em
  /// uma consulta só, para a coluna "Enviado por" do explorador.
  private async comNomeDeQuemEnviou<T extends { enviado_por: string }>(
    arquivos: T[],
  ): Promise<(T & { enviado_por_nome: string | null })[]> {
    const ids = [...new Set(arquivos.map((a) => a.enviado_por))];
    const usuarios = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, nome: true },
    });
    const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
    return arquivos.map((a) => ({
      ...a,
      enviado_por_nome: nomes.get(a.enviado_por) ?? null,
    }));
  }

  historico(id: string) {
    return this.auditoriaService.historico('Arquivo', id);
  }

  private async buscarRegistro(id: string): Promise<Arquivo> {
    const arquivo = await this.prisma.arquivo.findUnique({ where: { id } });
    if (!arquivo) {
      throw new NotFoundException('Arquivo não encontrado.');
    }
    return arquivo;
  }

  async buscar(id: string) {
    const [arquivo] = await this.comNomeDeQuemEnviou([
      paraPublico(await this.buscarRegistro(id)),
    ]);
    return arquivo;
  }

  async verificarIntegridade(id: string) {
    const arquivo = await this.buscarRegistro(id);
    const hashAtual = await sha256Arquivo(arquivo.caminho).catch(() => null);
    return {
      integro: hashAtual === arquivo.hash_sha256,
      ausente: hashAtual === null,
      hash_original: arquivo.hash_sha256,
      hash_atual: hashAtual,
    };
  }

  /// Para download: confere o hash ANTES de servir — um arquivo adulterado
  /// em disco nunca sai da plataforma como se fosse a evidência original.
  /// `inline`: visualização no navegador (painel de detalhes) — registra
  /// VISUALIZAR em vez de DOWNLOAD na trilha de custódia.
  async prepararDownload(id: string, userId: string, inline = false) {
    const arquivo = await this.buscarRegistro(id);
    const existe = await access(arquivo.caminho)
      .then(() => true)
      .catch(() => false);
    if (!existe) {
      throw new NotFoundException(
        'O conteúdo deste arquivo não está mais no servidor.',
      );
    }
    const hashAtual = await sha256Arquivo(arquivo.caminho);
    if (hashAtual !== arquivo.hash_sha256) {
      await this.auditoriaService.registrar(
        userId,
        'FALHA_INTEGRIDADE',
        'Arquivo',
        id,
        null,
        {
          hash_original: arquivo.hash_sha256,
          hash_atual: hashAtual,
        },
      );
      throw new ConflictException(
        'Falha de integridade: o conteúdo em disco não bate com o hash registrado no envio. Download bloqueado.',
      );
    }
    await this.auditoriaService.registrar(
      userId,
      inline ? 'VISUALIZAR' : 'DOWNLOAD',
      'Arquivo',
      id,
      null,
      { hash_sha256: hashAtual },
    );
    return arquivo;
  }

  // Só troca o nome de exibição (`nome`) — o arquivo em disco continua no
  // mesmo `caminho` (que já carrega um prefixo de id, nunca colide) e o hash
  // de integridade não é afetado. É esse `nome` que o compilador de laudo usa
  // pra resolver uma referência tipo `logo.png` no markdown (arquivos na raiz
  // do projeto, ver LaudoCompilerService.materializarArquivosDoProjeto).
  async renomear(
    id: string,
    novoNome: string,
    userId: string,
  ): Promise<ArquivoPublico> {
    const anterior = await this.buscarRegistro(id);
    const atualizado = await this.prisma.arquivo.update({
      where: { id },
      data: { nome: novoNome },
    });
    await this.auditoriaService.registrar(
      userId,
      'RENOMEAR',
      'Arquivo',
      id,
      { nome: anterior.nome },
      { nome: novoNome },
    );
    // O nome entra na composição do hash do diretório-pai (ver
    // IntegridadeService.recalcularPasta) — mesmo sem o conteúdo mudar, o
    // hash do pai precisa refletir o novo nome.
    this.eventos.emit(EVT_CONTEUDO_ALTERADO, { tipo: 'arquivo', id, userId });
    return paraPublico(atualizado);
  }

  /// Evidência só é excluída por quem enviou ou pela coordenação.
  async remover(id: string, user: AuthenticatedUser) {
    const anterior = await this.buscarRegistro(id);
    if (
      anterior.enviado_por !== user.id &&
      !PAPEIS_GESTAO.has(user.papel_global)
    ) {
      throw new ForbiddenException(
        'Só quem enviou o arquivo (ou Admin/Coordenador) pode excluí-lo.',
      );
    }
    // Tolerante a arquivo já ausente do disco (ex.: alguém apagou manualmente)
    // — a exclusão do registro não deve travar por causa disso.
    await unlink(anterior.caminho).catch(() => undefined);
    await this.prisma.arquivo.delete({ where: { id } });
    await this.auditoriaService.registrar(
      user.id,
      'REMOVER',
      'Arquivo',
      id,
      {
        nome: anterior.nome,
        hash_sha256: anterior.hash_sha256,
        enviado_por: anterior.enviado_por,
      },
      null,
    );
    this.eventos.emit(EVT_CONTEUDO_REMOVIDO, {
      escopo: {
        pasta_id: anterior.pasta_id,
        missao_id: anterior.pasta_id ? null : anterior.missao_id,
        projeto_id: anterior.pasta_id ? null : anterior.projeto_id,
        area_id: anterior.pasta_id ? null : anterior.area_id,
        workspace_id: anterior.pasta_id ? null : anterior.workspace_id,
      },
      userId: user.id,
    });
    return { ok: true };
  }
}
