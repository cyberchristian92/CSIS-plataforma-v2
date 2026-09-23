import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ProjetosService } from './projetos.service';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { UpdateProjetoDto } from './dto/update-projeto.dto';
import { EscopoGuard, EscopoParam } from '../acesso/escopo.guard';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, EscopoGuard)
export class ProjetosController {
  constructor(private readonly projetosService: ProjetosService) {}

  @Post('areas/:areaId/projetos')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('area', 'areaId')
  criar(
    @Param('areaId') areaId: string,
    @Body() dto: CreateProjetoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projetosService.criar(areaId, dto, user.id);
  }

  @Get('areas/:areaId/projetos')
  @EscopoParam('area', 'areaId')
  listarPorArea(
    @Param('areaId') areaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projetosService.listarPorArea(
      areaId,
      user.id,
      user.papel_global,
    );
  }

  @Get('projetos/:id')
  @EscopoParam('projeto')
  buscar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projetosService.buscar(id, user);
  }

  @Patch('projetos/:id')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('projeto')
  atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateProjetoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projetosService.atualizar(id, dto, user.id);
  }

  @Delete('projetos/:id')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('projeto')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projetosService.remover(id, user.id);
  }
}
