import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { EntregasService } from './entregas.service';
import { CreateEntregaDto } from './dto/create-entrega.dto';
import { EscopoGuard, EscopoParam } from '../acesso/escopo.guard';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, EscopoGuard)
export class EntregasController {
  constructor(private readonly entregasService: EntregasService) {}

  @Post('missoes/:missaoId/entregas')
  @EscopoParam('missao', 'missaoId')
  criar(
    @Param('missaoId') missaoId: string,
    @Body() dto: CreateEntregaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entregasService.criar(missaoId, dto, user.id);
  }

  @Get('missoes/:missaoId/entregas')
  @EscopoParam('missao', 'missaoId')
  listarPorMissao(@Param('missaoId') missaoId: string) {
    return this.entregasService.listarPorMissao(missaoId);
  }

  @Get('entregas/:id')
  @EscopoParam('entrega')
  buscar(@Param('id') id: string) {
    return this.entregasService.buscar(id);
  }
}
