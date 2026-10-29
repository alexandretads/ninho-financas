import type { MoneyCents } from "../state/types";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function formatBRL(cents: MoneyCents): string {
  return brl.format((Number(cents) || 0) / 100);
}

export function formatBRLCompact(cents: MoneyCents): string {
  const value = (Number(cents) || 0) / 100;
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (Math.abs(value) >= 10_000) return `R$ ${(value / 1_000).toFixed(0)} mil`;
  return formatBRL(cents);
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function centsToInput(cents: MoneyCents): string {
  return ((Number(cents) || 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseMoneyToCents(raw: string): number {
  if (!raw.trim()) return 0;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  } else if (hasDot) {
    const decimals = cleaned.split(".").pop() ?? "";
    if (decimals.length === 3) normalized = cleaned.replace(/\./g, "");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}
