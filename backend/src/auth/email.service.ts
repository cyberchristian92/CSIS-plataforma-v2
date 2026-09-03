import { Injectable, Logger } from '@nestjs/common';

/// Único ponto de contato com "enviar email" no sistema. Por enquanto só
/// simula o envio (loga o link) — trocar a implementação por um provedor
/// SMTP/API real não exige mudar nenhum outro arquivo que dependa disto.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async enviarEmailRedefinicaoSenha(email: string, link: string): Promise<void> {
    this.logger.log(`[SIMULADO] Link de redefinição de senha para ${email}: ${link}`);
  }
}
