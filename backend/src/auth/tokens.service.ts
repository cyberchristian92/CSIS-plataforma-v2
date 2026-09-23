import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/// RECUPERACAO: esqueci a senha. CONVITE: criar a primeira senha.
/// CONFIRMACAO_EMAIL: confirmar o e-mail de um cadastro público.
export type TipoToken = 'RECUPERACAO' | 'CONVITE' | 'CONFIRMACAO_EMAIL';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/// Tokens de uso único enviados por link. Só o hash fica no banco (quem lê o
/// banco não consegue usar um link pendente), cada token só vale para o
/// próprio tipo, e emitir um novo invalida os anteriores do mesmo tipo.
@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  async emitir(
    userId: string,
    tipo: TipoToken,
    validadeMs: number,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      this.prisma.tokenRecuperacaoSenha.updateMany({
        where: { user_id: userId, tipo, usado_em: null },
        data: { usado_em: new Date() },
      }),
      this.prisma.tokenRecuperacaoSenha.create({
        data: {
          user_id: userId,
          tipo,
          token_hash: hashToken(token),
          expira_em: new Date(Date.now() + validadeMs),
        },
      }),
    ]);
    return token;
  }

  /// Confere sem gastar (ex.: mostrar nome/e-mail na tela de aceite).
  async consultar(token: string, tipo: TipoToken) {
    const registro = await this.prisma.tokenRecuperacaoSenha.findUnique({
      where: { token_hash: hashToken(token) },
    });
    if (
      !registro ||
      registro.tipo !== tipo ||
      registro.usado_em ||
      registro.expira_em <= new Date()
    ) {
      throw new UnauthorizedException('Link inválido ou expirado.');
    }
    return registro;
  }

  /// Gasta o token (uso único) e devolve o id do usuário.
  async consumir(token: string, tipo: TipoToken): Promise<string> {
    const registro = await this.consultar(token, tipo);
    const { count } = await this.prisma.tokenRecuperacaoSenha.updateMany({
      where: { id: registro.id, usado_em: null },
      data: { usado_em: new Date() },
    });
    // Duas requisições com o mesmo link ao mesmo tempo: só uma passa.
    if (count === 0)
      throw new UnauthorizedException('Link inválido ou expirado.');
    return registro.user_id;
  }
}
