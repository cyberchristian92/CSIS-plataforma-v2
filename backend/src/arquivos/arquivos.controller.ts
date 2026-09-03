import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ArquivosService } from './arquivos.service';
import { RenameArquivoDto } from './dto/rename-arquivo.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArquivosController {
  constructor(private readonly arquivosService: ArquivosService) {}

  @Post('projetos/:projetoId/arquivos')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage() }))
  enviar(
    @Param('projetoId') projetoId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('entregaId') entregaId: string | undefined,
    @Query('missaoId') missaoId: string | undefined,
    @Query('pastaId') pastaId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado (campo "arquivo").');
    }
    return this.arquivosService.enviar(projetoId, file, user.id, entregaId, missaoId, pastaId === 'raiz' ? undefined : pastaId);
  }

  @Get('projetos/:projetoId/arquivos')
  listarPorProjeto(@Param('projetoId') projetoId: string, @Query('missaoId') missaoId?: string, @Query('pastaId') pastaId?: string) {
    return this.arquivosService.listarPorProjeto(projetoId, missaoId, pastaId);
  }

  @Get('arquivos/:id')
  buscar(@Param('id') id: string) {
    return this.arquivosService.buscar(id);
  }

  @Get('arquivos/:id/verificar')
  verificarIntegridade(@Param('id') id: string) {
    return this.arquivosService.verificarIntegridade(id);
  }

  @Patch('arquivos/:id')
  renomear(@Param('id') id: string, @Body() dto: RenameArquivoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.arquivosService.renomear(id, dto.nome, user.id);
  }
}
