export const PAPEIS = ['ADMIN', 'LIDER', 'REVISOR', 'COLABORADOR'] as const;

export type Papel = (typeof PAPEIS)[number];
