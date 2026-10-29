import type { AppData, BudgetMonth, CardPurchase, Category, InvoicePayment, PaymentMethod, PlanItem, SalesState, Transaction } from "../state/types";
import { CATEGORIES, PAYMENT_METHODS } from "../state/types";
import { assertValidBackup, normalizeAppData } from "../state/store";
import { normalizeSalesState } from "./sales";

export const INVITE_PARAM = "convite";
export const INVITE_HASH_PREFIX = "#casa=";

/* -------------------------------------------------------------------------- */
/* Compressão LZW → bytes → base64url                                          */
/* -------------------------------------------------------------------------- */

function lzwEncodeBytes(text: string): number[] {
  const dictionary = new Map<string, number>();
  for (let index = 0; index < 256; index += 1) dictionary.set(String.fromCharCode(index), index);
  let nextCode = 256;
  let current = "";
  const output: number[] = [];

  for (const char of text) {
    const combined = current + char;
    if (dictionary.has(combined)) {
      current = combined;
    } else {
      if (current) output.push(dictionary.get(current) as number);
      dictionary.set(combined, nextCode);
      nextCode += 1;
      current = char;
    }
  }
  if (current) output.push(dictionary.get(current) as number);
  return output;
}

function lzwDecodeCodes(codes: number[]): string {
  if (!codes.length) return "";
  const dictionary: string[] = [];
  for (let index = 0; index < 256; index += 1) dictionary.push(String.fromCharCode(index));
  let current = dictionary[codes[0]];
  const output: string[] = [current];

  for (let index = 1; index < codes.length; index += 1) {
    const code = codes[index];
    const entry = dictionary[code] ?? `${current}${current[0] ?? ""}`;
    output.push(entry);
    dictionary.push(`${current}${entry[0] ?? ""}`);
    current = entry;
  }
  return output.join("");
}

function bytesToBase64Url(bytes: number[]): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): number[] {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes: number[] = [];
  for (let index = 0; index < binary.length; index += 1) bytes.push(binary.charCodeAt(index));
  return bytes;
}

function utf8ToBase64Url(text: string): string {
  const utf8 = new TextEncoder().encode(text);
  return bytesToBase64Url(Array.from(utf8));
}

function base64UrlToUtf8(value: string): string {
  return new TextDecoder().decode(Uint8Array.from(base64UrlToBytes(value)));
}

/** Codifica 2 bytes por código LZW (até 65535). */
function pack(text: string): string {
  const codes = lzwEncodeBytes(text);
  const bytes: number[] = [];
  for (const code of codes) {
    bytes.push(code & 0xff, (code >> 8) & 0xff);
  }
  return bytesToBase64Url(bytes);
}

function unpack(value: string): string {
  const bytes = base64UrlToBytes(value);
  const codes: number[] = [];
  for (let index = 0; index < bytes.length; index += 2) {
    codes.push(bytes[index] | ((bytes[index + 1] ?? 0) << 8));
  }
  return lzwDecodeCodes(codes);
}

/* -------------------------------------------------------------------------- */
/* Representação compacta                                                      */
/* -------------------------------------------------------------------------- */

type CompactTransaction = [
  string,
  number,
  string,
  "i" | "e",
  number,
  number,
  "p" | "o",
];

type CompactPurchase = [
  string,
  number,
  string,
  number,
  [number, number, number, string] | null,
];

type CompactPayment = [string, number, number, string, number, "paid" | "partial"];

type CompactPlanItem = [0 | 1, string, number, number, number, 0 | 1, 0 | 1];

type CompactPayload = {
  v: 1;
  n: string;
  p: [string, string];
  h: [string, string | null, 0 | 1];
  s: [
    number,
    number,
    number,
    [number, number, number, number, number],
    [0 | 1, number, number],
    [number, number, number, number],
  ];
  t: CompactTransaction[];
  c: CompactPurchase[];
  y: CompactPayment[];
  b: Array<{ y: number; m: CompactPlanItem[][] }>;
  a?: SalesState;
};

const CATEGORY_INDEX = new Map<Category, number>(CATEGORIES.map((category, index) => [category, index]));
const PAYMENT_INDEX = new Map<PaymentMethod, number>(PAYMENT_METHODS.map((method, index) => [method, index]));

function categoryAt(index: number): Category {
  return CATEGORIES[index] ?? "Outros";
}

function paymentAt(index: number): PaymentMethod {
  return PAYMENT_METHODS[index] ?? "Pix/Débito";
}

function stableSeed(createdAtISO: string, name: string) {
  const source = `${createdAtISO}|${name.replace(/\s+/g, "")}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash).toString(36);
}

function compactTransaction(transaction: Transaction): CompactTransaction {
  return [
    transaction.description,
    transaction.status === "Paid" ? transaction.amountCents : -transaction.amountCents,
    transaction.dateISO,
    transaction.type === "Income" ? "i" : "e",
    CATEGORY_INDEX.get(transaction.category) ?? 7,
    PAYMENT_INDEX.get(transaction.paymentMethod) ?? 0,
    transaction.status === "Paid" ? "p" : "o",
  ];
}

function compactPurchase(purchase: CardPurchase): CompactPurchase {
  return [
    purchase.description,
    purchase.amountCents,
    purchase.purchaseDateISO,
    CATEGORY_INDEX.get(purchase.category) ?? 7,
    purchase.installments
      ? [
          purchase.installments.totalCents,
          purchase.installments.parts,
          purchase.installments.currentPart,
          purchase.installments.firstInstallmentDateISO,
        ]
      : null,
  ];
}

function compactPayment(payment: InvoicePayment, txIndex: number): CompactPayment {
  return [payment.invoiceYM, payment.invoiceTotalCents, payment.amountPaidCents, payment.dateISO, txIndex, payment.status];
}

function compactPlanItem(item: PlanItem): CompactPlanItem {
  return [
    item.kind === "income" ? 1 : 0,
    item.name,
    item.amountCents,
    CATEGORY_INDEX.get(item.category) ?? 7,
    item.day,
    item.fixed ? 1 : 0,
    item.paid ? 1 : 0,
  ];
}

function compactPayload(data: AppData): CompactPayload {
  const txIndex = new Map(data.transactions.map((transaction, index) => [transaction.id, index]));
  return {
    v: 1,
    n: stableSeed(data.createdAtISO, data.profile.name),
    p: [data.profile.name, data.profile.email],
    h: [
      data.household?.partnerName ?? "",
      data.household?.inviteSentAtISO ?? null,
      data.household?.automaticSync === false ? 0 : 1,
    ],
    s: [
      data.cardSettings.limitTotalCents,
      data.cardSettings.closingDay,
      data.cardSettings.dueDay,
      [
        data.cardSettings.rates.rotativoMonthlyPercent,
        data.cardSettings.rates.billInstallmentMonthlyPercent,
        data.cardSettings.rates.lateMoraMonthlyPercent,
        data.cardSettings.rates.lateFinePercent,
        data.cardSettings.rates.cashAdvanceMonthlyPercent,
      ],
      [data.cardSettings.iof.enabled ? 1 : 0, data.cardSettings.iof.fixedPercent, data.cardSettings.iof.dailyPercent],
      [
        data.cardSettings.simulatorDefaults.prevRevolvingCents,
        data.cardSettings.simulatorDefaults.prevBillInstallmentCents,
        data.cardSettings.simulatorDefaults.otherChargesCents,
        data.cardSettings.simulatorDefaults.simulateDays,
      ],
    ],
    t: data.transactions.map(compactTransaction),
    c: data.cardPurchases.map(compactPurchase),
    y: data.invoicePayments.map((payment) => compactPayment(payment, txIndex.get(payment.transactionId) ?? -1)),
    b: data.budgetPlans.map((plan) => ({
      y: plan.year,
      m: plan.months.map((month) =>
        (month.items ?? []).map(compactPlanItem)
      ),
    })),
    a: data.sales,
  };
}

function expandPayload(raw: CompactPayload): AppData {
  const seed = raw.n || "casa";
  const now = new Date().toISOString();

  const transactions: Transaction[] = raw.t.map((item, index) => ({
    id: `tx_${seed}_${index}`,
    description: item[0],
    amountCents: Math.abs(item[1]),
    dateISO: item[2],
    type: item[3] === "i" ? "Income" : "Expense",
    category: categoryAt(item[4]),
    paymentMethod: paymentAt(item[5]),
    status: item[1] < 0 ? "Pending" : item[6] === "o" ? "Pending" : "Paid",
  }));

  const cardPurchases: CardPurchase[] = raw.c.map((item, index) => ({
    id: `buy_${seed}_${index}`,
    description: item[0],
    amountCents: item[1],
    purchaseDateISO: item[2],
    category: categoryAt(item[3]) === "Cartão" ? "Outros" : (categoryAt(item[3]) as Exclude<Category, "Cartão">),
    installments: item[4]
      ? {
          totalCents: item[4][0],
          parts: item[4][1],
          currentPart: item[4][2],
          firstInstallmentDateISO: item[4][3],
        }
      : undefined,
  }));

  const invoicePayments: InvoicePayment[] = raw.y.map((item, index) => ({
    id: `pay_${seed}_${index}`,
    invoiceYM: item[0],
    invoiceTotalCents: item[1],
    amountPaidCents: item[2],
    dateISO: item[3],
    transactionId: item[4] >= 0 ? `tx_${seed}_${item[4]}` : "",
    status: item[5],
  }));

  const budgetPlans = raw.b.map((plan) => ({
    year: plan.y,
    months: plan.m.map((items, monthIndex): BudgetMonth => {
      const expanded: PlanItem[] = items.map((item, itemIndex) => ({
        id: `plan_${seed}_${plan.y}_${monthIndex}_${itemIndex}`,
        kind: item[0] === 1 ? "income" : "expense",
        name: item[1],
        amountCents: item[2],
        category: categoryAt(item[3]),
        day: item[4],
        fixed: item[5] === 1,
        paid: item[6] === 1,
      }));
      const income: Record<string, number> = {};
      const expense = CATEGORIES.reduce((record, category) => ({ ...record, [category]: 0 }), {} as Record<Category, number>);
      expanded.forEach((item) => {
        if (item.kind === "income") income[item.name] = (income[item.name] ?? 0) + item.amountCents;
        else expense[item.category] += item.amountCents;
      });
      return { monthIndex, income, expense, items: expanded };
    }),
  }));

  return {
    schemaVersion: 1,
    createdAtISO: now,
    updatedAtISO: now,
    profile: { name: raw.p[0], email: raw.p[1] },
    household: { partnerName: raw.h[0], inviteSentAtISO: raw.h[1] ?? undefined, automaticSync: raw.h[2] === 1 },
    transactions,
    cardPurchases,
    invoicePayments,
    budgetPlans,
    sales: normalizeSalesState(raw.a),
    cardSettings: {
      limitTotalCents: raw.s[0],
      closingDay: raw.s[1],
      dueDay: raw.s[2],
      rates: {
        rotativoMonthlyPercent: raw.s[3][0],
        billInstallmentMonthlyPercent: raw.s[3][1],
        lateMoraMonthlyPercent: raw.s[3][2],
        lateFinePercent: raw.s[3][3],
        cashAdvanceMonthlyPercent: raw.s[3][4],
      },
      iof: { enabled: raw.s[4][0] === 1, fixedPercent: raw.s[4][1], dailyPercent: raw.s[4][2] },
      simulatorDefaults: {
        prevRevolvingCents: raw.s[5][0],
        prevBillInstallmentCents: raw.s[5][1],
        otherChargesCents: raw.s[5][2],
        simulateDays: raw.s[5][3],
      },
    },
  };
}

export function encodeInvite(data: AppData): string {
  return pack(JSON.stringify(compactPayload(data)));
}

export function decodeInvite(code: string): AppData {
  const decoded = decodeURIComponent(code.trim());
  const json = unpack(decoded);
  const raw = JSON.parse(json) as CompactPayload;
  if (raw.v !== 1 || !Array.isArray(raw.t)) throw new Error("Convite inválido.");
  const data = expandPayload(raw);
  assertValidBackup(data);
  return normalizeAppData(data);
}

export function buildInviteUrl(data: AppData): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  // O snapshot vai no hash para não estourar o limite de URL do servidor.
  return `${base}${INVITE_HASH_PREFIX}${encodeInvite(data)}`;
}

export function readInviteFromLocation(): AppData | null {
  try {
    if (window.location.hash.startsWith(INVITE_HASH_PREFIX)) {
      return decodeInvite(window.location.hash.slice(INVITE_HASH_PREFIX.length));
    }
    const code = new URLSearchParams(window.location.search).get(INVITE_PARAM);
    if (code) return decodeInvite(code);
  } catch {
    return null;
  }
  return null;
}

export function clearInviteFromLocation() {
  const url = new URL(window.location.href);
  url.searchParams.delete(INVITE_PARAM);
  if (url.hash.startsWith(INVITE_HASH_PREFIX)) url.hash = "overview";
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash || "#overview"}`);
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(area);
  return copied;
}

export async function shareInvite(data: AppData, partnerName?: string) {
  const url = buildInviteUrl(data);
  const title = "Ninho · finanças na palma da mão";
  const text = `${partnerName || "Sua esposa"}, seu espaço de finanças está pronto no Ninho. Abra este link para carregar nosso plano e lançamentos:`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { shared: true, copied: false, url };
    } catch {
      // segue para cópia quando o compartilhamento é cancelado ou indisponível
    }
  }
  const copied = await copyText(url);
  return { shared: false, copied, url };
}

export function inviteSummary(data: AppData) {
  return {
    name: data.profile.name || "Alguém",
    transactions: data.transactions.length,
    purchases: data.cardPurchases.length,
    plannedItems: data.budgetPlans.reduce(
      (total, plan) => total + plan.months.reduce((sum, month) => sum + (month.items?.length ?? 0), 0),
      0
    ),
    updatedAtISO: data.updatedAtISO,
  };
}

export { utf8ToBase64Url, base64UrlToUtf8 };
