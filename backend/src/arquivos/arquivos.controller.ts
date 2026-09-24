import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UnsupportedMediaTypeException,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ArquivosService } from './arquivos.service';
import { RenameArquivoDto } from './dto/rename-arquivo.dto';
import { Escopo, EscopoGuard, EscopoParam } from '../acesso/escopo.guard';
import {
  opcoesUploadEmDisco,
  tipoSeguroParaVisualizar,
} from './utils/armazenamento';

const QUERY_PASTA = {
  tipo: 'pasta',
  campo: 'pastaId',
  origem: 'query',
} as const;
const QUERY_MISSAO = {
  tipo: 'missao',
  campo: 'missaoId',
  origem: 'query',
} as const;

function exigirArquivo(
  file: Express.Multer.File | undefined,
): Express.Multer.File {
  if (!file)
    throw new BadRequestException('Nenhum arquivo enviado (campo "arquivo").');
  return file;
}

function semRaiz(pastaId: string | undefined): string | undefined {
  return pastaId === 'raiz' ? undefined : pastaId;
}

// Guards (inclusive o EscopoGuard) rodam ANTES do interceptor de upload —
// quem não tem acesso é recusado antes de qualquer byte ir para o disco.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, EscopoGuard)
export class ArquivosController {
  constructor(private readonly arquivosService: ArquivosService) {}

  @Post('projetos/:projetoId/arquivos')
  @Escopo({ tipo: 'projeto', campo: 'projetoId' }, QUERY_PASTA, QUERY_MISSAO)
  @UseInterceptors(FileInterceptor('arquivo', opcoesUploadEmDisco()))
  enviar(
    @Param('projetoId') projetoId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('entregaId') entregaId: string | undefined,
    @Query('missaoId') missaoId: string | undefined,
    @Query('pastaId') pastaId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.arquivosService.enviar(
      { projeto_id: projetoId },
      exigirArquivo(file),
      user,
      {
        entregaId,
        missaoId,
        pastaId: semRaiz(pastaId),
      },
    );
  }

  @Get('projetos/:projetoId/arquivos')
  @Escopo({ tipo: 'projeto', campo: 'projetoId' }, QUERY_PASTA, QUERY_MISSAO)
  listarPorProjeto(
    @Param('projetoId') projetoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('missaoId') missaoId?: string,
    @Query('pastaId') pastaId?: string,
  ) {
    return this.arquivosService.listar({ projeto_id: projetoId }, user, {
      missaoId,
      pastaId,
    });
  }

  @Post('workspaces/:workspaceId/arquivos')
  @Roles('ADMIN', 'LIDER')
  @Escopo({ tipo: 'workspace', campo: 'workspaceId' }, QUERY_PASTA)
  @UseInterceptors(FileInterceptor('arquivo', opcoesUploadEmDisco()))
  enviarEmWorkspace(
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('pastaId') pastaId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.arquivosService.enviar(
      { workspace_id: workspaceId },
      exigirArquivo(file),
      user,
      {
        pastaId: semRaiz(pastaId),
      },
    );
  }

  @Get('workspaces/:workspaceId/arquivos')
  @Escopo({ tipo: 'workspace', campo: 'workspaceId' }, QUERY_PASTA)
  listarPorWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('pastaId') pastaId?: string,
  ) {
    return this.arquivosService.listar({ workspace_id: workspaceId }, user, {
      pastaId,
    });
  }

  @Post('areas/:areaId/arquivos')
  @Roles('ADMIN', 'LIDER')
  @Escopo({ tipo: 'area', campo: 'areaId' }, QUERY_PASTA)
  @UseInterceptors(FileInterceptor('arquivo', opcoesUploadEmDisco()))
  enviarEmArea(
    @Param('areaId') areaId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('pastaId') pastaId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.arquivosService.enviar(
      { area_id: areaId },
      exigirArquivo(file),
      user,
      { pastaId: semRaiz(pastaId) },
    );
  }

  @Get('areas/:areaId/arquivos')
  @Escopo({ tipo: 'area', campo: 'areaId' }, QUERY_PASTA)
  listarPorArea(
    @Param('areaId') areaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('pastaId') pastaId?: string,
  ) {
    return this.arquivosService.listar({ area_id: areaId }, user, { pastaId });
  }

  @Get('arquivos/:id')
  @EscopoParam('arquivo')
  buscar(@Param('id') id: string) {
    return this.arquivosService.buscar(id);
  }

  @Get('arquivos/:id/verificar')
  @EscopoParam('arquivo')
  verificarIntegridade(@Param('id') id: string) {
    return this.arquivosService.verificarIntegridade(id);
  }

  @Get('arquivos/:id/download')
  @EscopoParam('arquivo')
  async download(
    @Param('id') id: string,
    @Query('inline') inline: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const visualizar = inline === '1' || inline === 'true';
    // Arquivo enviado por usuário aberto no mesmo domínio da plataforma pode
    // carregar código (HTML/SVG com script). Inline só para tipos que o
    // navegador exibe sem executar nada; o resto só baixa, como anexo.
    const tipoInline = visualizar
      ? tipoSeguroParaVisualizar(await this.arquivosService.buscar(id))
      : null;
    if (visualizar && !tipoInline) {
      throw new UnsupportedMediaTypeException(
        'Este tipo de arquivo não pode ser visualizado aqui — baixe-o.',
      );
    }
    const arquivo = await this.arquivosService.prepararDownload(
      id,
      user.id,
      visualizar,
    );
    const nomeAscii = arquivo.nome.replace(/[^\x20-\x7e]|"/g, '_');
    res.set({
      'Content-Type': tipoInline ?? 'application/octet-stream',
      'Content-Disposition': `${visualizar ? 'inline' : 'attachment'}; filename="${nomeAscii}"; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
      'X-Hash-Sha256': arquivo.hash_sha256,
      'X-Content-Type-Options': 'nosniff',
      // Sandbox isola o conteúdo do domínio da plataforma. Exceção: PDF
      // inline — o sandbox impede o visualizador do Chrome, que já roda o PDF
      // isolado da página por conta própria.
      ...(tipoInline === 'application/pdf'
        ? {}
        : {
            'Content-Security-Policy':
              "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
          }),
      'Access-Control-Expose-Headers': 'X-Hash-Sha256, Content-Disposition',
    });
    res.sendFile(arquivo.caminho);
  }

  @Get('arquivos/:id/historico')
  @EscopoParam('arquivo')
  historico(@Param('id') id: string) {
    return this.arquivosService.historico(id);
  }

  @Patch('arquivos/:id')
  @EscopoParam('arquivo')
  renomear(
    @Param('id') id: string,
    @Body() dto: RenameArquivoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.arquivosService.renomear(id, dto.nome, user.id);
  }

  @Delete('arquivos/:id')
  @EscopoParam('arquivo')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.arquivosService.remover(id, user);
  }
}
