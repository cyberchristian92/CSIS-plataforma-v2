import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  AcessoService,
  TIPOS_RESTRINGIVEIS,
  type TipoRecursoRestringivel,
} from './acesso.service';
import { EscopoGuard, EscopoParam } from './escopo.guard';
import { CreateListaDto } from './dto/create-lista.dto';
import { AddMembroDto } from './dto/add-membro.dto';
import { DefinirCompartilhamentoDto } from './dto/definir-compartilhamento.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, EscopoGuard)
export class AcessoController {
  constructor(private readonly acessoService: AcessoService) {}

  // Listas de Acesso — só ADMIN cria/edita (é gestão de quem-vê-o-quê, a
  // mesma responsabilidade de "ajustar permissões" descrita no TCC).
  @Post('workspaces/:workspaceId/listas')
  @Roles('ADMIN')
  criarLista(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateListaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acessoService.criarLista(workspaceId, dto.nome, user.id);
  }

  @Get('workspaces/:workspaceId/listas')
  @Roles('ADMIN')
  listarListas(@Param('workspaceId') workspaceId: string) {
    return this.acessoService.listarListasPorWorkspace(workspaceId);
  }

  @Patch('listas/:id')
  @Roles('ADMIN')
  renomearLista(
    @Param('id') id: string,
    @Body() dto: CreateListaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acessoService.renomearLista(id, dto.nome, user.id);
  }

  @Delete('listas/:id')
  @Roles('ADMIN')
  removerLista(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acessoService.removerLista(id, user.id);
  }

  @Post('listas/:id/membros')
  @Roles('ADMIN')
  adicionarMembro(
    @Param('id') id: string,
    @Body() dto: AddMembroDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acessoService.adicionarMembro(id, dto.userId, user.id);
  }

  @Delete('listas/:id/membros/:userId')
  @Roles('ADMIN')
  removerMembro(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acessoService.removerMembro(id, userId, user.id);
  }

  // Compartilhamento por recurso (Projeto/Área/Pasta) — ADMIN/LIDER, mesma
  // gente que já gerencia esses recursos hoje.
  // EscopoParam(':tipo'): quem altera a restrição precisa, antes, conseguir
  // ver o recurso — senão um Coordenador sem acesso a um projeto restrito
  // poderia simplesmente desmarcar `restrito` e passar a enxergá-lo.
  @Get('compartilhamento/:tipo/:id')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam(':tipo', 'id', ['projeto', 'area', 'pasta'])
  obterCompartilhamento(
    @Param('tipo', new ParseEnumPipe(TIPOS_RESTRINGIVEIS))
    tipo: TipoRecursoRestringivel,
    @Param('id') id: string,
  ) {
    return this.acessoService.obterCompartilhamento(tipo, id);
  }

  @Put('compartilhamento/:tipo/:id')
  @Roles('ADMIN', 'LIDER')
  @EscopoParam(':tipo', 'id', ['projeto', 'area', 'pasta'])
  definirCompartilhamento(
    @Param('tipo', new ParseEnumPipe(TIPOS_RESTRINGIVEIS))
    tipo: TipoRecursoRestringivel,
    @Param('id') id: string,
    @Body() dto: DefinirCompartilhamentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acessoService.definirCompartilhamento(tipo, id, dto, user.id);
  }
}
