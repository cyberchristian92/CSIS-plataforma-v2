import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTransport, type Transporter } from 'nodemailer';

export interface MensagemEmail {
  para: string;
  assunto: string;
  texto: string;
}

/// Modo de envio, escolhido por EMAIL_TRANSPORTE:
///   smtp    — envia de verdade (padrão quando SMTP_HOST está definido).
///             Funciona com qualquer provedor: Brevo, Resend, Gmail, o
///             servidor da própria empresa...
///   log     — só registra no log (padrão sem SMTP_HOST; desenvolvimento).
///   arquivo — grava cada mensagem como JSON em EMAIL_DIR (testes e2e).
type Transporte = 'smtp' | 'log' | 'arquivo';

function transporteConfigurado(): Transporte {
  const escolhido = process.env.EMAIL_TRANSPORTE as Transporte | undefined;
  if (escolhido === 'smtp' || escolhido === 'log' || escolhido === 'arquivo')
    return escolhido;
  return process.env.SMTP_HOST ? 'smtp' : 'log';
}

/// Único ponto de contato com "enviar e-mail" no sistema.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtp: Transporter | null = null;

  /// true quando as mensagens realmente saem da plataforma. Sem isso, a
  /// interface mostra o link (convite, confirmação) para ser copiado à mão —
  /// a instância funciona mesmo antes de alguém configurar SMTP.
  get enviaDeVerdade(): boolean {
    return transporteConfigurado() === 'smtp';
  }

  /// Nunca lança: uma falha de e-mail não pode desfazer um cadastro ou
  /// convite já gravado. Devolve se a mensagem foi entregue ao provedor.
  async enviar(mensagem: MensagemEmail): Promise<boolean> {
    try {
      switch (transporteConfigurado()) {
        case 'smtp':
          await this.transportador().sendMail({
            from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
            to: mensagem.para,
            subject: mensagem.assunto,
            text: mensagem.texto,
          });
          return true;
        case 'arquivo': {
          const dir =
            process.env.EMAIL_DIR ?? join(process.cwd(), 'emails-teste');
          await mkdir(dir, { recursive: true });
          await writeFile(
            join(dir, `${Date.now()}-${randomUUID()}.json`),
            JSON.stringify(mensagem),
          );
          return false;
        }
        case 'log':
          this.logger.log(
            `[e-mail não enviado — SMTP não configurado] Para ${mensagem.para}: ${mensagem.assunto}`,
          );
          return false;
      }
    } catch (erro) {
      this.logger.error(
        `Falha ao enviar e-mail para ${mensagem.para}: ${(erro as Error).message}`,
      );
      return false;
    }
  }

  private transportador(): Transporter {
    if (!this.smtp) {
      const porta = Number(process.env.SMTP_PORT ?? 587);
      this.smtp = createTransport({
        host: process.env.SMTP_HOST,
        port: porta,
        // 465 = TLS direto; 587/25 = STARTTLS (negociado automaticamente).
        secure: process.env.SMTP_SECURE
          ? process.env.SMTP_SECURE === 'true'
          : porta === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
    return this.smtp;
  }
}
