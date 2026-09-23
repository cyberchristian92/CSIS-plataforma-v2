import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EmailService } from './email.service';
import { Papel } from '../common/constants/papeis';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;
const RECUPERACAO_VALIDADE_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditoriaService: AuditoriaService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto, solicitanteId: string, solicitantePapel: Papel) {
    const existente = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existente) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    if (dto.papelGlobal === 'ADMIN' && solicitantePapel !== 'ADMIN') {
      throw new ForbiddenException('Somente um Admin pode criar outra conta Admin.');
    }

    const senha_hash = await bcrypt.hash(dto.senha, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { nome: dto.nome, email: dto.email, senha_hash, papel_global: dto.papelGlobal ?? 'COLABORADOR' },
    });

    await this.auditoriaService.registrar(solicitanteId, 'CONVIDAR', 'User', user.id, null, {
      nome: user.nome,
      email: user.email,
      papel_global: user.papel_global,
    });

    return this.paraPublico(user);
  }

  async atualizarPapel(id: string, novoPapel: Papel, solicitanteId: string, solicitantePapel: Papel) {
    if (id === solicitanteId) {
      throw new ForbiddenException('Você não pode alterar o próprio papel — peça para outro Admin/Coordenador fazer isso.');
    }
    if (novoPapel === 'ADMIN' && solicitantePapel !== 'ADMIN') {
      throw new ForbiddenException('Somente um Admin pode promover alguém a Admin.');
    }

    const anterior = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const atualizado = await this.prisma.user.update({ where: { id }, data: { papel_global: novoPapel } });

    await this.auditoriaService.registrar(solicitanteId, 'ALTERAR_PAPEL', 'User', id, { papel_global: anterior.papel_global }, { papel_global: novoPapel });

    return this.paraPublico(atualizado);
  }

  async validarCredenciais(email: string, senha: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const senhaValida = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validarCredenciais(dto.email, dto.senha);

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      papel: user.papel_global,
    });

    return { token, user: this.paraPublico(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.paraPublico(user);
  }

  async listarUsuarios() {
    const users = await this.prisma.user.findMany({ orderBy: { nome: 'asc' } });
    return users.map((user) => this.paraPublico(user));
  }

  async solicitarRecuperacaoSenha(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Sempre retorna sucesso genérico, exista ou não o usuário — evita que
    // este endpoint seja usado pra descobrir quais emails têm conta.
    if (!user) {
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

    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5000';
    const link = `${frontendOrigin}/?token=${tokenPlano}`;
    await this.emailService.enviarEmailRedefinicaoSenha(user.email, link);

    await this.auditoriaService.registrar(user.id, 'SOLICITAR_RECUPERACAO_SENHA', 'User', user.id, null, null);

    return { ok: true };
  }

  async redefinirSenha(tokenPlano: string, novaSenha: string): Promise<{ ok: true }> {
    const tokenHash = createHash('sha256').update(tokenPlano).digest('hex');
    const registro = await this.prisma.tokenRecuperacaoSenha.findUnique({ where: { token_hash: tokenHash } });

    const valido = registro && !registro.usado_em && registro.expira_em > new Date();
    if (!valido) {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    const senha_hash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: registro.user_id }, data: { senha_hash } });

    // Invalida todos os tokens pendentes do usuário, não só o usado agora —
    // um link antigo ainda não usado não deve continuar valendo.
    await this.prisma.tokenRecuperacaoSenha.updateMany({
      where: { user_id: registro.user_id, usado_em: null },
      data: { usado_em: new Date() },
    });

    await this.auditoriaService.registrar(registro.user_id, 'REDEFINIR_SENHA', 'User', registro.user_id, null, null);

    return { ok: true };
  }

  private paraPublico(user: { id: string; nome: string; email: string; papel_global: string; criado_em: Date }) {
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      papel_global: user.papel_global,
      criado_em: user.criado_em,
    };
  }
}
