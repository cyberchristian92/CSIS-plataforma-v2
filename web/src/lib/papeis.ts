import type { PapelGlobal } from "./types";

/// Nome de cada papel como aparece para as pessoas (TCC: Administrador,
/// Coordenador, Revisor, Especialista). O código (LIDER, COLABORADOR...) fica
/// só na API.
export const NOME_PAPEL: Record<PapelGlobal, string> = {
  ADMIN: "Administrador",
  LIDER: "Coordenador",
  REVISOR: "Revisor",
  COLABORADOR: "Especialista",
};
