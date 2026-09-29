import { createServer, type Server } from 'node:http';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import {
  GOOGLE_FALSO_CLIENT_ID,
  GOOGLE_FALSO_ISSUER,
  PORTA_GOOGLE_FALSO,
} from './env-teste';

/// Google de mentira para os testes de "Entrar com Google": o backend de
/// teste aponta os endereços de token e de chaves (GOOGLE_TOKEN_URL,
/// GOOGLE_JWKS_URL) para cá. O `code` que o teste manda no callback é o
/// próprio conteúdo do id_token (JSON em base64url) — assim cada teste
/// escolhe a identidade que o "Google" devolve.
export async function iniciarGoogleFalso(): Promise<Server> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'teste', alg: 'RS256' };

  const servidor = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/certs') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (req.method === 'POST' && req.url === '/token') {
      let corpo = '';
      req.on('data', (parte: Buffer) => (corpo += parte.toString()));
      req.on('end', () => {
        void (async () => {
          const form = new URLSearchParams(corpo);
          const code = form.get('code') ?? '';
          // PKCE: o backend precisa mandar o code_verifier.
          if (!form.get('code_verifier') || code === 'invalido') {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'invalid_grant' }));
            return;
          }
          const claims = JSON.parse(
            Buffer.from(code, 'base64url').toString('utf8'),
          ) as Record<string, unknown>;
          const idToken = await new SignJWT(claims)
            .setProtectedHeader({ alg: 'RS256', kid: 'teste' })
            .setIssuer(GOOGLE_FALSO_ISSUER)
            .setAudience(GOOGLE_FALSO_CLIENT_ID)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              id_token: idToken,
              access_token: 'x',
              token_type: 'Bearer',
            }),
          );
        })();
      });
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((ok) =>
    servidor.listen(PORTA_GOOGLE_FALSO, '127.0.0.1', ok),
  );
  return servidor;
}
