import type { ISODate, YearMonth } from "../state/types";

export const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function dateToISO(date: Date): ISODate {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO(): ISODate {
  return dateToISO(new Date());
}

export function parseISODate(iso: ISODate): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function ymFromISO(iso: ISODate): YearMonth {
  return iso.slice(0, 7);
}

export function ymFromDate(date: Date): YearMonth {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function currentYM(): YearMonth {
  return ymFromDate(new Date());
}

export function splitYM(ym: YearMonth): { year: number; monthIndex: number } {
  return {
    year: Number(ym.slice(0, 4)),
    monthIndex: Math.max(0, Math.min(11, Number(ym.slice(5, 7)) - 1)),
  };
}

export function makeYM(year: number, monthIndex: number): YearMonth {
  const d = new Date(year, monthIndex, 1);
  return ymFromDate(d);
}

export function addMonthsYM(ym: YearMonth, delta: number): YearMonth {
  const { year, monthIndex } = splitYM(ym);
  return ymFromDate(new Date(year, monthIndex + delta, 1));
}

export function addMonthsISO(iso: ISODate, delta: number): ISODate {
  const date = parseISODate(iso);
  return dateToISO(new Date(date.getFullYear(), date.getMonth() + delta, date.getDate()));
}

export function monthName(ym: YearMonth, style: "long" | "short" = "long") {
  const { monthIndex } = splitYM(ym);
  const name = style === "long" ? MONTHS_LONG[monthIndex] : MONTHS_SHORT[monthIndex];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function monthLabel(ym: YearMonth, style: "long" | "short" = "long") {
  return `${monthName(ym, style)} ${splitYM(ym).year}`;
}

export function yearMonths(year: number): YearMonth[] {
  return Array.from({ length: 12 }, (_, index) => makeYM(year, index));
}

export function formatDate(iso: ISODate, style: "short" | "long" = "short") {
  const date = parseISODate(iso);
  const day = pad2(date.getDate());
  const month = MONTHS_SHORT[date.getMonth()];
  if (style === "short") return `${day} ${month}`;
  return `${day} de ${MONTHS_LONG[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatWeekday(iso: ISODate) {
  return WEEKDAYS[parseISODate(iso).getDay()];
}

export function dueDateForMonth(ym: YearMonth, dueDay: number): ISODate {
  const { year, monthIndex } = splitYM(ym);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return dateToISO(new Date(year, monthIndex, Math.min(Math.max(1, dueDay), lastDay)));
}

export function invoiceMonthForDate(iso: ISODate, closingDay: number): YearMonth {
  const date = parseISODate(iso);
  const base = ymFromDate(date);
  return date.getDate() > closingDay ? addMonthsYM(base, 1) : base;
}

export function nextInvoiceYM(closingDay: number, today = new Date()): YearMonth {
  const base = ymFromDate(today);
  return today.getDate() > closingDay ? addMonthsYM(base, 1) : base;
}

export function daysUntil(iso: ISODate, from = new Date()): number {
  const target = parseISODate(iso);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export function dueLabel(iso: ISODate): string {
  const days = daysUntil(iso);
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days > 1) return `vence em ${days} dias`;
  if (days === -1) return "venceu ontem";
  return `venceu há ${Math.abs(days)} dias`;
}

export function longToday() {
  const date = new Date();
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`;
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
