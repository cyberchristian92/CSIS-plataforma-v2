import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

/// Configuração compartilhada entre `main.ts` e os testes e2e — o app de
/// teste precisa passar exatamente pelos mesmos pipes/middlewares que o de
/// produção, senão um teste pode passar só porque a validação não rodou.
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Atrás de proxy reverso / Cloudflare Tunnel, o IP real do cliente vem em
  // X-Forwarded-For — sem isto, todo mundo aparece com o IP do proxy e o
  // limite de tentativas de login vira um limite global compartilhado.
  // Valor aceito é o mesmo do Express ("loopback", "1", lista de sub-redes...).
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const valor = /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy;
    (app as NestExpressApplication).set('trust proxy', valor);
  }

  app.enableCors({
    origin: origensPermitidas(),
    credentials: true,
  });
}

/// FRONTEND_ORIGIN aceita uma lista separada por vírgula (ex.: domínio de
/// produção + IP da rede local para testar pelo celular).
export function origensPermitidas(): string[] {
  return (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);
}

const SEGREDOS_DE_EXEMPLO = new Set([
  'troque-este-segredo-antes-de-usar-em-producao',
  '42a6c312b8ba18a0a8d0f2907f09b6776d922059b1dfd1d5535d7b2a1f927d105dadc9ed1abbd975571d44e84575d502',
]);

/// Recusa subir sem um JWT_SECRET forte. Com o segredo de exemplo (que está
/// público no repositório), qualquer pessoa conseguiria forjar um token de
/// ADMIN — então em produção isso é erro fatal, não aviso.
export function validarSegredoJwt(): void {
  const segredo = process.env.JWT_SECRET ?? '';
  const fraco = segredo.length < 32 || SEGREDOS_DE_EXEMPLO.has(segredo);
  if (!fraco) return;

  const mensagem =
    'JWT_SECRET ausente, curto (< 32 caracteres) ou igual ao valor de exemplo do repositório. ' +
    "Gere um com: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"";
  if (process.env.NODE_ENV === 'production') {
    throw new Error(mensagem);
  }
  console.warn(`[aviso] ${mensagem}`);
}
