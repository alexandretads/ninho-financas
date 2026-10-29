export type MoneyCents = number;

export type TransactionType = "Income" | "Expense";
export type TransactionStatus = "Paid" | "Pending";

export const CATEGORIES = [
  "Moradia",
  "Transporte",
  "Alimentação",
  "Filhos",
  "Cuidados Pessoais",
  "Cartão",
  "Dízimo",
  "Outros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PAYMENT_METHODS = [
  "Pix/Débito",
  "Vale Alimentação",
  "Dinheiro",
  "Cartão de Crédito",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type ISODate = string;
export type YearMonth = string;

export type Transaction = {
  id: string;
  description: string;
  amountCents: MoneyCents;
  dateISO: ISODate;
  type: TransactionType;
  category: Category;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
};

/* ----------------------------- Vendas / CRM ------------------------------ */

export type SalesModality = "LAR" | "MOTORS";
export type SalesQuotaStatus = "active" | "cancelled";
export type SalesPaymentStatus = "paid" | "overdue" | "pending" | "rescheduled";

export type SalesEnrollment = {
  id: string;
  name: string;
  code: string;
  consultant: string;
};

export type SalesSettings = {
  notePercentLar: number;
  notePercentMotors: number;
  taxPercent: number;
  installments: number;
  cutoffDay: number;
  payoutDay: number;
};

export type SalesQuota = {
  id: string;
  client: string;
  group: string;
  quota: string;
  modality: SalesModality;
  creditCents: MoneyCents;
  saleDateISO: ISODate;
  enrollmentId: string;
  consultant: string;
  status: SalesQuotaStatus;
  paymentStatus: SalesPaymentStatus;
  paidAtISO?: ISODate;
  cancelledAtISO?: ISODate;
  observation: string;
};

export type SalesClosure = {
  id: string;
  cycleYM: YearMonth;
  payableYM: YearMonth;
  dueDateISO: ISODate;
  grossCents: MoneyCents;
  taxCents: MoneyCents;
  netCents: MoneyCents;
  quotaIds: string[];
  byEnrollment: Record<string, { grossCents: MoneyCents; netCents: MoneyCents }>;
  status: "scheduled" | "received";
  createdAtISO: string;
  receivedAtISO?: ISODate;
  transactionId: string;
};

export type SalesState = {
  settings: SalesSettings;
  enrollments: SalesEnrollment[];
  quotas: SalesQuota[];
  closures: SalesClosure[];
};

export type PlanItem = {
  id: string;
  kind: "income" | "expense";
  name: string;
  amountCents: MoneyCents;
  category: Category;
  day: number;
  fixed: boolean;
  paid: boolean;
};

export type BudgetMonth = {
  monthIndex: number;
  income: Record<string, MoneyCents>;
  expense: Record<Category, MoneyCents>;
  /** Itens detalhados do plano (aluguel, energia, salário...). */
  items?: PlanItem[];
};

export type Household = {
  partnerName: string;
  inviteSentAtISO?: string;
  automaticSync: boolean;
};

export type BudgetYearPlan = {
  year: number;
  months: BudgetMonth[];
};

export type CreditCardRates = {
  rotativoMonthlyPercent: number;
  billInstallmentMonthlyPercent: number;
  lateMoraMonthlyPercent: number;
  lateFinePercent: number;
  cashAdvanceMonthlyPercent: number;
};

export type IOFConfig = {
  enabled: boolean;
  fixedPercent: number;
  dailyPercent: number;
};

export type CreditCardSettings = {
  limitTotalCents: MoneyCents;
  closingDay: number;
  dueDay: number;
  rates: CreditCardRates;
  iof: IOFConfig;
  simulatorDefaults: {
    prevRevolvingCents: MoneyCents;
    prevBillInstallmentCents: MoneyCents;
    otherChargesCents: MoneyCents;
    simulateDays: number;
  };
};

export type CardPurchaseInstallments = {
  totalCents: MoneyCents;
  parts: number;
  currentPart: number;
  firstInstallmentDateISO: ISODate;
};

export type CardPurchase = {
  id: string;
  description: string;
  amountCents: MoneyCents;
  purchaseDateISO: ISODate;
  category: Exclude<Category, "Cartão">;
  installments?: CardPurchaseInstallments;
};

export type InvoicePayment = {
  id: string;
  invoiceYM: YearMonth;
  invoiceTotalCents: MoneyCents;
  amountPaidCents: MoneyCents;
  dateISO: ISODate;
  transactionId: string;
  status: "partial" | "paid";
};

export type Profile = {
  name: string;
  email: string;
};

export type GoalContribution = {
  id: string;
  amountCents: MoneyCents;
  dateISO: ISODate;
  note?: string;
};

export type Goal = {
  id: string;
  title: string;
  description: string;
  category: "reserva" | "viagem" | "casa" | "veiculo" | "educacao" | "divida" | "negocio" | "outro";
  targetCents: MoneyCents;
  savedCents: MoneyCents;
  deadlineISO: ISODate;
  createdAtISO: string;
  contributions: GoalContribution[];
  completed: boolean;
};

export type AppData = {
  schemaVersion: 1;
  createdAtISO: string;
  updatedAtISO: string;
  profile: Profile;
  /** @deprecated credencial legada; a sessão agora é assinada fora do workspace. */
  _sessionToken?: string;
  budgetPlans: BudgetYearPlan[];
  transactions: Transaction[];
  cardPurchases: CardPurchase[];
  cardSettings: CreditCardSettings;
  invoicePayments: InvoicePayment[];
  household?: Household;
  sales?: SalesState;
  goals?: Goal[];
};

export type InvoiceScheduleEntry = {
  yearMonth: YearMonth;
  amountCents: MoneyCents;
  purchaseId: string;
  part: number;
  parts: number;
};
