import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ComentariosService } from './comentarios.service';
import { CreateComentarioDto } from './dto/create-comentario.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ComentariosController {
  constructor(private readonly comentariosService: ComentariosService) {}

  @Post('missoes/:missaoId/comentarios')
  criar(@Param('missaoId') missaoId: string, @Body() dto: CreateComentarioDto, @CurrentUser() user: AuthenticatedUser) {
    return this.comentariosService.criar(missaoId, dto, user.id);
  }

  @Get('missoes/:missaoId/comentarios')
  listarPorMissao(@Param('missaoId') missaoId: string) {
    return this.comentariosService.listarPorMissao(missaoId);
  }

  @Delete('comentarios/:id')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.comentariosService.remover(id, user.id, user.papel_global);
  }
}
