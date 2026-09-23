import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { MissoesService } from './missoes.service';
import { CreateMissaoDto } from './dto/create-missao.dto';
import { UpdateMissaoDto } from './dto/update-missao.dto';
import { AtribuirMissaoDto } from './dto/atribuir-missao.dto';
import { MoverMissaoDto } from './dto/mover-missao.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MissoesController {
  constructor(private readonly missoesService: MissoesService) {}

  @Post('projetos/:projetoId/missoes')
  @Roles('ADMIN', 'LIDER')
  criar(@Param('projetoId') projetoId: string, @Body() dto: CreateMissaoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.criar(projetoId, dto, user.id);
  }

  @Get('projetos/:projetoId/missoes')
  listarPorProjeto(@Param('projetoId') projetoId: string) {
    return this.missoesService.listarPorProjeto(projetoId);
  }

  @Get('missoes/minhas')
  listarMinhas(@CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.listarPorResponsavel(user.id);
  }

  @Get('missoes/em-revisao')
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  listarEmRevisao() {
    return this.missoesService.listarEmRevisao();
  }

  @Get('missoes/:id')
  buscar(@Param('id') id: string) {
    return this.missoesService.buscar(id);
  }

  @Patch('missoes/:id')
  @Roles('ADMIN', 'LIDER')
  atualizar(@Param('id') id: string, @Body() dto: UpdateMissaoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.atualizar(id, dto, user.id);
  }

  @Patch('missoes/:id/atribuir')
  @Roles('ADMIN', 'LIDER')
  atribuir(@Param('id') id: string, @Body() dto: AtribuirMissaoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.atribuir(id, dto.responsavelIds, user.id);
  }

  /// Drag-and-drop livre do board Kanban: qualquer usuário autenticado pode
  /// reorganizar o board (sem checagem de papel ou de regra de negócio) — ver
  /// nota em `MissoesService.mover`.
  @Patch('missoes/:id/mover')
  mover(@Param('id') id: string, @Body() dto: MoverMissaoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.mover(id, dto.colunaId ?? null, dto.ordem, user.id);
  }

  /// Capa e labels são metadado organizacional do board, mesma filosofia de
  /// `tags`: qualquer usuário autenticado pode editar.
  @Patch('missoes/:id/capa')
  atualizarCapa(@Param('id') id: string, @Body('corCapa') corCapa: string | null, @CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.atualizarCapa(id, corCapa ?? null, user.id);
  }

  @Patch('missoes/:id/labels')
  atualizarLabels(@Param('id') id: string, @Body('labelIds') labelIds: string[], @CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.atualizarLabels(id, labelIds ?? [], user.id);
  }

  @Patch('missoes/:id/iniciar')
  iniciar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.iniciar(id, user.id, user.papel_global);
  }

  /// Tags são metadado colaborativo — qualquer usuário autenticado pode
  /// editar, sem restrição de papel (mitiga a baixa autonomia do colaborador
  /// para mudar o status da missão, dando espaço pra ele organizar/detalhar).
  @Patch('missoes/:id/tags')
  atualizarTags(@Param('id') id: string, @Body('tags') tags: string[], @CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.atualizarTags(id, tags ?? [], user.id);
  }

  @Delete('missoes/:id')
  @Roles('ADMIN', 'LIDER')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.missoesService.remover(id, user.id);
  }
}
