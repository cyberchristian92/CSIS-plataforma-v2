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
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { EscopoGuard, EscopoParam } from '../acesso/escopo.guard';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, EscopoGuard)
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Post('workspaces/:workspaceId/areas')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('workspace', 'workspaceId')
  criar(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateAreaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.areasService.criar(workspaceId, dto, user.id);
  }

  @Get('workspaces/:workspaceId/areas')
  @EscopoParam('workspace', 'workspaceId')
  listarPorWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.areasService.listarPorWorkspace(
      workspaceId,
      user.id,
      user.papel_global,
    );
  }

  @Get('areas/:id')
  @EscopoParam('area')
  buscar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.areasService.buscar(id, user.id, user.papel_global);
  }

  @Patch('areas/:id')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('area')
  atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateAreaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.areasService.atualizar(id, dto, user.id);
  }

  @Delete('areas/:id')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam('area')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.areasService.remover(id, user.id);
  }
}
