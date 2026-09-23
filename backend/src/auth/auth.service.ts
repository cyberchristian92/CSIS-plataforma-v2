import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EmailService } from './email.service';
import { Papel } from '../common/constants/papeis';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { PayloadJwt } from './jwt.strategy';

const SALT_ROUNDS = 10;
const RECUPERACAO_VALIDADE_MS = 60 * 60 * 1000; // 1 hora
// Hash bcrypt de uma senha aleatória descartada — só existe para o login de
// um e-mail inexistente gastar o mesmo tempo que o de um e-mail real.
const HASH_FICTICIO = bcrypt.hashSync(
  randomBytes(16).toString('hex'),
  SALT_ROUNDS,
);

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditoriaService: AuditoriaService,
    private readonly emailService: EmailService,
  ) {}

  async register(
    dto: RegisterDto,
    solicitanteId: string,
    solicitantePapel: Papel,
  ) {
    const email = normalizarEmail(dto.email);
    const existente = await this.prisma.user.findUnique({ where: { email } });
    if (existente) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    if (dto.papelGlobal === 'ADMIN' && solicitantePapel !== 'ADMIN') {
      throw new ForbiddenException(
        'Somente um Admin pode criar outra conta Admin.',
      );
    }

    const senha_hash = await bcrypt.hash(dto.senha, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome,
        email,
        senha_hash,
        papel_global: dto.papelGlobal ?? 'COLABORADOR',
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

    return this.paraPublico(user);
  }

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
    if (!user || !senhaValida || !user.ativo) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validarCredenciais(dto.email, dto.senha);

    const payload: PayloadJwt = { sub: user.id, v: user.sessao_versao };
    const token = await this.jwtService.signAsync(payload);

    return { token, user: this.paraPublico(user) };
  }

  /// Invalida no servidor todas as sessões abertas do usuário (o token
  /// carrega a versão de sessão; ver JwtStrategy).
  async encerrarSessoes(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { sessao_versao: { increment: 1 } },
    });
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
    const atualizado = await this.prisma.user.update({
      where: { id },
      // Desativar também derruba as sessões abertas na hora.
      data: { ativo, ...(ativo ? {} : { sessao_versao: { increment: 1 } }) },
    });
    await this.auditoriaService.registrar(
      solicitanteId,
      ativo ? 'REATIVAR_USUARIO' : 'DESATIVAR_USUARIO',
      'User',
      id,
      { ativo: anterior.ativo },
      { ativo },
    );
    return this.paraPublico(atualizado);
  }

  private async buscarOuFalhar(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.paraPublico(user);
  }

  async listarUsuarios() {
    const users = await this.prisma.user.findMany({ orderBy: { nome: 'asc' } });
    return users.map((user) => this.paraPublico(user));
  }

  async solicitarRecuperacaoSenha(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizarEmail(email) },
    });
    // Sempre retorna sucesso genérico, exista ou não o usuário — evita que
    // este endpoint seja usado pra descobrir quais emails têm conta.
    if (!user || !user.ativo) {
      return { ok: true };
    }

    const tokenPlano = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(tokenPlano).digest('hex');

    await this.prisma.tokenRecuperacaoSenha.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expira_em: new Date(Date.now() + RECUPERACAO_VALIDADE_MS),
      },
    });

    const frontendOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:5000';
    const link = `${frontendOrigin}/?token=${tokenPlano}`;
    await this.emailService.enviarEmailRedefinicaoSenha(user.email, link);

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
    tokenPlano: string,
    novaSenha: string,
  ): Promise<{ ok: true }> {
    const tokenHash = createHash('sha256').update(tokenPlano).digest('hex');
    const registro = await this.prisma.tokenRecuperacaoSenha.findUnique({
      where: { token_hash: tokenHash },
    });

    const valido =
      registro && !registro.usado_em && registro.expira_em > new Date();
    if (!valido) {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    const senha_hash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    // Trocar a senha derruba todas as sessões abertas — se a conta tinha sido
    // invadida, o invasor sai junto.
    await this.prisma.user.update({
      where: { id: registro.user_id },
      data: { senha_hash, sessao_versao: { increment: 1 } },
    });

    // Invalida todos os tokens pendentes do usuário, não só o usado agora —
    // um link antigo ainda não usado não deve continuar valendo.
    await this.prisma.tokenRecuperacaoSenha.updateMany({
      where: { user_id: registro.user_id, usado_em: null },
      data: { usado_em: new Date() },
    });

    await this.auditoriaService.registrar(
      registro.user_id,
      'REDEFINIR_SENHA',
      'User',
      registro.user_id,
      null,
      null,
    );

    return { ok: true };
  }

  private paraPublico(user: {
    id: string;
    nome: string;
    email: string;
    papel_global: string;
    criado_em: Date;
    ativo: boolean;
  }) {
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      papel_global: user.papel_global,
      criado_em: user.criado_em,
      ativo: user.ativo,
    };
  }
}
