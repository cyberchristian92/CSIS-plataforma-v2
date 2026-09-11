import { BadRequestException, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Res, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ZipArchive } from 'archiver';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
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
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportacaoController {
  constructor(private readonly exportacaoService: ExportacaoService) {}

  @Get('projetos/:id/exportar')
  async exportar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const { manifesto, relatorioMd, guiaSincronizacaoMd, arquivosParaZip } = await this.exportacaoService.exportarProjeto(id, user.id);

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
    archive.append(guiaSincronizacaoMd, { name: 'COMO_SINCRONIZAR.md' });

    for (const arquivo of arquivosParaZip) {
      archive.file(arquivo.caminhoNoDisco, { name: arquivo.caminhoNoZip });
    }

    await archive.finalize();
  }

  @Post('projetos/:id/sincronizar')
  @Roles('ADMIN', 'LIDER')
  @UseInterceptors(FileInterceptor('pacote', { storage: memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } }))
  sincronizar(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    if (!file) {
      throw new BadRequestException('Nenhum pacote enviado (campo "pacote").');
    }
    return this.exportacaoService.sincronizarLocal(id, file.buffer, user.id);
  }
}
