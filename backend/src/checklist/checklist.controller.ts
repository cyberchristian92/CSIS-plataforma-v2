import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ChecklistService } from './checklist.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post('missoes/:missaoId/checklist')
  criar(@Param('missaoId') missaoId: string, @Body() dto: CreateChecklistItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.checklistService.criar(missaoId, dto, user.id);
  }

  @Get('missoes/:missaoId/checklist')
  listarPorMissao(@Param('missaoId') missaoId: string) {
    return this.checklistService.listarPorMissao(missaoId);
  }

  @Patch('checklist/:id')
  atualizar(@Param('id') id: string, @Body() dto: UpdateChecklistItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.checklistService.atualizar(id, dto, user.id);
  }

  @Delete('checklist/:id')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.checklistService.remover(id, user.id);
  }
}
