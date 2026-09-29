import { IsIn } from 'class-validator';

/// Destinos livres do quadro de Minhas Missões. Em Revisão e Aprovada não
/// entram aqui: chegam pela entrega e pela revisão (ou autoaprovação), que
/// guardam o que foi entregue e quem aprovou.
export const STATUS_LIVRES = ['PENDENTE', 'EM_ANDAMENTO'] as const;

export class MudarStatusDto {
  @IsIn(STATUS_LIVRES)
  status: (typeof STATUS_LIVRES)[number];
}
