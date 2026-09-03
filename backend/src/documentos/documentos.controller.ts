import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DocumentosService } from './documentos.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post('projetos/:projetoId/documentos')
  criar(@Param('projetoId') projetoId: string, @Body() dto: CreateDocumentoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentosService.criar(projetoId, dto, user.id);
  }

  @Get('projetos/:projetoId/documentos')
  listarPorProjeto(@Param('projetoId') projetoId: string, @Query('missaoId') missaoId?: string, @Query('pastaId') pastaId?: string) {
    return this.documentosService.listarPorProjeto(projetoId, missaoId, pastaId);
  }

  @Get('documentos/:id')
  buscar(@Param('id') id: string) {
    return this.documentosService.buscar(id);
  }

  @Patch('documentos/:id')
  atualizar(@Param('id') id: string, @Body() dto: UpdateDocumentoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentosService.atualizar(id, dto, user.id);
  }

  @Delete('documentos/:id')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentosService.remover(id, user.id);
  }
}
