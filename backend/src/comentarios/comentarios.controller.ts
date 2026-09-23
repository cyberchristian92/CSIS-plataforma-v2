import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ComentariosService } from './comentarios.service';
import { CreateComentarioDto } from './dto/create-comentario.dto';
import { EscopoGuard, EscopoParam } from '../acesso/escopo.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, EscopoGuard)
export class ComentariosController {
  constructor(private readonly comentariosService: ComentariosService) {}

  @Post('missoes/:missaoId/comentarios')
  @EscopoParam('missao', 'missaoId')
  criar(
    @Param('missaoId') missaoId: string,
    @Body() dto: CreateComentarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.comentariosService.criar(missaoId, dto, user.id);
  }

  @Get('missoes/:missaoId/comentarios')
  @EscopoParam('missao', 'missaoId')
  listarPorMissao(@Param('missaoId') missaoId: string) {
    return this.comentariosService.listarPorMissao(missaoId);
  }

  @Delete('comentarios/:id')
  @EscopoParam('comentario')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.comentariosService.remover(id, user.id, user.papel_global);
  }
}
