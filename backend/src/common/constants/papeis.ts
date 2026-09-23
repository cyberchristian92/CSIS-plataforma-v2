export const PAPEIS = ['ADMIN', 'LIDER', 'REVISOR', 'COLABORADOR'] as const;

export type Papel = (typeof PAPEIS)[number];

/// Nome de cada papel como aparece para as pessoas (TCC: Administrador,
/// Coordenador, Revisor, Especialista).
export const NOME_PAPEL: Record<Papel, string> = {
  ADMIN: 'Administrador',
  LIDER: 'Coordenador',
  REVISOR: 'Revisor',
  COLABORADOR: 'Especialista',
};
