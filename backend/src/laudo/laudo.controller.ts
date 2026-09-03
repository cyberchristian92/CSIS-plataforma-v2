import { Controller, Get, NotFoundException, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { access } from 'node:fs/promises';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { LaudoService } from './laudo.service';

@Controller('documentos/:id/laudo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaudoController {
  constructor(private readonly laudoService: LaudoService) {}

  @Post('compilar')
  compilar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.laudoService.compilar(id, user.id);
  }

  @Get('pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const caminho = await this.laudoService.caminhoPdf(id);
    try {
      await access(caminho);
    } catch {
      throw new NotFoundException('Este documento ainda não foi compilado com sucesso.');
    }
    res.set({ 'Content-Type': 'application/pdf' });
    res.sendFile(caminho);
  }
}
