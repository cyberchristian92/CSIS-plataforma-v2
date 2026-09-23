import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { IntegridadeService } from './integridade.service';

const MODELOS = {
  workspace: 'workspace',
  area: 'area',
  projeto: 'projeto',
  missao: 'missao',
  pasta: 'pasta',
} as const;

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntegridadeController {
  constructor(
    private readonly integridadeService: IntegridadeService,
    private readonly prisma: PrismaService,
  ) {}

  /// Ação manual de admin — cobre tanto o populamento retroativo (dados que
  /// já existiam antes desta camada) quanto os pontos que ainda não emitem
  /// evento automaticamente (ver comentário em integridade.service.ts).
  @Post('integridade/recalcular-tudo')
  @Roles('ADMIN')
  recalcularTudo(@CurrentUser() user: AuthenticatedUser) {
    return this.integridadeService.recalcularTudo(user.id);
  }

  /// Consulta o CID atual de um nó da árvore — qualquer um dos tipos que
  /// carregam `ipfs_cid` no schema (ver prisma/schema.prisma).
  @Get('integridade/:tipo/:id')
  async consultar(@Param('tipo') tipo: keyof typeof MODELOS, @Param('id') id: string) {
    const modelo = MODELOS[tipo];
    if (!modelo) return { erro: 'Tipo inválido.' };
    const registro = await (this.prisma[modelo] as any).findUnique({ where: { id }, select: { id: true, ipfs_cid: true } });
    return registro ?? { erro: 'Não encontrado.' };
  }
}
