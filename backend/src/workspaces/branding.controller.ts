import { Controller, Get } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';

// Único endpoint de Workspace acessível sem login — a tela de Login precisa
// mostrar o nome/logo configurados em Configurações (white-label) antes de
// qualquer autenticação existir. Expõe só o mínimo não-sensível.
@Controller('branding')
export class BrandingController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  async obter() {
    const workspaces = await this.workspacesService.listar();
    const atual = workspaces[0];
    return { nome: atual?.nome ?? null, logo_data_url: atual?.logo_data_url ?? null };
  }
}
