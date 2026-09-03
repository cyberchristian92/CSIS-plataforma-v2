import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ColunasService } from './colunas.service';
import { CreateColunaDto } from './dto/create-coluna.dto';
import { UpdateColunaDto } from './dto/update-coluna.dto';
import { ReorderColunasDto } from './dto/reorder-colunas.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ColunasController {
  constructor(private readonly colunasService: ColunasService) {}

  @Post('projetos/:projetoId/colunas')
  criar(@Param('projetoId') projetoId: string, @Body() dto: CreateColunaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.colunasService.criar(projetoId, dto, user.id);
  }

  @Get('projetos/:projetoId/colunas')
  listarPorProjeto(@Param('projetoId') projetoId: string) {
    return this.colunasService.listarPorProjeto(projetoId);
  }

  @Patch('projetos/:projetoId/colunas/reordenar')
  reordenar(@Param('projetoId') projetoId: string, @Body() dto: ReorderColunasDto, @CurrentUser() user: AuthenticatedUser) {
    return this.colunasService.reordenar(projetoId, dto, user.id);
  }

  @Patch('colunas/:id')
  atualizar(@Param('id') id: string, @Body() dto: UpdateColunaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.colunasService.atualizar(id, dto, user.id);
  }

  @Delete('colunas/:id')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.colunasService.remover(id, user.id);
  }
}
