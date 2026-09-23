import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

export interface PayloadJwt {
  sub: string;
  /// Versão de sessão do usuário quando o token foi emitido (User.sessao_versao).
  v: number;
}

function extrairDoCookie(req: Request): string | null {
  const cookies = req?.cookies as
    Record<string, string | undefined> | undefined;
  return cookies?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: extrairDoCookie,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  /// Papel e situação vêm do BANCO a cada requisição, não do token: rebaixar,
  /// desativar ou deslogar alguém vale na hora, em vez de só quando o token
  /// expira (antes, até 24h depois).
  async validate(payload: PayloadJwt): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        papel_global: true,
        situacao: true,
        sessao_versao: true,
      },
    });
    if (
      !user ||
      user.situacao !== 'ATIVO' ||
      user.sessao_versao !== payload.v
    ) {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
    return {
      id: user.id,
      email: user.email,
      papel_global: user.papel_global as AuthenticatedUser['papel_global'],
    };
  }
}
