import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ProjetosService } from './projetos.service';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { UpdateProjetoDto } from './dto/update-projeto.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjetosController {
  constructor(private readonly projetosService: ProjetosService) {}

  @Post('areas/:areaId/projetos')
  @Roles('ADMIN', 'LIDER')
  criar(@Param('areaId') areaId: string, @Body() dto: CreateProjetoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projetosService.criar(areaId, dto, user.id);
  }

  @Get('areas/:areaId/projetos')
  listarPorArea(@Param('areaId') areaId: string) {
    return this.projetosService.listarPorArea(areaId);
  }

  @Get('projetos/:id')
  buscar(@Param('id') id: string) {
    return this.projetosService.buscar(id);
  }

  @Patch('projetos/:id')
  @Roles('ADMIN', 'LIDER')
  atualizar(@Param('id') id: string, @Body() dto: UpdateProjetoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projetosService.atualizar(id, dto, user.id);
  }

  @Delete('projetos/:id')
  @Roles('ADMIN', 'LIDER')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projetosService.remover(id, user.id);
  }
}
