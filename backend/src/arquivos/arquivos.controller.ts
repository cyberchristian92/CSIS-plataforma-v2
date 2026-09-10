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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
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

  @Post('workspaces/:workspaceId/arquivos')
  @Roles('ADMIN', 'LIDER')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage() }))
  enviarEmWorkspace(
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('pastaId') pastaId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado (campo "arquivo").');
    return this.arquivosService.enviarEmWorkspace(workspaceId, file, user.id, pastaId === 'raiz' ? undefined : pastaId);
  }

  @Get('workspaces/:workspaceId/arquivos')
  listarPorWorkspace(@Param('workspaceId') workspaceId: string, @Query('pastaId') pastaId?: string) {
    return this.arquivosService.listarPorWorkspace(workspaceId, pastaId);
  }

  @Post('areas/:areaId/arquivos')
  @Roles('ADMIN', 'LIDER')
  @UseInterceptors(FileInterceptor('arquivo', { storage: memoryStorage() }))
  enviarEmArea(
    @Param('areaId') areaId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('pastaId') pastaId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado (campo "arquivo").');
    return this.arquivosService.enviarEmArea(areaId, file, user.id, pastaId === 'raiz' ? undefined : pastaId);
  }

  @Get('areas/:areaId/arquivos')
  listarPorArea(@Param('areaId') areaId: string, @Query('pastaId') pastaId?: string) {
    return this.arquivosService.listarPorArea(areaId, pastaId);
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

  @Delete('arquivos/:id')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.arquivosService.remover(id, user.id);
  }
}
