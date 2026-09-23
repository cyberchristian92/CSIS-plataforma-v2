import type { PrismaClient } from '@prisma/client';

/// Nome que o software tem quando a empresa ainda não configurou o próprio.
export const NOME_PADRAO = 'CSIS';

/// Nome da instância (white-label): o nome do Workspace, editável pelo Admin
/// em Configurações. É o mesmo que a tela de login mostra (GET /branding) e
/// o que vai em todo e-mail — cada empresa que hospeda a plataforma aparece
/// com o próprio nome, nunca com "CSIS" fixo.
export async function nomeDaInstancia(
  prisma: Pick<PrismaClient, 'workspace'>,
): Promise<string> {
  const workspace = await prisma.workspace.findFirst({
    orderBy: { nome: 'asc' },
    select: { nome: true },
  });
  return workspace?.nome?.trim() || NOME_PADRAO;
}
