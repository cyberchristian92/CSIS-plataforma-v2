import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/// Limite de tentativas de login contado por IP + e-mail. Só por IP, uma
/// equipe inteira atrás do mesmo NAT (ou do Cloudflare Tunnel sem
/// TRUST_PROXY) seria bloqueada junto; só por e-mail, qualquer pessoa
/// conseguiria travar a conta de outra de propósito.
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const body = req.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    return Promise.resolve(`${req.ip}|${email}`);
  }
}
