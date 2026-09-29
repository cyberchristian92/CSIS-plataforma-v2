import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EVT_INSCRICAO_PENDENTE } from './inscricao.events';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EmailService } from '../auth/email.service';
import { TokensService } from '../auth/tokens.service';
import {
  SALT_ROUNDS,
  normalizarEmail,
  urlFrontend,
} from '../auth/auth.service';
import type { Papel } from '../common/constants/papeis';
import {
  corrigirNomeUpload,
  nomeSeguroEmDisco,
  sha256Arquivo,
  uploadsDir,
} from '../arquivos/utils/armazenamento';
import {
  AtualizarCampoDto,
  ConfiguracaoInscricaoDto,
  CriarCampoDto,
  TipoCampo,
} from './dto/campo-inscricao.dto';
import { InscreverDto } from './dto/inscrever.dto';
import { validarRespostas } from './validar-respostas';

const CONFIRMACAO_VALIDADE_MS = 48 * 60 * 60 * 1000; // 48 horas
const TIPOS_COM_OPCOES = new Set<TipoCampo>(['SELECAO', 'MULTIPLA']);
const PREFIXO_ANEXO = 'anexo_';

/// Cadastro público liga/desliga por instância (CADASTRO_ABERTO=false fecha).
export function cadastroAberto(): boolean {
  return process.env.CADASTRO_ABERTO !== 'false';
}

const MENSAGEM_COM_CONFIRMACAO =
  'Cadastro recebido. Enviamos um link de confirmação para o seu e-mail — depois de confirmar, a equipe analisa o pedido.';
const MENSAGEM_SEM_CONFIRMACAO =
  'Cadastro recebido. A equipe vai analisar o pedido e liberar o acesso — tente entrar mais tarde com seu e-mail e senha.';

@Injectable()
export class InscricaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
    private readonly emailService: EmailService,
    private readonly tokens: TokensService,
    private readonly eventos: EventEmitter2,
  ) {}

  // --- Formulário (configurado pela equipe) --------------------------------

  camposAtivos() {
    return this.prisma.campoInscricao.findMany({
      where: { arquivado: false },
      orderBy: [{ ordem: 'asc' }, { criado_em: 'asc' }],
    });
  }

  async configuracao() {
    const config = await this.prisma.configuracaoInscricao.findUnique({
      where: { id: 'padrao' },
    });
    return {
      link_externo: config?.link_externo ?? null,
      instrucao_externa: config?.instrucao_externa ?? null,
    };
  }

  async definirConfiguracao(dto: ConfiguracaoInscricaoDto, userId: string) {
    const anterior = await this.configuracao();
    const dados = {
      link_externo:
        dto.link_externo === undefined
          ? anterior.link_externo
          : dto.link_externo?.trim() || null,
      instrucao_externa:
        dto.instrucao_externa === undefined
          ? anterior.instrucao_externa
          : dto.instrucao_externa?.trim() || null,
    };
    await this.prisma.configuracaoInscricao.upsert({
      where: { id: 'padrao' },
      create: { id: 'padrao', ...dados },
      update: dados,
    });
    await this.auditoriaService.registrar(
      userId,
      'ATUALIZAR',
      'ConfiguracaoInscricao',
      'padrao',
      anterior,
      dados,
    );
    return dados;
  }

  async formularioPublico() {
    const [campos, config] = await Promise.all([
      this.camposAtivos(),
      this.configuracao(),
    ]);
    return {
      aberto: cadastroAberto(),
      // Etapa complementar opcional (Google Forms, Typeform...): tudo que a
      // equipe quiser perguntar além do mínimo fica fora da plataforma.
      formulario_externo: config.link_externo
        ? { link: config.link_externo, instrucao: config.instrucao_externa }
        : null,
      campos: campos.map(
        ({ id, rotulo, ajuda, tipo, obrigatorio, opcoes }) => ({
          id,
          rotulo,
          ajuda,
          tipo,
          obrigatorio,
          opcoes,
        }),
      ),
    };
  }

  listarCampos(incluirArquivados: boolean) {
    return this.prisma.campoInscricao.findMany({
      where: incluirArquivados ? {} : { arquivado: false },
      orderBy: [{ arquivado: 'asc' }, { ordem: 'asc' }, { criado_em: 'asc' }],
    });
  }

  private validarOpcoes(tipo: TipoCampo, opcoes: string[] | undefined) {
    const limpas = [
      ...new Set((opcoes ?? []).map((o) => o.trim()).filter(Boolean)),
    ];
    if (TIPOS_COM_OPCOES.has(tipo) && limpas.length === 0) {
      throw new BadRequestException(
        'Campos de seleção precisam de pelo menos uma opção.',
      );
    }
    return TIPOS_COM_OPCOES.has(tipo) ? limpas : [];
  }

  async criarCampo(dto: CriarCampoDto, userId: string) {
    const ultimo = await this.prisma.campoInscricao.aggregate({
      where: { arquivado: false },
      _max: { ordem: true },
    });
    const campo = await this.prisma.campoInscricao.create({
      data: {
        rotulo: dto.rotulo.trim(),
        ajuda: dto.ajuda?.trim() || null,
        tipo: dto.tipo,
        obrigatorio: dto.obrigatorio ?? false,
        opcoes: this.validarOpcoes(dto.tipo, dto.opcoes),
        ordem: (ultimo._max.ordem ?? -1) + 1,
      },
    });
    await this.auditoriaService.registrar(
      userId,
      'CRIAR',
      'CampoInscricao',
      campo.id,
      null,
      campo,
    );
    return campo;
  }

  async atualizarCampo(id: string, dto: AtualizarCampoDto, userId: string) {
    const anterior = await this.prisma.campoInscricao.findUnique({
      where: { id },
    });
    if (!anterior) throw new NotFoundException('Campo não encontrado.');
    const tipo = dto.tipo ?? (anterior.tipo as TipoCampo);
    const atualizado = await this.prisma.campoInscricao.update({
      where: { id },
      data: {
        rotulo: dto.rotulo?.trim(),
        ajuda: dto.ajuda === undefined ? undefined : dto.ajuda.trim() || null,
        tipo: dto.tipo,
        obrigatorio: dto.obrigatorio,
        opcoes:
          dto.opcoes !== undefined || dto.tipo !== undefined
            ? this.validarOpcoes(tipo, dto.opcoes ?? anterior.opcoes)
            : undefined,
      },
    });
    await this.auditoriaService.registrar(
      userId,
      'ATUALIZAR',
      'CampoInscricao',
      id,
      anterior,
      atualizado,
    );
    return atualizado;
  }

  /// Arquiva em vez de apagar: inscrições já enviadas guardam a própria cópia
  /// das respostas, mas os anexos continuam apontando para o campo.
  async arquivarCampo(id: string, userId: string) {
    const anterior = await this.prisma.campoInscricao.findUnique({
      where: { id },
    });
    if (!anterior) throw new NotFoundException('Campo não encontrado.');
    await this.prisma.campoInscricao.update({
      where: { id },
      data: { arquivado: true },
    });
    await this.auditoriaService.registrar(
      userId,
      'ARQUIVAR',
      'CampoInscricao',
      id,
      anterior,
      null,
    );
    return { ok: true };
  }

  async ordenarCampos(ids: string[], userId: string) {
    const ativos = await this.camposAtivos();
    const idsAtivos = new Set(ativos.map((c) => c.id));
    if (
      ids.length !== idsAtivos.size ||
      !ids.every((id) => idsAtivos.has(id))
    ) {
      throw new BadRequestException(
        'Informe todos os campos ativos do formulário, na nova ordem.',
      );
    }
    await this.prisma.$transaction(
      ids.map((id, ordem) =>
        this.prisma.campoInscricao.update({ where: { id }, data: { ordem } }),
      ),
    );
    await this.auditoriaService.registrar(
      userId,
      'REORDENAR',
      'CampoInscricao',
      'formulario',
      null,
      { ids },
    );
    return this.camposAtivos();
  }

  // --- Inscrição (público) --------------------------------------------------

  async inscrever(dto: InscreverDto, arquivos: Express.Multer.File[]) {
    try {
      if (!cadastroAberto()) {
        throw new ForbiddenException(
          'O cadastro público está fechado nesta instância. Peça um convite à equipe.',
        );
      }
      // Robô: responde como se tivesse dado certo, sem gravar nada.
      if (dto.site) return { ok: true, mensagem: this.mensagemEnviado() };

      let respostas: Record<string, unknown> = {};
      try {
        const lido: unknown = dto.respostas ? JSON.parse(dto.respostas) : {};
        if (lido && typeof lido === 'object' && !Array.isArray(lido))
          respostas = lido as Record<string, unknown>;
        else throw new Error();
      } catch {
        throw new BadRequestException('Respostas em formato inválido.');
      }

      const campos = await this.camposAtivos();
      const camposArquivo = new Set(
        campos.filter((c) => c.tipo === 'ARQUIVO').map((c) => c.id),
      );
      const anexosPorCampo = new Map<string, Express.Multer.File>();
      for (const arquivo of arquivos) {
        const campoId = arquivo.fieldname.startsWith(PREFIXO_ANEXO)
          ? arquivo.fieldname.slice(PREFIXO_ANEXO.length)
          : '';
        if (!camposArquivo.has(campoId) || anexosPorCampo.has(campoId)) {
          throw new BadRequestException(
            `Anexo inesperado: "${arquivo.fieldname}".`,
          );
        }
        anexosPorCampo.set(campoId, arquivo);
      }
      const nomesAnexos = new Map(
        [...anexosPorCampo].map(([campoId, arquivo]) => [
          campoId,
          corrigirNomeUpload(arquivo.originalname),
        ]),
      );

      const { registradas, erros } = validarRespostas(
        campos,
        respostas,
        nomesAnexos,
      );
      if (erros.length > 0) {
        throw new BadRequestException(erros);
      }

      const email = normalizarEmail(dto.email);
      const existente = await this.prisma.user.findUnique({ where: { email } });
      if (existente) {
        // Mesma resposta de sucesso — não revela quem já tem conta. O dono
        // do e-mail fica sabendo da tentativa.
        await this.emailService.enviar({
          para: email,
          assunto: 'Tentativa de cadastro — {{instancia}}',
          texto:
            'Alguém tentou criar uma conta na plataforma da {{instancia}} com este e-mail, que já está cadastrado.\n\n' +
            `Se foi você e esqueceu a senha, use: ${urlFrontend('/esqueci-senha')}\n\n` +
            'Se não foi você, ignore esta mensagem.',
        });
        return { ok: true, mensagem: this.mensagemEnviado() };
      }

      const anexosGravados = await this.gravarAnexos(anexosPorCampo);
      const user = await this.prisma.user
        .create({
          data: {
            nome: dto.nome.trim(),
            email,
            senha_hash: await bcrypt.hash(dto.senha, SALT_ROUNDS),
            papel_global: 'COLABORADOR',
            // Sem envio de e-mail na instância, ninguém receberia o link de
            // confirmação: a inscrição vai direto para a fila da equipe.
            situacao: this.emailService.entregaEmails
              ? 'AGUARDANDO_EMAIL'
              : 'PENDENTE',
            inscricao: {
              create: {
                respostas: registradas as unknown as Prisma.InputJsonValue,
                anexos: {
                  create: anexosGravados.map(({ campo_id, ...a }) => ({
                    ...a,
                    campo: { connect: { id: campo_id } },
                  })),
                },
              },
            },
          },
        })
        .catch(async (erro: unknown) => {
          await Promise.all(
            anexosGravados.map((a) => unlink(a.caminho).catch(() => undefined)),
          );
          // Duas inscrições simultâneas com o mesmo e-mail: a segunda perde.
          if ((erro as { code?: string }).code === 'P2002')
            throw new ConflictException('E-mail já cadastrado.');
          throw erro;
        });

      await this.auditoriaService.registrar(
        user.id,
        'INSCREVER',
        'User',
        user.id,
        null,
        {
          nome: user.nome,
          email: user.email,
          anexos: anexosGravados.map((a) => ({
            nome: a.nome,
            hash_sha256: a.hash_sha256,
          })),
        },
      );
      if (this.emailService.entregaEmails) {
        await this.enviarConfirmacao(user.id, user.nome, user.email);
      } else {
        // Sem confirmação de e-mail, o pedido já está na fila da equipe.
        await this.eventos.emitAsync(EVT_INSCRICAO_PENDENTE, {
          userId: user.id,
        });
      }
      return { ok: true, mensagem: this.mensagemEnviado() };
    } finally {
      await Promise.all(
        arquivos.map((a) => unlink(a.path).catch(() => undefined)),
      );
    }
  }

  private mensagemEnviado() {
    return this.emailService.entregaEmails
      ? MENSAGEM_COM_CONFIRMACAO
      : MENSAGEM_SEM_CONFIRMACAO;
  }

  private async gravarAnexos(anexos: Map<string, Express.Multer.File>) {
    const destino = join(uploadsDir(), 'inscricoes');
    await mkdir(destino, { recursive: true });
    const gravados: {
      campo_id: string;
      nome: string;
      caminho: string;
      hash_sha256: string;
      tamanho: number;
      tipo_mime: string;
    }[] = [];
    for (const [campoId, arquivo] of anexos) {
      const nome = corrigirNomeUpload(arquivo.originalname);
      const hash = await sha256Arquivo(arquivo.path);
      const caminho = join(
        destino,
        `${randomUUID()}-${nomeSeguroEmDisco(nome)}`,
      );
      await rename(arquivo.path, caminho);
      gravados.push({
        campo_id: campoId,
        nome,
        caminho,
        hash_sha256: hash,
        tamanho: arquivo.size,
        tipo_mime: arquivo.mimetype || 'application/octet-stream',
      });
    }
    return gravados;
  }

  private async enviarConfirmacao(userId: string, nome: string, email: string) {
    const token = await this.tokens.emitir(
      userId,
      'CONFIRMACAO_EMAIL',
      CONFIRMACAO_VALIDADE_MS,
    );
    await this.emailService.enviar({
      para: email,
      assunto: 'Confirme seu e-mail — {{instancia}}',
      texto:
        `Olá, ${nome}.\n\nRecebemos seu cadastro na plataforma da {{instancia}}. Confirme seu e-mail pelo link abaixo ` +
        `(válido por 48 horas):\n\n${urlFrontend(`/confirmar-email?token=${token}`)}\n\n` +
        'Depois disso, a equipe analisa o pedido e você recebe um aviso quando for aprovado.',
    });
  }

  // --- Análise (equipe) -----------------------------------------------------

  listar(situacao?: string) {
    return this.prisma.inscricao.findMany({
      where: situacao ? { user: { situacao } } : {},
      orderBy: { criado_em: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            nome: true,
            email: true,
            situacao: true,
            papel_global: true,
          },
        },
        anexos: { omit: { caminho: true } },
        decidido_por: { select: { id: true, nome: true } },
      },
    });
  }

  async anexo(inscricaoId: string, anexoId: string, userId: string) {
    const anexo = await this.prisma.anexoInscricao.findFirst({
      where: { id: anexoId, inscricao_id: inscricaoId },
    });
    if (!anexo) throw new NotFoundException('Anexo não encontrado.');
    await this.auditoriaService.registrar(
      userId,
      'DOWNLOAD',
      'AnexoInscricao',
      anexoId,
      null,
      {
        hash_sha256: anexo.hash_sha256,
      },
    );
    return anexo;
  }

  private async buscarParaDecisao(id: string) {
    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!inscricao) throw new NotFoundException('Inscrição não encontrada.');
    return inscricao;
  }

  async aprovar(
    id: string,
    papel: Papel,
    observacao: string | undefined,
    decisor: { id: string; papel: Papel },
  ) {
    if (papel === 'ADMIN' && decisor.papel !== 'ADMIN') {
      throw new ForbiddenException(
        'Somente um Admin pode aprovar alguém como Admin.',
      );
    }
    const inscricao = await this.buscarParaDecisao(id);
    // Aprovar quem ainda não confirmou o e-mail é permitido: a equipe pode
    // ter verificado a pessoa por outro canal (ou a instância não envia
    // e-mails e a confirmação nunca chegaria).
    if (
      inscricao.user.situacao !== 'PENDENTE' &&
      inscricao.user.situacao !== 'AGUARDANDO_EMAIL'
    ) {
      throw new ConflictException(
        `Esta inscrição já foi decidida (situação: ${inscricao.user.situacao}).`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: inscricao.user_id },
        data: { situacao: 'ATIVO', papel_global: papel },
      }),
      this.prisma.inscricao.update({
        where: { id },
        data: {
          decidido_por_id: decisor.id,
          decidido_em: new Date(),
          observacao,
        },
      }),
    ]);
    await this.auditoriaService.registrar(
      decisor.id,
      'APROVAR_INSCRICAO',
      'User',
      inscricao.user_id,
      null,
      {
        papel_global: papel,
        observacao: observacao ?? null,
      },
    );
    await this.emailService.enviar({
      para: inscricao.user.email,
      assunto: 'Cadastro aprovado — {{instancia}}',
      texto: `Olá, ${inscricao.user.nome}.\n\nSeu cadastro foi aprovado. Você já pode entrar: ${urlFrontend('/login')}`,
    });
    return { ok: true };
  }

  async recusar(id: string, observacao: string | undefined, decisorId: string) {
    const inscricao = await this.buscarParaDecisao(id);
    if (
      inscricao.user.situacao !== 'PENDENTE' &&
      inscricao.user.situacao !== 'AGUARDANDO_EMAIL'
    ) {
      throw new ConflictException(
        `Esta inscrição já foi decidida (situação: ${inscricao.user.situacao}).`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: inscricao.user_id },
        data: { situacao: 'RECUSADO' },
      }),
      this.prisma.inscricao.update({
        where: { id },
        data: {
          decidido_por_id: decisorId,
          decidido_em: new Date(),
          observacao,
        },
      }),
    ]);
    await this.auditoriaService.registrar(
      decisorId,
      'RECUSAR_INSCRICAO',
      'User',
      inscricao.user_id,
      null,
      {
        observacao: observacao ?? null,
      },
    );
    // A observação é interna (fica para a equipe); o candidato recebe só o aviso.
    await this.emailService.enviar({
      para: inscricao.user.email,
      assunto: 'Sobre seu cadastro — {{instancia}}',
      texto: `Olá, ${inscricao.user.nome}.\n\nNo momento, seu cadastro não foi aprovado. Obrigado pelo interesse.`,
    });
    return { ok: true };
  }
}
