import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { EscopoService, TIPOS_ALVO, TipoAlvo } from './escopo.service';

export interface RegraEscopo {
  /// Tipo do recurso referenciado. `':tipo'` lê o tipo do próprio parâmetro
  /// de rota `tipo` (usado em /compartilhamento/:tipo/:id e /integridade/:tipo/:id).
  tipo: TipoAlvo | ':tipo';
  /// Nome do parâmetro de rota (`:id`, `:projetoId`...) ou, com `origem:
  /// 'query'`, da query string. Valores ausentes ou `"raiz"` são ignorados.
  campo: string;
  origem?: 'param' | 'query';
  /// Com `tipo: ':tipo'`, restringe quais tipos a rota aceita.
  tiposPermitidos?: readonly TipoAlvo[];
}

const ESCOPO_KEY = 'csis:escopo';

/// Declara quais recursos uma rota acessa — o EscopoGuard confere, para cada
/// um, se o usuário pode ver toda a cadeia (Área → Projeto → Pastas) acima
/// dele. Toda rota que recebe id de conteúdo precisa desta anotação.
export const Escopo = (...regras: RegraEscopo[]) =>
  SetMetadata(ESCOPO_KEY, regras);

/// Atalho para o caso mais comum: um parâmetro de rota.
export const EscopoParam = (
  tipo: RegraEscopo['tipo'],
  campo = 'id',
  tiposPermitidos?: readonly TipoAlvo[],
) => Escopo({ tipo, campo, tiposPermitidos });

@Injectable()
export class EscopoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly escopoService: EscopoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const regras = this.reflector.getAllAndOverride<RegraEscopo[] | undefined>(
      ESCOPO_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!regras || regras.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    for (const regra of regras) {
      const fonte = regra.origem === 'query' ? request.query : request.params;
      const valor: unknown = fonte[regra.campo];
      if (typeof valor !== 'string' || valor === '' || valor === 'raiz')
        continue;

      const tipo =
        regra.tipo === ':tipo' ? String(request.params.tipo) : regra.tipo;
      const permitidos: readonly string[] = regra.tiposPermitidos ?? TIPOS_ALVO;
      if (!permitidos.includes(tipo)) {
        throw new BadRequestException('Tipo de recurso inválido.');
      }
      await this.escopoService.assertPodeAcessar(
        request.user,
        tipo as TipoAlvo,
        valor,
      );
    }
    return true;
  }
}
