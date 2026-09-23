import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DocumentosService } from './documentos.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { Escopo, EscopoGuard, EscopoParam } from '../acesso/escopo.guard';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, EscopoGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post('projetos/:projetoId/documentos')
  @EscopoParam('projeto', 'projetoId')
  criar(
    @Param('projetoId') projetoId: string,
    @Body() dto: CreateDocumentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentosService.criar(
      { projeto_id: projetoId },
      dto,
      user.id,
    );
  }

  @Get('projetos/:projetoId/documentos')
  @Escopo(
    { tipo: 'projeto', campo: 'projetoId' },
    { tipo: 'pasta', campo: 'pastaId', origem: 'query' },
    { tipo: 'missao', campo: 'missaoId', origem: 'query' },
  )
  listarPorProjeto(
    @Param('projetoId') projetoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('missaoId') missaoId?: string,
    @Query('pastaId') pastaId?: string,
  ) {
    return this.documentosService.listar({ projeto_id: projetoId }, user, {
      missaoId,
      pastaId,
    });
  }

  @Post('workspaces/:workspaceId/documentos')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('workspace', 'workspaceId')
  criarEmWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDocumentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentosService.criar(
      { workspace_id: workspaceId },
      dto,
      user.id,
    );
  }

  @Get('workspaces/:workspaceId/documentos')
  @Escopo(
    { tipo: 'workspace', campo: 'workspaceId' },
    { tipo: 'pasta', campo: 'pastaId', origem: 'query' },
  )
  listarPorWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('pastaId') pastaId?: string,
  ) {
    return this.documentosService.listar({ workspace_id: workspaceId }, user, {
      pastaId,
    });
  }

  @Post('areas/:areaId/documentos')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('area', 'areaId')
  criarEmArea(
    @Param('areaId') areaId: string,
    @Body() dto: CreateDocumentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentosService.criar({ area_id: areaId }, dto, user.id);
  }

  @Get('areas/:areaId/documentos')
  @Escopo(
    { tipo: 'area', campo: 'areaId' },
    { tipo: 'pasta', campo: 'pastaId', origem: 'query' },
  )
  listarPorArea(
    @Param('areaId') areaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('pastaId') pastaId?: string,
  ) {
    return this.documentosService.listar({ area_id: areaId }, user, {
      pastaId,
    });
  }

  @Get('documentos/:id')
  @EscopoParam('documento')
  buscar(@Param('id') id: string) {
    return this.documentosService.buscar(id);
  }

  @Patch('documentos/:id')
  @EscopoParam('documento')
  atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentosService.atualizar(id, dto, user);
  }

  @Delete('documentos/:id')
  @EscopoParam('documento')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentosService.remover(id, user);
  }
}
