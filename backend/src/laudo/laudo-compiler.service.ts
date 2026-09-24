import { Injectable } from '@nestjs/common';
import { mkdir, writeFile, readFile, access, rm, copyFile, rename, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { PrismaService } from '../prisma/prisma.service';

// Lidas em runtime (dentro das funções que usam), não como constante de
// módulo — nesse ponto do carregamento (import estático de app.module.ts
// ainda em andamento) o ConfigModule.forRoot() ainda não rodou, então
// `process.env` não tem as variáveis do `.env` ainda; uma constante de
// módulo aqui sempre pegaria só o valor default.
function laudoWorkdir(): string {
  return process.env.LAUDO_WORKDIR ?? join(process.cwd(), 'laudo-workdir');
}
/// Quanto esperar pelo motor: o tempo de compilação do próprio worker
/// (LAUDO_TIMEOUT_S, 120 s por padrão) mais uma folga para a fila.
function prazoMs(): number {
  const s = Number(process.env.LAUDO_TIMEOUT_S ?? 120);
  return ((Number.isFinite(s) && s > 0 ? s : 120) + 30) * 1000;
}

const PRAZO_PARA_PEGAR_PEDIDO_MS = 10_000;

const existe = (caminho: string) =>
  access(caminho)
    .then(() => true)
    .catch(() => false);

export interface ResultadoCompilacaoLaudo {
  sucesso: boolean;
  log: string;
}

// Neutraliza separadores de caminho e ".." em nomes vindos do banco (Pasta.nome,
// Arquivo.nome) antes de usá-los como segmento de caminho no diretório de
// compilação — evita que um nome como "../../etc" escape do diretório.
function segmentoSeguro(nome: string): string {
  const limpo = nome.replace(/[\\/]/g, '_').replace(/^\.+/, '_');
  return limpo.length > 0 ? limpo : '_';
}

@Injectable()
export class LaudoCompilerService {
  constructor(private readonly prisma: PrismaService) {}

  /// Materializa, na RAIZ do diretório de compilação, os arquivos que estão
  /// na raiz do projeto (`pasta_id == null`) — de propósito, ignora
  /// subpastas. Isso padroniza a referência no markdown/front-matter: uma
  /// logo ou imagem sobe direto na raiz do gerenciador de arquivos do
  /// projeto e é referenciada só pelo nome (`logo.png`, sem `img/` ou
  /// qualquer caminho), sem precisar espelhar a árvore de pastas inteira
  /// nem depender de nenhum asset fixo embutido na plataforma — cada
  /// projeto/perito usa a própria identidade visual, sem exceção.
  private async materializarArquivosDoProjeto(projetoId: string, destino: string): Promise<void> {
    const arquivos = await this.prisma.arquivo.findMany({ where: { projeto_id: projetoId, pasta_id: null } });
    for (const arquivo of arquivos) {
      const caminhoDestino = join(destino, segmentoSeguro(arquivo.nome));
      // Se o arquivo original não existir mais em disco, não derruba a
      // compilação inteira por causa de uma imagem faltante — o pandoc só
      // vai reclamar dela especificamente.
      await copyFile(arquivo.caminho, caminhoDestino).catch(() => undefined);
    }
  }

  async compilar(
    documentoId: string,
    projetoId: string,
    conteudoMarkdown: string,
    templateCaminho?: string,
  ): Promise<ResultadoCompilacaoLaudo> {
    const dir = join(laudoWorkdir(), documentoId);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    // O worker roda com outro usuário ("laudo") e precisa gravar o PDF e
    // limpar as fontes aqui dentro.
    await chmod(dir, 0o777);

    await this.materializarArquivosDoProjeto(projetoId, dir);
    await writeFile(join(dir, 'laudo.md'), conteudoMarkdown, 'utf8');

    // Template customizado: copia o .latex enviado pra dentro do diretório de
    // compilação com um nome fixo, e referencia esse nome no --template. Sem
    // isso, cai no "eisvogel" já embutido na imagem do motor de compilação
    // (ver backend/pandoc/Dockerfile) — continua funcionando pra quem nunca
    // subiu template nenhum.
    let nomeTemplate = 'eisvogel';
    if (templateCaminho) {
      nomeTemplate = 'template-customizado.latex';
      await copyFile(templateCaminho, join(dir, nomeTemplate)).catch(() => {
        // Se o arquivo original sumiu do disco, cai pro eisvogel em vez de
        // travar a compilação inteira por causa de um template ausente.
        nomeTemplate = 'eisvogel';
      });
    }

    // Pedido para o motor de compilação (backend/pandoc/worker.sh), que
    // vigia a pasta compartilhada. Gravado por último e via rename, para o
    // worker nunca ver um pedido antes de laudo.md e anexos estarem prontos.
    await writeFile(join(dir, 'pedido.tmp'), JSON.stringify({ template: nomeTemplate }), 'utf8');
    await rename(join(dir, 'pedido.tmp'), join(dir, 'pedido.json'));

    // O worker olha a fila a cada segundo: pedido intocado depois de alguns
    // segundos quer dizer motor parado, e aí nem vale esperar o prazo todo.
    const inicio = Date.now();
    const limite = inicio + prazoMs();
    let resultado: { sucesso: boolean } | null = null;
    while (Date.now() < limite) {
      resultado = await readFile(join(dir, 'resultado.json'), 'utf8')
        .then((texto) => JSON.parse(texto) as { sucesso: boolean })
        .catch(() => null);
      if (resultado) break;
      if (Date.now() - inicio > PRAZO_PARA_PEGAR_PEDIDO_MS && (await existe(join(dir, 'pedido.json')))) break;
      await esperar(500);
    }

    if (!resultado) {
      // Ninguém pegou (ou terminou) o pedido: o motor está parado. Tira o
      // pedido da fila para ele não compilar uma versão velha mais tarde.
      await rm(join(dir, 'pedido.json'), { force: true });
      return {
        sucesso: false,
        log: 'O motor de geração de PDF não respondeu. Verifique se o serviço "pandoc" está rodando (docker compose up -d pandoc).',
      };
    }

    const log = await readFile(join(dir, 'laudo.log'), 'utf8').catch(() => '');
    const sucesso = resultado.sucesso && (await existe(join(dir, 'laudo.pdf')));

    return { sucesso, log: sucesso ? log : log.trim() || 'Falha desconhecida ao compilar o laudo.' };
  }

  caminhoPdf(documentoId: string): string {
    return join(laudoWorkdir(), documentoId, 'laudo.pdf');
  }
}
