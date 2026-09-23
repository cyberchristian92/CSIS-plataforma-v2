import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Valores compartilhados entre o global-setup (que sobe o servidor) e os
// testes (que falam com ele por HTTP e preparam dados direto no banco).
// Banco SEPARADO do de desenvolvimento — nunca aponte isto para dados reais.
export const URL_BANCO_TESTE =
  process.env.TEST_DATABASE_URL ??
  'postgresql://csis_user:csis_password@localhost:5433/csis_test?schema=public';
export const PORTA_TESTE = Number(process.env.TEST_PORT ?? 3999);
export const URL_API_TESTE = `http://127.0.0.1:${PORTA_TESTE}`;
// O servidor de teste grava cada e-mail como JSON aqui (EMAIL_TRANSPORTE=arquivo).
export const DIR_EMAILS_TESTE = join(tmpdir(), 'csis-emails-teste');

process.env.DATABASE_URL = URL_BANCO_TESTE;
