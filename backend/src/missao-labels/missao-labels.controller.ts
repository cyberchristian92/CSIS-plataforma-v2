import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { MissaoLabelsService } from './missao-labels.service';
import { CreateMissaoLabelDto } from './dto/create-missao-label.dto';
import { UpdateMissaoLabelDto } from './dto/update-missao-label.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MissaoLabelsController {
  constructor(private readonly missaoLabelsService: MissaoLabelsService) {}

  @Post('projetos/:projetoId/labels')
  criar(@Param('projetoId') projetoId: string, @Body() dto: CreateMissaoLabelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.missaoLabelsService.criar(projetoId, dto, user.id);
  }

  @Get('projetos/:projetoId/labels')
  listarPorProjeto(@Param('projetoId') projetoId: string) {
    return this.missaoLabelsService.listarPorProjeto(projetoId);
  }

  @Patch('labels/:id')
  atualizar(@Param('id') id: string, @Body() dto: UpdateMissaoLabelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.missaoLabelsService.atualizar(id, dto, user.id);
  }

  @Delete('labels/:id')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.missaoLabelsService.remover(id, user.id);
  }
}
