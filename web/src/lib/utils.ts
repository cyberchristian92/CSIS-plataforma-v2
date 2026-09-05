import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// O modelo Documento não tem campo de título (ver backend/prisma/schema.prisma
// — só `conteudo`) — o nome exibido é derivado do primeiro heading/linha do
// markdown, do jeito que o Flutter original também fazia.
export function extractTitle(conteudo: string, fallback = "Sem título"): string {
  const primeiraLinha = conteudo
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!primeiraLinha) return fallback;
  return primeiraLinha.replace(/^#+\s*/, "").slice(0, 60) || fallback;
}

export function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
