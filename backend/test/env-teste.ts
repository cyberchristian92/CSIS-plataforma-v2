// Valores compartilhados entre o global-setup (que sobe o servidor) e os
// testes (que falam com ele por HTTP e preparam dados direto no banco).
// Banco SEPARADO do de desenvolvimento — nunca aponte isto para dados reais.
export const URL_BANCO_TESTE =
  process.env.TEST_DATABASE_URL ??
  'postgresql://csis_user:csis_password@localhost:5433/csis_test?schema=public';
export const PORTA_TESTE = Number(process.env.TEST_PORT ?? 3999);
export const URL_API_TESTE = `http://127.0.0.1:${PORTA_TESTE}`;

process.env.DATABASE_URL = URL_BANCO_TESTE;
