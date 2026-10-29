import type {
  AppData,
  BudgetMonth,
  BudgetYearPlan,
  CardPurchase,
  Category,
  CreditCardSettings,
  InvoicePayment,
  InvoiceScheduleEntry,
  MoneyCents,
  PlanItem,
  Transaction,
  YearMonth,
} from "../state/types";
import { CATEGORIES } from "../state/types";
import {
  addMonthsYM,
  daysUntil,
  dueDateForMonth,
  invoiceMonthForDate,
  nextInvoiceYM,
  splitYM,
  ymFromISO,
} from "./date";

export const CATEGORY_META: Record<Category, { color: string; soft: string; label: string }> = {
  Moradia: { color: "#c9f36b", soft: "rgba(201, 243, 107, 0.13)", label: "Moradia" },
  Alimentação: { color: "#ff8f79", soft: "rgba(255, 143, 121, 0.13)", label: "Alimentação" },
  Transporte: { color: "#7dd3fc", soft: "rgba(125, 211, 252, 0.13)", label: "Transporte" },
  Filhos: { color: "#f7c873", soft: "rgba(247, 200, 115, 0.13)", label: "Filhos" },
  "Cuidados Pessoais": { color: "#c4b5fd", soft: "rgba(196, 181, 253, 0.13)", label: "Cuidados pessoais" },
  Cartão: { color: "#f9a8d4", soft: "rgba(249, 168, 212, 0.13)", label: "Cartão" },
  Dízimo: { color: "#86efac", soft: "rgba(134, 239, 172, 0.13)", label: "Dízimo" },
  Outros: { color: "#9fb0a3", soft: "rgba(159, 176, 163, 0.13)", label: "Outros" },
};

export const INCOME_COLOR = "#c9f36b";
export const EXPENSE_COLOR = "#ff8f79";
export const INDIGO_COLOR = "#a7b8ff";

export function sumCents(values: Array<number | undefined | null>): MoneyCents {
  return values.reduce<number>((total, value) => total + (Number(value) || 0), 0);
}

export function emptyExpenseRecord(): Record<Category, MoneyCents> {
  return CATEGORIES.reduce(
    (record, category) => ({ ...record, [category]: 0 }),
    {} as Record<Category, MoneyCents>
  );
}

export function emptyBudgetMonth(monthIndex: number): BudgetMonth {
  return { monthIndex, income: {}, expense: emptyExpenseRecord() };
}

export function getPlan(plans: BudgetYearPlan[], year: number): BudgetYearPlan {
  const existing = plans.find((plan) => plan.year === year);
  if (existing) return existing;
  return {
    year,
    months: Array.from({ length: 12 }, (_, monthIndex) => emptyBudgetMonth(monthIndex)),
  };
}

export function monthTransactions(transactions: Transaction[], ym: YearMonth): Transaction[] {
  return transactions.filter((transaction) => transaction.dateISO.startsWith(ym));
}

export function totalsForTransactions(transactions: Transaction[]) {
  return transactions.reduce(
    (totals, transaction) => {
      if (transaction.type === "Income") totals.income += transaction.amountCents;
      else totals.expense += transaction.amountCents;
      if (transaction.status === "Pending") {
        totals.pendingCount += 1;
        totals.pending += transaction.amountCents;
      }
      return totals;
    },
    { income: 0, expense: 0, pending: 0, pendingCount: 0 }
  );
}

export function budgetRecordsFromItems(items: PlanItem[]) {
  const income: Record<string, MoneyCents> = {};
  const expense = emptyExpenseRecord();
  for (const item of items) {
    if (item.kind === "income") {
      income[item.name] = (income[item.name] ?? 0) + item.amountCents;
    } else {
      expense[item.category] += item.amountCents;
    }
  }
  return { income, expense };
}

export function budgetTotals(month: BudgetMonth) {
  if (Array.isArray(month.items)) {
    const derived = budgetRecordsFromItems(month.items);
    return {
      income: sumCents(Object.values(derived.income)),
      expense: sumCents(Object.values(derived.expense)),
    };
  }
  return {
    income: sumCents(Object.values(month.income)),
    expense: sumCents(Object.values(month.expense)),
  };
}

export function itemsForMonth(plan: BudgetYearPlan, monthIndex: number): PlanItem[] {
  const month = plan.months[monthIndex];
  if (Array.isArray(month?.items)) return month.items;
  for (let index = monthIndex - 1; index >= 0; index -= 1) {
    const previous = plan.months[index]?.items;
    if (Array.isArray(previous) && previous.length) {
      return previous.filter((item) => item.fixed);
    }
  }
  return [];
}

export function withItems(plan: BudgetYearPlan, monthIndex: number, items: PlanItem[]): BudgetYearPlan {
  const records = budgetRecordsFromItems(items);
  return {
    ...plan,
    months: plan.months.map((month) =>
      month.monthIndex === monthIndex
        ? { ...month, items, income: records.income, expense: records.expense }
        : month
    ),
  };
}

export function replicateToFuture(plan: BudgetYearPlan, fromMonthIndex: number, fixedItems: PlanItem[]): BudgetYearPlan {
  return {
    ...plan,
    months: plan.months.map((month) => {
      if (month.monthIndex <= fromMonthIndex) return month;
      const current = Array.isArray(month.items) ? month.items.filter((item) => !item.fixed) : [];
      const items = [...current, ...fixedItems.map((item) => ({ ...item, paid: false }))];
      const records = budgetRecordsFromItems(items);
      return { ...month, items, income: records.income, expense: records.expense };
    }),
  };
}

export function categoryTotals(transactions: Transaction[], category: Category): MoneyCents {
  return sumCents(
    transactions
      .filter((transaction) => transaction.type === "Expense" && transaction.category === category)
      .map((transaction) => transaction.amountCents)
  );
}

export function groupExpensesByCategory(transactions: Transaction[]) {
  return CATEGORIES.map((category) => ({
    category,
    value: categoryTotals(transactions, category),
  }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function yearActuals(data: AppData, year: number) {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const ym = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const totals = totalsForTransactions(monthTransactions(data.transactions, ym));
    return { monthIndex, ym, ...totals };
  });
}

export function splitIntoInstallments(totalCents: MoneyCents, parts: number): MoneyCents[] {
  const safeParts = Math.max(1, Math.trunc(parts));
  if (safeParts === 1) return [totalCents];
  const base = Math.floor(Math.abs(totalCents) / safeParts);
  const remainder = Math.abs(totalCents) - base * safeParts;
  return Array.from({ length: safeParts }, (_, index) => {
    const value = base + (index < remainder ? 1 : 0);
    return totalCents < 0 ? -value : value;
  });
}

export function expandPurchaseSchedule(
  purchase: CardPurchase,
  closingDay: number
): InvoiceScheduleEntry[] {
  if (!purchase.installments) {
    return [
      {
        yearMonth: invoiceMonthForDate(purchase.purchaseDateISO, closingDay),
        amountCents: purchase.amountCents,
        purchaseId: purchase.id,
        part: 1,
        parts: 1,
      },
    ];
  }

  const parts = Math.max(1, Math.trunc(purchase.installments.parts));
  const values = splitIntoInstallments(purchase.installments.totalCents, parts);
  const currentPart = Math.max(1, Math.min(parts, Math.trunc(purchase.installments.currentPart)));
  const firstYM = ymFromISO(purchase.installments.firstInstallmentDateISO);

  return Array.from({ length: parts - currentPart + 1 }, (_, offset) => {
    const partIndex = currentPart - 1 + offset;
    return {
      yearMonth: addMonthsYM(firstYM, partIndex),
      amountCents: values[partIndex],
      purchaseId: purchase.id,
      part: partIndex + 1,
      parts,
    };
  });
}

export function allScheduleEntries(purchases: CardPurchase[], closingDay: number) {
  return purchases.flatMap((purchase) => expandPurchaseSchedule(purchase, closingDay));
}

export function invoiceTotalsByMonth(purchases: CardPurchase[], closingDay: number) {
  const map = new Map<YearMonth, MoneyCents>();
  for (const entry of allScheduleEntries(purchases, closingDay)) {
    map.set(entry.yearMonth, (map.get(entry.yearMonth) ?? 0) + entry.amountCents);
  }
  return map;
}

export function invoiceTotalForMonth(
  purchases: CardPurchase[],
  closingDay: number,
  ym: YearMonth
) {
  return sumCents(
    allScheduleEntries(purchases, closingDay)
      .filter((entry) => entry.yearMonth === ym)
      .map((entry) => entry.amountCents)
  );
}

export function invoiceEntriesForMonth(
  purchases: CardPurchase[],
  closingDay: number,
  ym: YearMonth
) {
  const purchasesById = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  return allScheduleEntries(purchases, closingDay)
    .filter((entry) => entry.yearMonth === ym)
    .map((entry) => ({ entry, purchase: purchasesById.get(entry.purchaseId) }))
    .filter((row): row is { entry: InvoiceScheduleEntry; purchase: CardPurchase } => !!row.purchase)
    .sort((a, b) => b.entry.amountCents - a.entry.amountCents);
}

export function paidForInvoice(payments: InvoicePayment[], ym: YearMonth) {
  return sumCents(
    payments.filter((payment) => payment.invoiceYM === ym).map((payment) => payment.amountPaidCents)
  );
}

export function invoiceStatus(
  invoiceTotal: MoneyCents,
  payments: InvoicePayment[],
  ym: YearMonth
): "open" | "partial" | "paid" {
  if (invoiceTotal <= 0) return "open";
  const paid = paidForInvoice(payments, ym);
  if (paid >= invoiceTotal) return "paid";
  if (paid > 0) return "partial";
  return "open";
}

export function computeCommittedCents(
  purchases: CardPurchase[],
  payments: InvoicePayment[],
  closingDay: number,
  fromYM: YearMonth
) {
  const scheduled = sumCents(
    allScheduleEntries(purchases, closingDay)
      .filter((entry) => entry.yearMonth >= fromYM)
      .map((entry) => entry.amountCents)
  );
  // Cada pagamento libera o limite na mesma proporção da fatura quitada.
  const paid = sumCents(
    payments
      .filter((payment) => payment.invoiceYM >= fromYM)
      .map((payment) => payment.amountPaidCents)
  );
  return Math.max(0, scheduled - paid);
}

export function nextOpenInvoice(
  purchases: CardPurchase[],
  payments: InvoicePayment[],
  settings: CreditCardSettings
) {
  const startYM = nextInvoiceYM(settings.closingDay);
  const map = invoiceTotalsByMonth(purchases, settings.closingDay);
  for (let index = 0; index < 18; index += 1) {
    const ym = addMonthsYM(startYM, index);
    const total = map.get(ym) ?? 0;
    if (total <= 0) continue;
    const paid = paidForInvoice(payments, ym);
    if (paid < total) {
      return {
        yearMonth: ym,
        totalCents: total,
        paidCents: paid,
        remainingCents: Math.max(0, total - paid),
        dueDateISO: dueDateForMonth(ym, settings.dueDay),
        closingDateISO: dueDateForMonth(ym, settings.closingDay),
        daysUntilDue: daysUntil(dueDateForMonth(ym, settings.dueDay)),
      };
    }
  }
  return null;
}

export function computeMinimumPaymentCents(args: {
  currentPurchasesCents: MoneyCents;
  prevRevolvingPurchasesCents: MoneyCents;
  otherChargesCents: MoneyCents;
  prevBillInstallmentCents: MoneyCents;
}): MoneyCents {
  const base = Math.round(
    0.15 * (args.currentPurchasesCents + args.prevRevolvingPurchasesCents)
  );
  const minimum = base + args.otherChargesCents + args.prevBillInstallmentCents;
  return Math.max(1000, minimum);
}

export function computeRotativoInterestCents(
  unpaidCents: MoneyCents,
  monthlyPercent: number,
  months = 1
): MoneyCents {
  const rate = Math.max(0, monthlyPercent) / 100;
  return Math.round(unpaidCents * (Math.pow(1 + rate, months) - 1));
}

export function computeLateChargesCents(args: {
  overdueCents: MoneyCents;
  lateFinePercent: number;
  moraMonthlyPercent: number;
  daysLate: number;
  baseDays?: number;
}) {
  const baseDays = args.baseDays ?? 30;
  const fineCents = Math.round(args.overdueCents * (Math.max(0, args.lateFinePercent) / 100));
  const moraCents = Math.round(
    args.overdueCents * (Math.max(0, args.moraMonthlyPercent) / 100) * (Math.max(0, args.daysLate) / baseDays)
  );
  return { fineCents, moraCents, totalCents: fineCents + moraCents };
}

export function computeIOFCents(args: {
  baseCents: MoneyCents;
  fixedPercent: number;
  dailyPercent: number;
  days: number;
}) {
  const fixed = Math.round(args.baseCents * (Math.max(0, args.fixedPercent) / 100));
  const daily = Math.round(
    args.baseCents * (Math.max(0, args.dailyPercent) / 100) * Math.max(0, args.days)
  );
  return fixed + daily;
}

export function simulateInvoice(args: {
  settings: CreditCardSettings;
  purchasesCents: MoneyCents;
  paymentCents: MoneyCents;
  daysLate: number;
}) {
  const defaults = args.settings.simulatorDefaults;
  const minimum = computeMinimumPaymentCents({
    currentPurchasesCents: args.purchasesCents,
    prevRevolvingPurchasesCents: defaults.prevRevolvingCents,
    otherChargesCents: defaults.otherChargesCents,
    prevBillInstallmentCents: defaults.prevBillInstallmentCents,
  });
  const billTotal =
    args.purchasesCents +
    defaults.prevRevolvingCents +
    defaults.prevBillInstallmentCents +
    defaults.otherChargesCents;
  const paid = Math.max(0, Math.min(args.paymentCents, billTotal));
  const unpaid = Math.max(0, billTotal - paid);
  const interest =
    unpaid > 0
      ? computeRotativoInterestCents(unpaid, args.settings.rates.rotativoMonthlyPercent, 1)
      : 0;
  const iof = args.settings.iof.enabled
    ? computeIOFCents({
        baseCents: unpaid,
        fixedPercent: args.settings.iof.fixedPercent,
        dailyPercent: args.settings.iof.dailyPercent,
        days: defaults.simulateDays,
      })
    : 0;
  const late =
    args.daysLate > 0
      ? computeLateChargesCents({
          overdueCents: unpaid,
          lateFinePercent: args.settings.rates.lateFinePercent,
          moraMonthlyPercent: args.settings.rates.lateMoraMonthlyPercent,
          daysLate: args.daysLate,
        })
      : { fineCents: 0, moraCents: 0, totalCents: 0 };
  const nextInvoice = unpaid + interest + iof + late.totalCents;

  return { billTotal, minimum, unpaid, interest, iof, late, nextInvoice };
}

export function nextMonthLabelDate(year: number, monthIndex: number, dueDay: number) {
  const ym = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return dueDateForMonth(ym, dueDay);
}

export function budgetYearRange(year: number) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export function monthIndexFromYM(ym: YearMonth) {
  return splitYM(ym).monthIndex;
}
