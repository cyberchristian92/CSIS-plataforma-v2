import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DIR_EMAILS_TESTE,
  PORTA_TESTE,
  URL_API_TESTE,
  URL_BANCO_TESTE,
} from './env-teste';

const RAIZ = join(__dirname, '..');

async function aguardarServidor(tentativas = 60): Promise<void> {
  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetch(`${URL_API_TESTE}/branding`);
      if (res.ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Servidor de teste não respondeu a tempo.');
}

/// Sobe o backend COMPILADO (o mesmo `node dist/src/main` da produção) contra
/// o banco de testes. Só aplica migrations pendentes (`migrate deploy`, não
/// destrutivo): nada é apagado entre rodadas — cada teste cria os próprios
/// dados com identificadores únicos e não depende de o banco estar vazio.
export default async function globalSetup() {
  if (!/\/csis_test(\?|$)/.test(URL_BANCO_TESTE)) {
    throw new Error(
      `Os testes só rodam num banco chamado csis_test, recebido: ${URL_BANCO_TESTE}`,
    );
  }
  const envBase = { ...process.env, DATABASE_URL: URL_BANCO_TESTE };
  execSync('npx prisma migrate deploy', {
    cwd: RAIZ,
    env: envBase,
    stdio: 'pipe',
  });
  execSync('npx nest build', { cwd: RAIZ, env: envBase, stdio: 'pipe' });

  rmSync(DIR_EMAILS_TESTE, { recursive: true, force: true });
  const servidor = spawn('node', ['dist/src/main'], {
    cwd: RAIZ,
    env: {
      ...envBase,
      NODE_ENV: 'test',
      PORT: String(PORTA_TESTE),
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-0123456789',
      UPLOADS_DIR: mkdtempSync(join(tmpdir(), 'csis-uploads-teste-')),
      LAUDO_WORKDIR: mkdtempSync(join(tmpdir(), 'csis-laudo-teste-')),
      EMAIL_TRANSPORTE: 'arquivo',
      EMAIL_DIR: DIR_EMAILS_TESTE,
      CADASTRO_LIMITE_POR_HORA: '1000',
      FRONTEND_ORIGIN: 'http://localhost:5174',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  (globalThis as { __SERVIDOR_TESTE__?: typeof servidor }).__SERVIDOR_TESTE__ =
    servidor;
  await aguardarServidor();
}
