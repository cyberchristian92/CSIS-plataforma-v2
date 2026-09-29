import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVT_INSCRICAO_PENDENTE } from '../inscricao/inscricao.events';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EmailService } from './email.service';
import { TokensService } from './tokens.service';
import { NOME_PAPEL, Papel } from '../common/constants/papeis';
import { origensPermitidas } from '../configurar-app';
import { LoginDto } from './dto/login.dto';
import { ConvidarDto } from './dto/convidar.dto';
import type { PayloadJwt } from './jwt.strategy';

export const SALT_ROUNDS = 10;
const RECUPERACAO_VALIDADE_MS = 60 * 60 * 1000; // 1 hora
const CONVITE_VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
// Hash bcrypt de uma senha aleatória descartada — só existe para o login de
// um e-mail inexistente gastar o mesmo tempo que o de um e-mail real.
const HASH_FICTICIO = bcrypt.hashSync(
  randomBytes(16).toString('hex'),
  SALT_ROUNDS,
);

export const SITUACOES = [
  'ATIVO',
  'CONVIDADO',
  'AGUARDANDO_EMAIL',
  'PENDENTE',
  'RECUSADO',
  'DESATIVADO',
] as const;
export type Situacao = (typeof SITUACOES)[number];

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/// Endereço público do frontend (primeira origem de FRONTEND_ORIGIN) — base
/// dos links enviados por e-mail.
export function urlFrontend(caminho: string): string {
  return `${origensPermitidas()[0].replace(/\/$/, '')}${caminho}`;
}

/// Senha impossível de acertar, para contas que ainda não definiram a própria
/// (convite pendente): ninguém entra até o link do convite ser usado.
export function senhaInutilizavel(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString('hex'), SALT_ROUNDS);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditoriaService: AuditoriaService,
    private readonly emailService: EmailService,
    private readonly tokens: TokensService,
    private readonly eventos: EventEmitter2,
  ) {}

  // --- Convite -------------------------------------------------------------

  /// A pessoa convidada recebe um link e cria a PRÓPRIA senha — ninguém (nem
  /// o Admin) chega a conhecer a senha de outra pessoa, o que manteria aberta
  /// a possibilidade de agir em nome dela na trilha de auditoria.
  async convidar(
    dto: ConvidarDto,
    solicitanteId: string,
    solicitantePapel: Papel,
  ) {
    if (dto.papelGlobal === 'ADMIN' && solicitantePapel !== 'ADMIN') {
      throw new ForbiddenException(
        'Somente um Admin pode convidar outro Admin.',
      );
    }
    const email = normalizarEmail(dto.email);
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }
    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome,
        email,
        senha_hash: await senhaInutilizavel(),
        papel_global: dto.papelGlobal,
        situacao: 'CONVIDADO',
      },
    });
    await this.auditoriaService.registrar(
      solicitanteId,
      'CONVIDAR',
      'User',
      user.id,
      null,
      {
        nome: user.nome,
        email: user.email,
        papel_global: user.papel_global,
      },
    );
    return {
      usuario: this.paraPublico(user),
      ...(await this.enviarConvite(user)),
    };
  }

  async reenviarConvite(id: string, solicitanteId: string) {
    const user = await this.buscarOuFalhar(id);
    if (user.situacao !== 'CONVIDADO') {
      throw new ConflictException('Este usuário já aceitou o convite.');
    }
    await this.auditoriaService.registrar(
      solicitanteId,
      'REENVIAR_CONVITE',
      'User',
      id,
      null,
      null,
    );
    return {
      usuario: this.paraPublico(user),
      ...(await this.enviarConvite(user)),
    };
  }

  /// Sem SMTP configurado o link volta na resposta, para o Admin copiar e
  /// mandar por outro canal (Telas_Interface_Plataforma_CSIS.md, "Convidar
  /// Usuário"). Com SMTP, o link só vai por e-mail.
  private async enviarConvite(user: User) {
    const token = await this.tokens.emitir(
      user.id,
      'CONVITE',
      CONVITE_VALIDADE_MS,
    );
    const link = urlFrontend(`/convite?token=${token}`);
    const email_enviado = await this.emailService.enviar({
      para: user.email,
      assunto: 'Convite para {{instancia}}',
      texto:
        `Olá, ${user.nome}.\n\nVocê foi convidado(a) para a plataforma da {{instancia}} como ${NOME_PAPEL[user.papel_global as Papel] ?? user.papel_global}.\n` +
        `Crie sua senha pelo link abaixo (válido por 7 dias):\n\n${link}\n\n` +
        'Se você não esperava este convite, ignore esta mensagem.',
    });
    return email_enviado ? { email_enviado } : { email_enviado, link };
  }

  async previaConvite(token: string) {
    const registro = await this.tokens.consultar(token, 'CONVITE');
    const user = await this.buscarOuFalhar(registro.user_id);
    return {
      nome: user.nome,
      email: user.email,
      papel_global: user.papel_global,
    };
  }

  async aceitarConvite(token: string, senha: string) {
    const userId = await this.tokens.consumir(token, 'CONVITE');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        senha_hash: await bcrypt.hash(senha, SALT_ROUNDS),
        situacao: 'ATIVO',
        sessao_versao: { increment: 1 },
      },
    });
    await this.auditoriaService.registrar(
      userId,
      'ACEITAR_CONVITE',
      'User',
      userId,
      null,
      null,
    );
    return this.paraPublico(user);
  }

  // --- Confirmação de e-mail (cadastro público) ----------------------------

  async confirmarEmail(token: string) {
    const userId = await this.tokens.consumir(token, 'CONFIRMACAO_EMAIL');
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, situacao: 'AGUARDANDO_EMAIL' },
      data: { situacao: 'PENDENTE' },
    });
    if (count > 0) {
      await this.auditoriaService.registrar(
        userId,
        'CONFIRMAR_EMAIL',
        'User',
        userId,
        null,
        null,
      );
      await this.eventos.emitAsync(EVT_INSCRICAO_PENDENTE, { userId });
    }
    return { ok: true };
  }

  // --- Login e sessão ---------------------------------------------------------

  async validarCredenciais(email: string, senha: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizarEmail(email) },
    });
    // Compara com um hash fixo quando o usuário não existe: o tempo de
    // resposta fica igual, e não dá pra descobrir quais e-mails têm conta
    // medindo quanto o login demora.
    const senhaValida = await bcrypt.compare(
      senha,
      user?.senha_hash ?? HASH_FICTICIO,
    );
    if (!user || !senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    // Com a senha certa, dá pra dizer o que falta — ajuda quem acabou de se
    // cadastrar sem revelar nada a quem não sabe a senha.
    switch (user.situacao as Situacao) {
      case 'ATIVO':
        return user;
      case 'AGUARDANDO_EMAIL':
        throw new ForbiddenException(
          'Confirme seu e-mail pelo link que enviamos para concluir o cadastro.',
        );
      case 'PENDENTE':
        throw new ForbiddenException(
          'Seu cadastro foi recebido e aguarda aprovação da equipe.',
        );
      default:
        throw new UnauthorizedException('Credenciais inválidas.');
    }
  }

  async login(dto: LoginDto) {
    const user = await this.validarCredenciais(dto.email, dto.senha);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { ultimo_acesso: new Date() },
    });
    const payload: PayloadJwt = { sub: user.id, v: user.sessao_versao };
    const token = await this.jwtService.signAsync(payload);
    return { token, user: this.paraPublico(user) };
  }

  /// Logout de verdade: além de o controller apagar o cookie, a versão de
  /// sessão sobe — um cookie copiado antes do logout deixa de valer.
  async logoutPorToken(token: string | undefined) {
    if (!token) return;
    const payload = await this.jwtService
      .verifyAsync<PayloadJwt>(token)
      .catch(() => null);
    if (!payload) return;
    const { count } = await this.prisma.user.updateMany({
      where: { id: payload.sub, sessao_versao: payload.v },
      data: { sessao_versao: { increment: 1 } },
    });
    if (count > 0) {
      await this.auditoriaService.registrar(
        payload.sub,
        'LOGOUT',
        'User',
        payload.sub,
        null,
        null,
      );
    }
  }

  // --- Gestão de usuários ------------------------------------------------------

  async atualizarPapel(
    id: string,
    novoPapel: Papel,
    solicitanteId: string,
    solicitantePapel: Papel,
  ) {
    if (id === solicitanteId) {
      throw new ForbiddenException(
        'Você não pode alterar o próprio papel — peça para outro Admin/Coordenador fazer isso.',
      );
    }
    if (novoPapel === 'ADMIN' && solicitantePapel !== 'ADMIN') {
      throw new ForbiddenException(
        'Somente um Admin pode promover alguém a Admin.',
      );
    }
    const anterior = await this.buscarOuFalhar(id);
    if (anterior.papel_global === 'ADMIN' && solicitantePapel !== 'ADMIN') {
      throw new ForbiddenException(
        'Somente um Admin pode alterar o papel de outro Admin.',
      );
    }
    const atualizado = await this.prisma.user.update({
      where: { id },
      data: { papel_global: novoPapel },
    });
    await this.auditoriaService.registrar(
      solicitanteId,
      'ALTERAR_PAPEL',
      'User',
      id,
      { papel_global: anterior.papel_global },
      { papel_global: novoPapel },
    );
    return this.paraPublico(atualizado);
  }

  async definirAtivo(
    id: string,
    ativo: boolean,
    solicitanteId: string,
    solicitantePapel: Papel,
  ) {
    if (id === solicitanteId) {
      throw new ForbiddenException('Você não pode desativar a própria conta.');
    }
    const anterior = await this.buscarOuFalhar(id);
    if (anterior.papel_global === 'ADMIN' && solicitantePapel !== 'ADMIN') {
      throw new ForbiddenException(
        'Somente um Admin pode desativar outro Admin.',
      );
    }
    if (anterior.situacao !== 'ATIVO' && anterior.situacao !== 'DESATIVADO') {
      throw new ConflictException(
        `Não é possível ${ativo ? 'reativar' : 'desativar'} um usuário na situação ${anterior.situacao}.`,
      );
    }
    const situacao: Situacao = ativo ? 'ATIVO' : 'DESATIVADO';
    const atualizado = await this.prisma.user.update({
      where: { id },
      // Desativar também derruba as sessões abertas na hora.
      data: { situacao, ...(ativo ? {} : { sessao_versao: { increment: 1 } }) },
    });
    await this.auditoriaService.registrar(
      solicitanteId,
      ativo ? 'REATIVAR_USUARIO' : 'DESATIVAR_USUARIO',
      'User',
      id,
      { situacao: anterior.situacao },
      { situacao },
    );
    return this.paraPublico(atualizado);
  }

  private async buscarOuFalhar(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  async me(userId: string) {
    return this.paraPublico(await this.buscarOuFalhar(userId));
  }

  async listarUsuarios() {
    const users = await this.prisma.user.findMany({ orderBy: { nome: 'asc' } });
    return users.map((user) => this.paraPublico(user));
  }

  // --- Recuperação de senha ----------------------------------------------------

  async solicitarRecuperacaoSenha(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizarEmail(email) },
    });
    // Sempre retorna sucesso genérico, exista ou não o usuário — evita que
    // este endpoint seja usado pra descobrir quais emails têm conta.
    if (!user || user.situacao !== 'ATIVO') {
      return { ok: true };
    }
    const token = await this.tokens.emitir(
      user.id,
      'RECUPERACAO',
      RECUPERACAO_VALIDADE_MS,
    );
    await this.emailService.enviar({
      para: user.email,
      assunto: 'Redefinição de senha — {{instancia}}',
      texto:
        `Olá, ${user.nome}.\n\nPara criar uma nova senha, use o link abaixo (válido por 1 hora):\n\n` +
        `${urlFrontend(`/redefinir-senha?token=${token}`)}\n\n` +
        'Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.',
    });
    await this.auditoriaService.registrar(
      user.id,
      'SOLICITAR_RECUPERACAO_SENHA',
      'User',
      user.id,
      null,
      null,
    );
    return { ok: true };
  }

  async redefinirSenha(
    token: string,
    novaSenha: string,
  ): Promise<{ ok: true }> {
    const userId = await this.tokens.consumir(token, 'RECUPERACAO');
    // Trocar a senha derruba todas as sessões abertas — se a conta tinha sido
    // invadida, o invasor sai junto.
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        senha_hash: await bcrypt.hash(novaSenha, SALT_ROUNDS),
        sessao_versao: { increment: 1 },
      },
    });
    await this.auditoriaService.registrar(
      userId,
      'REDEFINIR_SENHA',
      'User',
      userId,
      null,
      null,
    );
    return { ok: true };
  }

  paraPublico(user: User) {
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      papel_global: user.papel_global,
      criado_em: user.criado_em,
      situacao: user.situacao,
      ativo: user.situacao === 'ATIVO',
      ultimo_acesso: user.ultimo_acesso,
    };
  }
}
