import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AtualizarPapelDto } from './dto/atualizar-papel.dto';
import { DefinirAtivoDto } from './dto/definir-ativo.dto';
import { LoginThrottlerGuard } from './login-throttler.guard';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

const COOKIE_NOME = 'access_token';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 dia

/// `secure` (cookie só trafega em HTTPS) liga sozinho em produção. Atrás de
/// um proxy que termina o HTTPS (Cloudflare Tunnel) continua certo: quem
/// decide é o navegador, que está falando HTTPS. COOKIE_SECURE=false existe
/// só para testar a build de produção em http://localhost.
function opcoesCookie() {
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER')
  register(@Body() dto: RegisterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.register(dto, user.id, user.papel_global);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.login(dto);

    res.cookie(COOKIE_NOME, token, opcoesCookie());

    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Sem guard de propósito: quem está com a sessão já expirada também
    // precisa conseguir "sair" (e ter o cookie apagado).
    const cookies = req.cookies as Record<string, string | undefined>;
    await this.authService.logoutPorToken(cookies[COOKIE_NOME]);
    res.clearCookie(COOKIE_NOME, { ...opcoesCookie(), maxAge: undefined });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @Get('usuarios')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER')
  listarUsuarios() {
    return this.authService.listarUsuarios();
  }

  @Patch('usuarios/:id/papel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER')
  atualizarPapel(
    @Param('id') id: string,
    @Body() dto: AtualizarPapelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.atualizarPapel(
      id,
      dto.papelGlobal,
      user.id,
      user.papel_global,
    );
  }

  @Patch('usuarios/:id/ativo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER')
  definirAtivo(
    @Param('id') id: string,
    @Body() dto: DefinirAtivoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.definirAtivo(
      id,
      dto.ativo,
      user.id,
      user.papel_global,
    );
  }

  @Post('esqueci-senha')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    return this.authService.solicitarRecuperacaoSenha(dto.email);
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(dto.token, dto.novaSenha);
  }
}
