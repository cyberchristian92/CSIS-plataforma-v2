import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Controller('workspaces')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @Roles('ADMIN', 'LIDER')
  criar(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.criar(dto, user.id);
  }

  @Get()
  listar() {
    return this.workspacesService.listar();
  }

  @Get(':id')
  buscar(@Param('id') id: string) {
    return this.workspacesService.buscar(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'LIDER')
  atualizar(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.atualizar(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remover(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.remover(id, user.id);
  }
}
