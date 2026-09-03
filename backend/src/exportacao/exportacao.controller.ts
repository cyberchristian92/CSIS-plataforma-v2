import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Res } from '@nestjs/common';
import type { Response } from 'express';
import { ZipArchive } from 'archiver';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ExportacaoService } from './exportacao.service';

function nomeArquivoSeguro(nome: string): string {
  const codigoInicio = 0x0300;
  const codigoFim = 0x036f;
  const semAcentos = Array.from(nome.normalize('NFD'))
    .filter((ch) => {
      const codigo = ch.codePointAt(0) ?? 0;
      return codigo < codigoInicio || codigo > codigoFim;
    })
    .join('');
  return semAcentos.replace(/[^a-zA-Z0-9-_]/g, '_');
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ExportacaoController {
  constructor(private readonly exportacaoService: ExportacaoService) {}

  @Get('projetos/:id/exportar')
  async exportar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const { manifesto, relatorioMd, arquivosParaZip } = await this.exportacaoService.exportarProjeto(id, user.id);

    const nomeZip = `projeto-${nomeArquivoSeguro(manifesto.projeto.nome)}.zip`;
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${nomeZip}"`,
    });

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (err) => {
      throw err;
    });
    archive.pipe(res);

    archive.append(JSON.stringify(manifesto, null, 2), { name: 'manifesto.json' });
    archive.append(relatorioMd, { name: 'relatorio.md' });

    for (const arquivo of arquivosParaZip) {
      archive.file(arquivo.caminhoNoDisco, { name: arquivo.caminhoNoZip });
    }

    await archive.finalize();
  }
}
