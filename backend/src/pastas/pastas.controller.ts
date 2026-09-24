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
import { PastasService } from './pastas.service';
import { CreatePastaDto } from './dto/create-pasta.dto';
import { UpdatePastaDto } from './dto/update-pasta.dto';
import { Escopo, EscopoGuard, EscopoParam } from '../acesso/escopo.guard';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, EscopoGuard)
export class PastasController {
  constructor(private readonly pastasService: PastasService) {}

  @Post('projetos/:projetoId/pastas')
  @EscopoParam('projeto', 'projetoId')
  criar(
    @Param('projetoId') projetoId: string,
    @Body() dto: CreatePastaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pastasService.criar({ projeto_id: projetoId }, dto, user);
  }

  @Get('projetos/:projetoId/pastas')
  @Escopo(
    { tipo: 'pasta', campo: 'pastaPaiId', origem: 'query' },
    { tipo: 'projeto', campo: 'projetoId' },
  )
  listarPorProjeto(
    @Param('projetoId') projetoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('pastaPaiId') pastaPaiId?: string,
    @Query('todas') todas?: string,
  ) {
    return this.pastasService.listar(
      { projeto_id: projetoId },
      user,
      pastaPaiId,
      todas === 'true',
    );
  }

  // Pastas de "Recursos" (Workspace) e de Área — só Admin/Líder podem criar,
  // são ativos organizacionais, não conteúdo de trabalho de qualquer membro.
  @Post('workspaces/:workspaceId/pastas')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('workspace', 'workspaceId')
  criarEmWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreatePastaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pastasService.criar({ workspace_id: workspaceId }, dto, user);
  }

  @Get('workspaces/:workspaceId/pastas')
  @Escopo(
    { tipo: 'pasta', campo: 'pastaPaiId', origem: 'query' },
    { tipo: 'workspace', campo: 'workspaceId' },
  )
  listarPorWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('pastaPaiId') pastaPaiId?: string,
    @Query('todas') todas?: string,
  ) {
    return this.pastasService.listar(
      { workspace_id: workspaceId },
      user,
      pastaPaiId,
      todas === 'true',
    );
  }

  @Post('areas/:areaId/pastas')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('area', 'areaId')
  criarEmArea(
    @Param('areaId') areaId: string,
    @Body() dto: CreatePastaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pastasService.criar({ area_id: areaId }, dto, user);
  }

  @Get('areas/:areaId/pastas')
  @Escopo(
    { tipo: 'pasta', campo: 'pastaPaiId', origem: 'query' },
    { tipo: 'area', campo: 'areaId' },
  )
  listarPorArea(
    @Param('areaId') areaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('pastaPaiId') pastaPaiId?: string,
    @Query('todas') todas?: string,
  ) {
    return this.pastasService.listar(
      { area_id: areaId },
      user,
      pastaPaiId,
      todas === 'true',
    );
  }

  @Patch('pastas/:id')
  @EscopoParam('pasta')
  atualizar(
    @Param('id') id: string,
    @Body() dto: UpdatePastaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pastasService.atualizar(id, dto, user);
  }

  @Delete('pastas/:id')
  @EscopoParam('pasta')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pastasService.remover(id, user);
  }
}
