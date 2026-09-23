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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ChecklistService } from './checklist.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { EscopoGuard, EscopoParam } from '../acesso/escopo.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, EscopoGuard)
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post('missoes/:missaoId/checklist')
  @EscopoParam('missao', 'missaoId')
  criar(
    @Param('missaoId') missaoId: string,
    @Body() dto: CreateChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checklistService.criar(missaoId, dto, user.id);
  }

  @Get('missoes/:missaoId/checklist')
  @EscopoParam('missao', 'missaoId')
  listarPorMissao(@Param('missaoId') missaoId: string) {
    return this.checklistService.listarPorMissao(missaoId);
  }

  @Patch('checklist/:id')
  @EscopoParam('checklist')
  atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checklistService.atualizar(id, dto, user.id);
  }

  @Delete('checklist/:id')
  @EscopoParam('checklist')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.checklistService.remover(id, user.id);
  }
}
