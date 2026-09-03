import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { RevisoesService } from './revisoes.service';
import { CreateRevisaoDto } from './dto/create-revisao.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RevisoesController {
  constructor(private readonly revisoesService: RevisoesService) {}

  @Post('entregas/:entregaId/revisoes')
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  criar(@Param('entregaId') entregaId: string, @Body() dto: CreateRevisaoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.revisoesService.criar(entregaId, dto, user.id);
  }

  @Get('entregas/:entregaId/revisoes')
  listarPorEntrega(@Param('entregaId') entregaId: string) {
    return this.revisoesService.listarPorEntrega(entregaId);
  }
}
