import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PastasService } from './pastas.service';
import { CreatePastaDto } from './dto/create-pasta.dto';
import { UpdatePastaDto } from './dto/update-pasta.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PastasController {
  constructor(private readonly pastasService: PastasService) {}

  @Post('projetos/:projetoId/pastas')
  criar(@Param('projetoId') projetoId: string, @Body() dto: CreatePastaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pastasService.criar(projetoId, dto, user.id);
  }

  @Get('projetos/:projetoId/pastas')
  listarPorProjeto(@Param('projetoId') projetoId: string, @Query('pastaPaiId') pastaPaiId?: string) {
    return this.pastasService.listarPorProjeto(projetoId, pastaPaiId);
  }

  // Pastas de "Recursos" (Workspace) e de Área — só Admin/Líder podem criar,
  // são ativos organizacionais, não conteúdo de trabalho de qualquer membro.
  @Post('workspaces/:workspaceId/pastas')
  @Roles('ADMIN', 'LIDER')
  criarEmWorkspace(@Param('workspaceId') workspaceId: string, @Body() dto: CreatePastaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pastasService.criarEmWorkspace(workspaceId, dto, user.id);
  }

  @Get('workspaces/:workspaceId/pastas')
  listarPorWorkspace(@Param('workspaceId') workspaceId: string, @Query('pastaPaiId') pastaPaiId?: string) {
    return this.pastasService.listarPorWorkspace(workspaceId, pastaPaiId);
  }

  @Post('areas/:areaId/pastas')
  @Roles('ADMIN', 'LIDER')
  criarEmArea(@Param('areaId') areaId: string, @Body() dto: CreatePastaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pastasService.criarEmArea(areaId, dto, user.id);
  }

  @Get('areas/:areaId/pastas')
  listarPorArea(@Param('areaId') areaId: string, @Query('pastaPaiId') pastaPaiId?: string) {
    return this.pastasService.listarPorArea(areaId, pastaPaiId);
  }

  @Patch('pastas/:id')
  atualizar(@Param('id') id: string, @Body() dto: UpdatePastaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pastasService.atualizar(id, dto, user.id);
  }

  @Delete('pastas/:id')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pastasService.remover(id, user.id);
  }
}
