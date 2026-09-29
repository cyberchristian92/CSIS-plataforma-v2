import { IsIn } from 'class-validator';

/// Quadro livre de Minhas Missões: qualquer coluna vale (como no Trello). Os
/// passos formais — entrega e revisão — continuam existindo, mas não são
/// obrigatórios; todo movimento fica na auditoria.
export const STATUS_LIVRES = [
  'PENDENTE',
  'EM_ANDAMENTO',
  'EM_REVISAO',
  'APROVADA',
] as const;

export class MudarStatusDto {
  @IsIn(STATUS_LIVRES)
  status: (typeof STATUS_LIVRES)[number];
}
