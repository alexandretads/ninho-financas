import React from "react";
import type { AppData, BudgetYearPlan, CardPurchase, Category, CreditCardSettings, Household, InvoicePayment, Profile, SalesClosure, SalesQuota, SalesState, Transaction } from "./types";
import { createSeedData, newId } from "./seed";
import { createSalesSeed, normalizeSalesState, SALES_ENROLLMENT_NAMES } from "../lib/sales";
import { useAuth } from "./auth";
import { useToast } from "../components/Toast";
import { budgetRecordsFromItems } from "../lib/finance";

export const STORAGE_KEY = "ninho:financas:v1";

type Action =
  | { type: "ADD_TX"; tx: Transaction }
  | { type: "UPDATE_TX"; tx: Transaction }
  | { type: "DELETE_TX"; id: string }
  | { type: "ADD_PURCHASE"; purchase: CardPurchase }
  | { type: "UPDATE_PURCHASE"; purchase: CardPurchase }
  | { type: "DELETE_PURCHASE"; id: string }
  | { type: "UPSERT_BUDGET_PLAN"; plan: BudgetYearPlan }
  | { type: "UPDATE_CARD_SETTINGS"; settings: CreditCardSettings }
  | { type: "UPDATE_PROFILE"; profile: Profile }
  | { type: "SET_GOALS"; goals: AppData["goals"] }
  | { type: "UPDATE_HOUSEHOLD"; household: Household }
  | { type: "PAY_INVOICE"; payment: InvoicePayment; tx: Transaction }
  | { type: "ADD_SALE_QUOTA"; quota: SalesQuota }
  | { type: "UPDATE_SALE_QUOTA"; quota: SalesQuota }
  | { type: "CLOSE_SALES_CYCLE"; closure: SalesClosure; tx: Transaction }
  | { type: "RECEIVE_SALES_CLOSURE"; closureId: string; receivedAtISO: string }
  | { type: "UPDATE_SALES_SETTINGS"; sales: SalesState }
  | { type: "IMPORT_REPLACE"; backup: AppData }
  | { type: "IMPORT_MERGE_KEEP_EXISTING"; backup: AppData }
  | { type: "SYNC_FROM_PEER"; data: AppData }
  | { type: "RESET_SEED" };

function touch(data: AppData): AppData {
  return { ...data, updatedAtISO: new Date().toISOString() };
}

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case "ADD_TX":
      return touch({ ...state, transactions: [action.tx, ...state.transactions] });
    case "UPDATE_TX":
      return touch({
        ...state,
        transactions: state.transactions.map((transaction) =>
          transaction.id === action.tx.id ? action.tx : transaction
        ),
      });
    case "DELETE_TX":
      return touch({
        ...state,
        transactions: state.transactions.filter((transaction) => transaction.id !== action.id),
      });
    case "ADD_PURCHASE":
      return touch({ ...state, cardPurchases: [action.purchase, ...state.cardPurchases] });
    case "UPDATE_PURCHASE":
      return touch({
        ...state,
        cardPurchases: state.cardPurchases.map((purchase) =>
          purchase.id === action.purchase.id ? action.purchase : purchase
        ),
      });
    case "DELETE_PURCHASE":
      return touch({
        ...state,
        cardPurchases: state.cardPurchases.filter((purchase) => purchase.id !== action.id),
      });
    case "UPSERT_BUDGET_PLAN":
      return touch({
        ...state,
        budgetPlans: [
          ...state.budgetPlans.filter((plan) => plan.year !== action.plan.year),
          action.plan,
        ].sort((a, b) => a.year - b.year),
      });
    case "UPDATE_CARD_SETTINGS":
      return touch({ ...state, cardSettings: action.settings });
    case "UPDATE_PROFILE":
      return touch({ ...state, profile: action.profile });
    case "SET_GOALS":
      return touch({ ...state, goals: action.goals ?? [] });
    case "UPDATE_HOUSEHOLD":
      return touch({ ...state, household: action.household });
    case "SYNC_FROM_PEER":
      return action.data.updatedAtISO > state.updatedAtISO
        ? normalizeAppData(action.data)
        : state;
    case "PAY_INVOICE":
      return touch({
        ...state,
        transactions: [action.tx, ...state.transactions],
        invoicePayments: [action.payment, ...state.invoicePayments],
      });
    case "ADD_SALE_QUOTA":
      return touch({
        ...state,
        sales: {
          ...(state.sales ?? createSalesSeed()),
          quotas: [action.quota, ...(state.sales?.quotas ?? [])],
        },
      });
    case "UPDATE_SALE_QUOTA":
      return touch({
        ...state,
        sales: {
          ...(state.sales ?? createSalesSeed()),
          quotas: (state.sales?.quotas ?? []).map((quota) =>
            quota.id === action.quota.id ? action.quota : quota
          ),
        },
      });
    case "CLOSE_SALES_CYCLE": {
      const sales = state.sales ?? createSalesSeed();
      // Impede consolidação duplicada do mesmo ciclo se duas abas fecharem juntas.
      const alreadyClosed = sales.closures.some(
        (closure) =>
          closure.cycleYM === action.closure.cycleYM &&
          closure.quotaIds.some((id) => action.closure.quotaIds.includes(id))
      );
      if (alreadyClosed) return state;
      const consuming = new Set(action.closure.quotaIds);
      const sameCycle = sales.closures.find(
        (closure) => closure.cycleYM === action.closure.cycleYM
      );
      const byEnrollment = { ...(sameCycle?.byEnrollment ?? {}) };
      for (const [id, values] of Object.entries(action.closure.byEnrollment)) {
        const current = byEnrollment[id] ?? { grossCents: 0, netCents: 0 };
        byEnrollment[id] = {
          grossCents: current.grossCents + values.grossCents,
          netCents: current.netCents + values.netCents,
        };
      }
      const closures = sameCycle
        ? sales.closures.map((closure) =>
            closure.id === sameCycle.id
              ? {
                  ...closure,
                  grossCents: closure.grossCents + action.closure.grossCents,
                  taxCents: closure.taxCents + action.closure.taxCents,
                  netCents: closure.netCents + action.closure.netCents,
                  quotaIds: [...closure.quotaIds, ...action.closure.quotaIds],
                  byEnrollment,
                }
              : closure
          )
        : [action.closure, ...sales.closures];
      const merged = sameCycle
        ? closures.find((closure) => closure.cycleYM === action.closure.cycleYM)
        : null;
      const reopened = sameCycle?.status === "received";
      const finalClosures = reopened
        ? closures.map((closure) =>
            closure.cycleYM === action.closure.cycleYM
              ? { ...closure, status: "scheduled" as const, receivedAtISO: undefined }
              : closure
          )
        : closures;
      const transactions = merged
        ? state.transactions.map((transaction) =>
            transaction.id === merged.transactionId
              ? {
                  ...transaction,
                  amountCents: merged.netCents,
                  status: reopened ? ("Pending" as const) : transaction.status,
                  description: transaction.description.replace(/· \d+ cotas$/, `· ${merged.quotaIds.length} cotas`),
                }
              : transaction
          )
        : [];
      return touch({
        ...state,
        transactions: merged
          ? transactions
          : [action.tx, ...state.transactions],
        sales: {
          ...sales,
          closures: finalClosures,
          // O cliente precisará pagar novamente para liberar a próxima 1/13.
          quotas: sales.quotas.map((quota) =>
            consuming.has(quota.id)
              ? { ...quota, paymentStatus: "pending" as const, paidAtISO: undefined }
              : quota
          ),
        },
      });
    }
    case "RECEIVE_SALES_CLOSURE": {
      const closures = state.sales?.closures ?? [];
      const closure = closures.find((item) => item.id === action.closureId);
      return touch({
        ...state,
        transactions: closure?.transactionId
          ? state.transactions.map((transaction) =>
              transaction.id === closure.transactionId
                ? { ...transaction, status: "Paid" as const }
                : transaction
            )
          : state.transactions,
        sales: state.sales
          ? {
              ...state.sales,
              closures: closures.map((item) =>
                item.id === action.closureId
                  ? { ...item, status: "received" as const, receivedAtISO: action.receivedAtISO }
                  : item
              ),
            }
          : state.sales,
      });
    }
    case "UPDATE_SALES_SETTINGS":
      return touch({ ...state, sales: action.sales });
    case "IMPORT_REPLACE":
      return touch(normalizeAppData(action.backup));
    case "IMPORT_MERGE_KEEP_EXISTING": {
      const incoming = normalizeAppData(action.backup);
      const incomingTxIds = new Set(state.transactions.map((item) => item.id));
      const incomingPurchaseIds = new Set(state.cardPurchases.map((item) => item.id));
      const incomingPaymentIds = new Set(state.invoicePayments.map((item) => item.id));
      const years = new Set(state.budgetPlans.map((plan) => plan.year));
      return touch({
        ...state,
        transactions: [...state.transactions, ...incoming.transactions.filter((item) => !incomingTxIds.has(item.id))],
        cardPurchases: [
          ...state.cardPurchases,
          ...incoming.cardPurchases.filter((item) => !incomingPurchaseIds.has(item.id)),
        ],
        sales: state.sales ?? incoming.sales,
        invoicePayments: [
          ...state.invoicePayments,
          ...incoming.invoicePayments.filter((item) => !incomingPaymentIds.has(item.id)),
        ],
        budgetPlans: [
          ...state.budgetPlans,
          ...incoming.budgetPlans.filter((plan) => !years.has(plan.year)),
        ].sort((a, b) => a.year - b.year),
      });
    }
    case "RESET_SEED":
      return createSeedData();
    default:
      return state;
  }
}

function migrateBudgetPlan(plan: BudgetYearPlan): BudgetYearPlan {
  return {
    ...plan,
    months: plan.months.map((month) => {
      if (Array.isArray(month.items)) {
        // Versões antigas criavam "Ademicon MAT W/K" e "MAT V/T" como renda
        // fixa. Agora elas vêm do módulo de vendas: remover evita dupla contagem.
        const items = month.items.filter((item) => !SALES_ENROLLMENT_NAMES.includes(item.name));
        const records = budgetRecordsFromItems(items);
        return { ...month, items, income: records.income, expense: records.expense };
      }
      const items = [
        ...Object.entries(month.income ?? {}).filter(([source]) => !SALES_ENROLLMENT_NAMES.includes(source)).map(([source, amount]) => ({
          id: newId("plan"),
          kind: "income" as const,
          name: source,
          amountCents: amount,
          category: "Outros" as const,
          day: 5,
          fixed: true,
          paid: false,
        })),
        ...Object.entries(month.expense ?? {})
          .filter(([, amount]) => amount > 0)
          .map(([category, amount]) => ({
            id: newId("plan"),
            kind: "expense" as const,
            name: category,
            amountCents: amount,
            category: category as Category,
            day: 10,
            fixed: true,
            paid: false,
          })),
      ];
      return { ...month, items };
    }),
  };
}

export function normalizeAppData(input: AppData): AppData {
  const fallback = createSeedData();
  return {
    ...input,
    schemaVersion: 1,
    createdAtISO: input.createdAtISO ?? new Date().toISOString(),
    updatedAtISO: input.updatedAtISO ?? new Date().toISOString(),
    profile: input.profile ?? fallback.profile,
    budgetPlans: Array.isArray(input.budgetPlans) ? input.budgetPlans.map(migrateBudgetPlan) : [],
    transactions: Array.isArray(input.transactions) ? input.transactions : [],
    cardPurchases: Array.isArray(input.cardPurchases) ? input.cardPurchases : [],
    cardSettings: input.cardSettings ?? fallback.cardSettings,
    invoicePayments: Array.isArray(input.invoicePayments) ? input.invoicePayments : [],
    household: input.household ?? fallback.household,
    sales: normalizeSalesState(input.sales),
  };
}

export function assertValidBackup(value: unknown): asserts value is AppData {
  if (!value || typeof value !== "object") throw new Error("Arquivo inválido: objeto esperado.");
  const data = value as Partial<AppData>;
  if (data.schemaVersion !== 1) throw new Error("Versão de backup incompatível.");
  if (!Array.isArray(data.transactions)) throw new Error("Backup sem lista de lançamentos.");
  if (!Array.isArray(data.budgetPlans)) throw new Error("Backup sem planejamento anual.");
  if (!Array.isArray(data.cardPurchases)) throw new Error("Backup sem compras do cartão.");
  if (!data.cardSettings) throw new Error("Backup sem configurações do cartão.");
  if (data.transactions.length > 50_000) throw new Error("Backup grande demais (lançamentos).");
  if (data.cardPurchases.length > 10_000) throw new Error("Backup grande demais (compras).");
  const invalidTransaction = data.transactions.find(
    (item) =>
      !item ||
      typeof item.id !== "string" ||
      typeof item.description !== "string" ||
      !Number.isFinite(item.amountCents) ||
      item.amountCents < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(item.dateISO)) ||
      (item.type !== "Income" && item.type !== "Expense") ||
      (item.status !== "Paid" && item.status !== "Pending")
  );
  if (invalidTransaction) throw new Error("Há lançamentos com dados inválidos no arquivo.");
  const invalidPurchase = data.cardPurchases.find(
    (item) => !item || typeof item.id !== "string" || !Number.isFinite(item.amountCents) || item.amountCents < 0
  );
  if (invalidPurchase) throw new Error("Há compras com dados inválidos no arquivo.");
  const invalidPlan = data.budgetPlans.find(
    (plan) => !plan || !Number.isFinite(plan.year) || !Array.isArray(plan.months) || plan.months.length !== 12
  );
  if (invalidPlan) throw new Error("Planejamento anual inválido no arquivo.");
  if (!Array.isArray(data.invoicePayments ?? [])) throw new Error("Pagamentos de fatura inválidos.");
  if (data.sales && (!Array.isArray(data.sales.quotas) || !Array.isArray(data.sales.closures))) {
    throw new Error("Dados de vendas inválidos no arquivo.");
  }
  if (data.goals && !Array.isArray(data.goals)) throw new Error("Metas inválidas no arquivo.");
}

type StoreValue = {
  data: AppData;
  dispatch: React.Dispatch<Action>;
  newId: (prefix?: string) => string;
};

const StoreContext = React.createContext<StoreValue | null>(null);

/**
 * O estado financeiro pertence ao Ninho (workspace do banco de contas).
 * Cada login lê e grava o mesmo workspace; convidados do plano compartilhado
 * enxergam exatamente os dados salvos pela casa.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { workspace, account, saveWorkspace, hasAccess } = useAuth();
  const toast = useToast();
  const lastFailure = React.useRef(0);
  const [data, dispatch] = React.useReducer(
    reducer,
    workspace ?? createSeedData(),
    (seed) => normalizeAppData(seed)
  );
  const skipPersist = React.useRef(true);
  const channelRef = React.useRef<BroadcastChannel | null>(null);

  React.useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    if (!account) return;
    const saved = saveWorkspace(data);
    if (!saved && Date.now() - lastFailure.current > 8000) {
      lastFailure.current = Date.now();
      toast.push("Não foi possível salvar. O armazenamento do navegador está cheio; exporte um backup e libere espaço.", "error");
    }
    channelRef.current?.postMessage({ householdId: account.householdId, data });
    // saveWorkspace é estável por conta; evita gravar a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  React.useEffect(() => {
    if (!("BroadcastChannel" in window) || !account) return undefined;
    const channel = new BroadcastChannel("ninho-financas");
    channel.onmessage = (event: MessageEvent<{ householdId: string; data: AppData }>) => {
      if (event.data?.householdId !== account.householdId) return;
      if (event.data.data?.updatedAtISO) dispatch({ type: "SYNC_FROM_PEER", data: event.data.data });
    };
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [account]);

  const guardedDispatch = React.useCallback<React.Dispatch<Action>>(
    (action) => {
      if (!hasAccess) {
        toast.push("Seu acesso está somente leitura. Ative um plano para voltar a editar.", "warning");
        return;
      }
      dispatch(action);
    },
    [hasAccess, toast]
  );

  const value = React.useMemo<StoreValue>(
    () => ({ data, dispatch: guardedDispatch, newId }),
    [data, guardedDispatch]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = React.useContext(StoreContext);
  if (!context) throw new Error("useStore precisa estar dentro de StoreProvider");
  return context;
}
