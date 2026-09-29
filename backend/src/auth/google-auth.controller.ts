import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, urlFrontend } from './auth.service';
import { GoogleService } from './google.service';
import {
  COOKIE_GOOGLE_CADASTRO,
  COOKIE_GOOGLE_OAUTH,
  COOKIE_SESSAO,
  opcoesCookie,
} from './cookies';

const DEZ_MINUTOS_MS = 10 * 60 * 1000;
const TRINTA_MINUTOS_MS = 30 * 60 * 1000;

/// Ida e volta do "Entrar com Google". O navegador chega aqui por navegação
/// (não fetch), então as respostas são redirecionamentos para o frontend,
/// com ?erro=/?aviso= que a tela de login traduz.
@Controller('auth')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly google: GoogleService,
    private readonly authService: AuthService,
  ) {}

  /// Para a tela de login saber se mostra o botão.
  @Get('provedores')
  provedores() {
    return { google: this.google.configurado };
  }

  @Get('google')
  async iniciar(@Res() res: Response) {
    if (!this.google.configurado) {
      return res.redirect(urlFrontend('/login?erro=google-indisponivel'));
    }
    const { url, cookie } = await this.google.iniciar();
    res.cookie(COOKIE_GOOGLE_OAUTH, cookie, opcoesCookie(DEZ_MINUTOS_MS));
    return res.redirect(url);
  }

  @Get('google/callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') erroGoogle?: string,
  ) {
    const cookies = req.cookies as Record<string, string | undefined>;
    res.clearCookie(COOKIE_GOOGLE_OAUTH, {
      ...opcoesCookie(),
      maxAge: undefined,
    });
    if (erroGoogle) {
      return res.redirect(urlFrontend('/login?erro=google-cancelado'));
    }

    let identidade: Awaited<ReturnType<GoogleService['concluir']>>;
    try {
      identidade = await this.google.concluir(
        cookies[COOKIE_GOOGLE_OAUTH],
        state,
        code,
      );
    } catch (erro) {
      this.logger.warn(`Login com Google recusado: ${(erro as Error).message}`);
      return res.redirect(urlFrontend('/login?erro=google-falhou'));
    }
    if (!identidade.emailVerificado) {
      return res.redirect(urlFrontend('/login?erro=google-email'));
    }

    const resultado = await this.authService.entrarComGoogle(identidade);
    switch (resultado.tipo) {
      case 'sessao':
        res.cookie(COOKIE_SESSAO, resultado.token, opcoesCookie());
        return res.redirect(urlFrontend('/'));
      case 'cadastro':
        res.cookie(
          COOKIE_GOOGLE_CADASTRO,
          await this.google.assinarCadastro(identidade),
          opcoesCookie(TRINTA_MINUTOS_MS),
        );
        return res.redirect(urlFrontend('/cadastro?google=1'));
      case 'redirecionar':
        return res.redirect(urlFrontend(resultado.destino));
    }
  }

  /// Nome e e-mail vindos do Google, para a tela de cadastro preencher.
  @Get('google/cadastro-pendente')
  async cadastroPendente(@Req() req: Request) {
    const cookies = req.cookies as Record<string, string | undefined>;
    const identidade = await this.google.lerCadastro(
      cookies[COOKIE_GOOGLE_CADASTRO],
    );
    if (!identidade) {
      throw new NotFoundException('Nenhum cadastro pelo Google em andamento.');
    }
    return { nome: identidade.nome, email: identidade.email };
  }
}
