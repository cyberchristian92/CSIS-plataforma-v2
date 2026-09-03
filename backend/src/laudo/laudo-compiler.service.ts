import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, access, rm, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

const execFileAsync = promisify(execFile);

const LAUDO_WORKDIR = process.env.LAUDO_WORKDIR ?? join(process.cwd(), 'laudo-workdir');
const PANDOC_CONTAINER = process.env.PANDOC_ENGINE_CONTAINER ?? 'csis_pandoc_engine';

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

  async compilar(documentoId: string, projetoId: string, conteudoMarkdown: string): Promise<ResultadoCompilacaoLaudo> {
    const dir = join(LAUDO_WORKDIR, documentoId);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });

    await this.materializarArquivosDoProjeto(projetoId, dir);
    await writeFile(join(dir, 'laudo.md'), conteudoMarkdown, 'utf8');

    let log = '';
    try {
      await execFileAsync(
        'docker',
        [
          'exec',
          '-w',
          `/work/${documentoId}`,
          PANDOC_CONTAINER,
          'pandoc',
          'laudo.md',
          '-o',
          'laudo.pdf',
          '--template',
          'eisvogel',
          '--pdf-engine=xelatex',
        ],
        { timeout: 120000 },
      );
    } catch (erro) {
      const { stderr, stdout, killed } = erro as { stderr?: string; stdout?: string; killed?: boolean };
      if (killed) {
        // execFileAsync mata o processo ao bater o timeout — nesse caso
        // stderr costuma vir vazio (o pandoc/xelatex nem chegou a escrever
        // nada), então a mensagem genérica do Node ("Command failed: ...")
        // sozinha não diz nada de útil pro usuário.
        log = 'A compilação demorou demais e foi cancelada (mais de 2 minutos) — tente novamente; se persistir, o container "csis_pandoc_engine" pode estar sobrecarregado ou travado.';
      } else {
        log = stderr?.trim() || stdout?.trim() || (erro as Error)?.message || 'Falha desconhecida ao compilar o laudo.';
      }
    }

    const sucesso = await access(join(dir, 'laudo.pdf'))
      .then(() => true)
      .catch(() => false);

    if (!sucesso && !log) {
      log = 'Não foi possível compilar: o motor de compilação (container Docker "csis_pandoc_engine") pode estar indisponível.';
    }

    return { sucesso, log };
  }

  caminhoPdf(documentoId: string): string {
    return join(LAUDO_WORKDIR, documentoId, 'laudo.pdf');
  }
}
