import type {
  AppData,
  BudgetMonth,
  CardPurchase,
  Category,
  CreditCardSettings,
  PaymentMethod,
  PlanItem,
  Transaction,
  TransactionStatus,
} from "./types";
import { addMonthsYM, dateToISO, dueDateForMonth, makeYM, todayISO, ymFromISO } from "../lib/date";
import { budgetRecordsFromItems } from "../lib/finance";
import { CATEGORIES } from "./types";
import { createSalesSeed, createEmptySales } from "../lib/sales";

export function newId(prefix = "id") {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

type ExpenseSeed = {
  description: string;
  cents: number;
  category: Category;
  day: number;
  paymentMethod?: PaymentMethod;
  pending?: boolean;
};

type IncomeSeed = {
  description: string;
  cents: number;
  day: number;
  paymentMethod?: PaymentMethod;
};

export const INCOME_SOURCES: IncomeSeed[] = [
  { description: "Unimed", cents: 377375, day: 5 },
  { description: "Vale Alimentação", cents: 97600, day: 2, paymentMethod: "Vale Alimentação" },
];

export const EXPENSE_SOURCES: ExpenseSeed[] = [
  { description: "Aluguel", cents: 134000, category: "Moradia", day: 10 },
  { description: "Energia elétrica", cents: 40000, category: "Moradia", day: 12, pending: true },
  { description: "Água e esgoto", cents: 20000, category: "Moradia", day: 14 },
  { description: "Internet + TV", cents: 15000, category: "Moradia", day: 15, pending: true },
  { description: "Celular", cents: 10000, category: "Moradia", day: 18 },
  { description: "Parcela da moto", cents: 64000, category: "Transporte", day: 7 },
  { description: "Combustível", cents: 30000, category: "Transporte", day: 19 },
  { description: "Mercado e carnes", cents: 97600, category: "Alimentação", day: 21, pending: true },
  { description: "Leite e fraldas", cents: 80000, category: "Filhos", day: 16 },
  { description: "Dízimo", cents: 53957, category: "Dízimo", day: 20, pending: true },
];

function dayInMonth(reference: Date, monthOffset: number, day: number) {
  const year = reference.getFullYear();
  const month = reference.getMonth() + monthOffset;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return dateToISO(new Date(year, month, Math.min(Math.max(1, day), lastDay)));
}

function buildTransactions(reference = new Date()): Transaction[] {
  const transactions: Transaction[] = [];

  for (let offset = -9; offset <= 0; offset += 1) {
    const isCurrent = offset === 0;
    INCOME_SOURCES.forEach((source) => {
      transactions.push({
        id: newId("tx"),
        description: source.description,
        amountCents: source.cents,
        dateISO: dayInMonth(reference, offset, source.day),
        type: "Income",
        category: "Outros",
        paymentMethod: source.paymentMethod ?? "Pix/Débito",
        status: "Paid",
      });
    });

    EXPENSE_SOURCES.forEach((expense, index) => {
      const groceryVariation = [0, 8420, -5310, 11230, -2980, 6710, -7440, 3210, -4150][
        Math.abs(offset + 9) % 9
      ];
      const fuelVariation = [0, -4300, 2800, 920, -3600, 4900, -1200, 2100, 610][
        Math.abs(offset + 9) % 9
      ];
      let cents = expense.cents;
      if (expense.description === "Mercado e carnes") cents += groceryVariation;
      if (expense.description === "Combustível") cents += fuelVariation;

      const status: TransactionStatus = isCurrent && expense.pending ? "Pending" : "Paid";
      transactions.push({
        id: newId("tx"),
        description: expense.description,
        amountCents: cents,
        dateISO: dayInMonth(reference, offset, expense.day),
        type: "Expense",
        category: expense.category,
        paymentMethod: expense.paymentMethod ?? "Pix/Débito",
        status,
      });

      if (offset === -4 && index === 0) {
        transactions.push({
          id: newId("tx"),
          description: "Corte de cabelo",
          amountCents: 7500,
          dateISO: dayInMonth(reference, offset, 22),
          type: "Expense",
          category: "Cuidados Pessoais",
          paymentMethod: "Pix/Débito",
          status: "Paid",
        });
      }
    });
  }

  return transactions.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

function buildBudgetYear(year: number) {
  const baseItems: PlanItem[] = [
    ...INCOME_SOURCES.map((source) => ({
      id: newId("plan"),
      kind: "income" as const,
      name: source.description,
      amountCents: source.cents,
      category: "Outros" as Category,
      day: source.day,
      fixed: true,
      paid: false,
    })),
    ...EXPENSE_SOURCES.map((expenseItem) => ({
      id: newId("plan"),
      kind: "expense" as const,
      name: expenseItem.description,
      // O planejado nasce com uma pequena margem de segurança.
      amountCents: Math.ceil((expenseItem.cents * 1.08) / 100) * 100,
      category: expenseItem.category,
      day: expenseItem.day,
      fixed: true,
      paid: false,
    })),
  ];

  return {
    year,
    months: Array.from({ length: 12 }, (_, monthIndex): BudgetMonth => {
      const records = budgetRecordsFromItems(
        baseItems.map((item) => ({ ...item, id: `${item.id}_${monthIndex}` }))
      );
      return {
        monthIndex,
        income: records.income,
        expense: records.expense,
        items: baseItems.map((item) => ({ ...item, id: `${item.id}_${monthIndex}` })),
      };
    }),
  };
}

function buildCardSettings(): CreditCardSettings {
  return {
    limitTotalCents: 500000,
    closingDay: 10,
    dueDay: 17,
    rates: {
      rotativoMonthlyPercent: 19.73,
      billInstallmentMonthlyPercent: 9.99,
      lateMoraMonthlyPercent: 1,
      lateFinePercent: 2,
      cashAdvanceMonthlyPercent: 9.75,
    },
    iof: {
      enabled: false,
      fixedPercent: 0.38,
      dailyPercent: 0.0082,
    },
    simulatorDefaults: {
      prevRevolvingCents: 0,
      prevBillInstallmentCents: 0,
      otherChargesCents: 0,
      simulateDays: 30,
    },
  };
}

function buildCardPurchases(reference = new Date()): CardPurchase[] {
  const current = makeYM(reference.getFullYear(), reference.getMonth());
  const notebookFirst = addMonthsYM(current, -2);
  const courseFirst = addMonthsYM(current, -1);
  const today = todayISO();

  return [
    {
      id: newId("buy"),
      description: "Notebook",
      amountCents: 279920,
      purchaseDateISO: dayInMonth(reference, -2, 14),
      category: "Outros",
      installments: {
        totalCents: 279920,
        parts: 8,
        currentPart: 4,
        firstInstallmentDateISO: dueDateForMonth(notebookFirst, 17),
      },
    },
    {
      id: newId("buy"),
      description: "Curso de inglês",
      amountCents: 114000,
      purchaseDateISO: dayInMonth(reference, -1, 9),
      category: "Cuidados Pessoais",
      installments: {
        totalCents: 114000,
        parts: 6,
        currentPart: 3,
        firstInstallmentDateISO: dueDateForMonth(courseFirst, 17),
      },
    },
    {
      id: newId("buy"),
      description: "Mercado do mês",
      amountCents: 43290,
      purchaseDateISO: today,
      category: "Alimentação",
    },
    {
      id: newId("buy"),
      description: "Farmácia",
      amountCents: 18990,
      purchaseDateISO: `${ymFromISO(today)}-${String(Math.max(1, reference.getDate() - 4)).padStart(2, "0")}`,
      category: "Outros",
    },
  ];
}

export function createSeedData(): AppData {
  const now = new Date();
  const nowISO = now.toISOString();

  return {
    schemaVersion: 1,
    createdAtISO: nowISO,
    updatedAtISO: nowISO,
    profile: {
      name: "Marina Alves",
      email: "marina@email.com",
    },
    budgetPlans: [buildBudgetYear(now.getFullYear())],
    transactions: buildTransactions(now),
    cardPurchases: buildCardPurchases(now),
    cardSettings: buildCardSettings(),
    invoicePayments: [],
    household: {
      partnerName: "",
      automaticSync: true,
    },
    sales: createSalesSeed(),
    goals: [],
  };
}

/** Estado inicial vazio para uma conta nova (sem dados de demonstração). */
export function createEmptyData(name: string, email: string): AppData {
  const now = new Date();
  const nowISO = now.toISOString();
  const year = now.getFullYear();
  const emptyExpense = CATEGORIES.reduce(
    (record, category) => ({ ...record, [category]: 0 }),
    {} as Record<Category, number>
  );
  return {
    schemaVersion: 1,
    createdAtISO: nowISO,
    updatedAtISO: nowISO,
    profile: { name, email },
    budgetPlans: [{
      year,
      months: Array.from({ length: 12 }, (_, monthIndex) => ({
        monthIndex,
        income: {},
        expense: { ...emptyExpense },
        items: [],
      })),
    }],
    transactions: [],
    cardPurchases: [],
    cardSettings: buildCardSettings(),
    invoicePayments: [],
    household: { partnerName: "", automaticSync: true },
    sales: createEmptySales(),
    goals: [],
  };
}
