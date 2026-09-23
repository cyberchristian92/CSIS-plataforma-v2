import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

function extrairDoCookie(req: Request): string | null {
  return req?.cookies?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: extrairDoCookie,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: { sub: string; email: string; papel: string }): Promise<AuthenticatedUser> {
    return {
      id: payload.sub,
      email: payload.email,
      papel_global: payload.papel as AuthenticatedUser['papel_global'],
    };
  }
}
