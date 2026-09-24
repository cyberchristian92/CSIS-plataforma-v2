import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { diskStorage, type Options } from 'multer';

export function uploadsDir(): string {
  return process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
}

/// Uploads chegam primeiro aqui (mesmo volume do destino final, para o
/// `rename` ser atômico) e só são movidos para `uploadsDir()` depois de
/// hasheados e registrados no banco.
export function uploadsTmpDir(): string {
  return join(uploadsDir(), '.tmp');
}

/// Tamanho máximo por arquivo. Padrão generoso (4 GB) porque imagens
/// forenses (.E01, .dd, dumps de celular) passam fácil de 1 GB.
export function limiteUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? 4096);
  return (Number.isFinite(mb) && mb > 0 ? mb : 4096) * 1024 * 1024;
}

/// Grava o upload direto em disco (streaming) em vez de segurar o arquivo
/// inteiro na memória — com memoryStorage, um único upload de alguns GB
/// derrubaria o servidor por falta de RAM.
export function opcoesUploadEmDisco(): Options {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const destino = uploadsTmpDir();
        mkdirSync(destino, { recursive: true });
        cb(null, destino);
      },
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits: { fileSize: limiteUploadBytes(), files: 1 },
  };
}

/// SHA-256 calculado lendo o arquivo em pedaços — memória constante,
/// independente do tamanho.
export function sha256Arquivo(caminho: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(caminho)
      .on('data', (parte) => hash.update(parte))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/// O multer (via busboy) entrega `originalname` decodificado como latin1,
/// então "relatório.pdf" chega como "relatÃ³rio.pdf". Reinterpreta os bytes
/// como UTF-8 — e só aceita o resultado se ele for UTF-8 válido, para não
/// estragar um nome que já tenha vindo certo.
export function corrigirNomeUpload(nome: string): string {
  const bytes = Buffer.from(nome, 'latin1');
  const utf8 = bytes.toString('utf8');
  return Buffer.from(utf8, 'utf8').equals(bytes) ? utf8 : nome;
}

/// Nome usado só no disco (o nome de exibição continua o original no banco):
/// sem separadores de caminho, sem ".." no começo e com tamanho limitado.
export function nomeSeguroEmDisco(nome: string): string {
  const limpo = nome
    .replace(/[\\/\0]/g, '_')
    .replace(/^\.+/, '_')
    .slice(-150);
  return limpo.length > 0 ? limpo : 'arquivo';
}

const IMAGENS_SEGURAS = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
]);
const EXTENSOES_TEXTO = /\.(txt|log|md|csv|json|xml|ya?ml|ini|cfg|conf)$/i;

/// Tipo com que o arquivo pode ser mostrado DENTRO do navegador sem risco
/// de executar código no domínio da plataforma — ou null (só download).
/// SVG e HTML ficam de fora de propósito (podem conter script); texto é
/// sempre servido como text/plain, nunca pelo tipo declarado no upload.
export function tipoSeguroParaVisualizar(arquivo: {
  tipo_mime: string;
  nome: string;
}): string | null {
  const mime = arquivo.tipo_mime.toLowerCase();
  if (IMAGENS_SEGURAS.has(mime)) return mime;
  if (mime === 'application/pdf') return 'application/pdf';
  if (mime === 'text/plain' || EXTENSOES_TEXTO.test(arquivo.nome))
    return 'text/plain; charset=utf-8';
  return null;
}
