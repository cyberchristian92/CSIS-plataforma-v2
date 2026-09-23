export const STATUS_COLORS: Record<string, string> = {
  PENDENTE: "#64748B",
  EM_ANDAMENTO: "#49C3D1",
  EM_REVISAO: "#F59E0B",
  APROVADA: "#16A34A",
  REJEITADA: "#DC2626",
  ARQUIVADO: "#94A3B8",
};

export const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em Andamento",
  EM_REVISAO: "Em Revisão",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  ARQUIVADO: "Arquivado",
};

export const LABEL_PALETTE = [
  "#4BCE97",
  "#F5CD47",
  "#FAA53D",
  "#F87168",
  "#9F8FEF",
  "#579DFF",
  "#6CC3E0",
  "#94C748",
  "#E774BB",
  "#8590A2",
] as const;
