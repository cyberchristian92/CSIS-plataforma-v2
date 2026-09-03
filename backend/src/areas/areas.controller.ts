import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Post('workspaces/:workspaceId/areas')
  @Roles('ADMIN', 'LIDER')
  criar(@Param('workspaceId') workspaceId: string, @Body() dto: CreateAreaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.areasService.criar(workspaceId, dto, user.id);
  }

  @Get('workspaces/:workspaceId/areas')
  listarPorWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.areasService.listarPorWorkspace(workspaceId);
  }

  @Get('areas/:id')
  buscar(@Param('id') id: string) {
    return this.areasService.buscar(id);
  }

  @Patch('areas/:id')
  @Roles('ADMIN', 'LIDER')
  atualizar(@Param('id') id: string, @Body() dto: UpdateAreaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.areasService.atualizar(id, dto, user.id);
  }

  @Delete('areas/:id')
  @Roles('ADMIN', 'LIDER')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.areasService.remover(id, user.id);
  }
}
