import type {
  MoneyCents,
  SalesClosure,
  SalesEnrollment,
  SalesModality,
  SalesQuota,
  SalesState,
  YearMonth,
} from "../state/types";
import { addMonthsYM, currentYM, pad2, splitYM, todayISO, ymFromISO } from "./date";
import type { SalesState as SalesStateType } from "../state/types";

function salesId(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${suffix}`;
}

export const SALES_SETTINGS = {
  notePercentLar: 0.1288,
  notePercentMotors: 0.1538,
  taxPercent: 19.73,
  installments: 13,
  cutoffDay: 15,
  payoutDay: 10,
};

export const ENROLLMENT_WK = "enr_ademicon_wk";
export const ENROLLMENT_VT = "enr_ademicon_vt";

export const SALES_ENROLLMENT_NAMES = ["Ademicon MAT W/K", "Ademicon MAT V/T"];

export const ENROLLMENTS: SalesEnrollment[] = [
  { id: ENROLLMENT_WK, name: "Ademicon MAT W/K", code: "MAT W/K", consultant: "Karol" },
  { id: ENROLLMENT_VT, name: "Ademicon MAT V/T", code: "MAT V/T", consultant: "Victor" },
];

function currentCycleDate(day = 10) {
  return `${currentYM()}-${pad2(Math.min(day, 15))}`;
}

const seedPaid = currentCycleDate(10);

const ACTIVE_SEEDS: Array<[
  string, string, string, SalesModality, number, string, string, SalesQuota["paymentStatus"], string
]> = [
  ["Dilson Correia dos Santos", "12167", "8275", "LAR", 100000_00, "2026-02-26", "Karol", "rescheduled", "Vencimento 15/10 · reagendado"],
  ["Hamilton Vieira", "12143", "3242", "LAR", 102180_00, "2026-03-16", "Karol", "paid", "Em dia"],
  ["Felipe", "12172", "3736", "LAR", 80000_00, "2026-03-24", "Karol", "paid", "Em dia"],
  ["Felipe", "12172", "3737", "LAR", 80000_00, "2026-03-24", "Karol", "paid", "Em dia"],
  ["Jean Souza", "12000", "1489", "LAR", 84984_00, "2026-04-02", "Karol", "overdue", "Atrasado"],
  ["Clever Mattos", "12173", "8533", "LAR", 80000_00, "2026-04-11", "Karol", "rescheduled", "Acertar parcela 25/10"],
  ["Joelma Moreira", "12154", "8289", "LAR", 100000_00, "2026-04-13", "Karol", "paid", "Em dia"],
  ["Alysson Azevedo", "12174", "2470", "LAR", 150000_00, "2026-04-15", "Karol", "paid", "Em dia"],
  ["Pedro Moreira", "12184", "3110", "LAR", 80000_00, "2026-05-01", "Victor", "paid", "Em dia"],
  ["Lucas Gama", "12152", "3516", "LAR", 140000_00, "2026-05-06", "Victor", "paid", "Em dia"],
  ["Kelvin Figueredo", "12157", "3408", "LAR", 100000_00, "2026-05-08", "Victor", "rescheduled", "Vencimento 15/10 · reagendado"],
  ["Donizete Moreira", "12185", "5930", "LAR", 100000_00, "2026-05-26", "Victor", "overdue", "Atrasado"],
  ["Donizete Moreira", "12185", "5940", "LAR", 100000_00, "2026-05-26", "Victor", "overdue", "Atrasado"],
  ["Dilson Correia dos Santos", "12154", "6194", "LAR", 100000_00, "2026-06-04", "Victor", "paid", "Em dia"],
  ["Jean Carlos Euzebio Benites", "12196", "2835", "LAR", 100000_00, "2026-08-09", "Victor", "paid", "Em dia"],
];

const CANCELLED_SEEDS: Array<[string, string, string, SalesModality, number, string, string, string]> = [
  ["Ianary Assis de Oliveira", "12084", "2869", "LAR", 100000_00, "2026-02-26", "Karol", "Cancelada em 26/02/2026"],
  ["Gabriel Felipe Lopes de Oliveira", "12177", "4473", "LAR", 80000_00, "2026-02-26", "Karol", "Cancelada em 26/02/2026"],
  ["Gabriel Felipe Lopes de Oliveira", "12177", "4639", "LAR", 80000_00, "2026-02-26", "Karol", "Cancelada em 26/02/2026"],
  ["Robson Davalo Aguilera", "12150", "474", "MOTORS", 100000_00, "2026-03-11", "Victor", "Cancelada em 11/03/2026"],
];

export function createEmptySales(): SalesState {
  return {
    settings: { ...SALES_SETTINGS },
    enrollments: ENROLLMENTS.map((enrollment) => ({ ...enrollment })),
    quotas: [],
    closures: [],
  };
}

export function createSalesSeed(): SalesState {
  const quotas: SalesQuota[] = [
    ...ACTIVE_SEEDS.map(([client, group, quota, modality, creditCents, saleDateISO, consultant, paymentStatus, observation], index) => ({
      id: `sale_seed_${index}`,
      client,
      group,
      quota,
      modality,
      creditCents,
      saleDateISO,
      consultant,
      enrollmentId: consultant === "Karol" ? ENROLLMENT_WK : ENROLLMENT_VT,
      status: "active" as const,
      paymentStatus,
      paidAtISO: paymentStatus === "paid" ? seedPaid : undefined,
      observation,
    })),
    ...CANCELLED_SEEDS.map(([client, group, quota, modality, creditCents, saleDateISO, consultant, observation], index) => ({
      id: `sale_cancelled_${index}`,
      client,
      group,
      quota,
      modality,
      creditCents,
      saleDateISO,
      consultant,
      enrollmentId: consultant === "Karol" ? ENROLLMENT_WK : ENROLLMENT_VT,
      status: "cancelled" as const,
      paymentStatus: "pending" as const,
      observation,
    })),
  ];

  return {
    settings: { ...SALES_SETTINGS },
    enrollments: ENROLLMENTS.map((enrollment) => ({ ...enrollment })),
    quotas,
    closures: [],
  };
}

/* ------------------------------ Matemática ------------------------------- */

export function notePercentFor(modality: SalesModality, settings: SalesState["settings"]) {
  return modality === "MOTORS" ? settings.notePercentMotors : settings.notePercentLar;
}

/** Bruto por parcela = (crédito × % nota) ÷ 100. */
export function grossInstallmentCents(
  creditCents: MoneyCents,
  modality: SalesModality,
  settings: SalesState["settings"]
) {
  return Math.round((creditCents * notePercentFor(modality, settings)) / 100);
}

/** Líquido por parcela = bruto × (1 − imposto). */
export function netInstallmentCents(
  creditCents: MoneyCents,
  modality: SalesModality,
  settings: SalesState["settings"]
) {
  const gross = grossInstallmentCents(creditCents, modality, settings);
  return Math.round(gross * (1 - settings.taxPercent / 100));
}

export function commissionBreakdown(
  creditCents: MoneyCents,
  modality: SalesModality,
  settings: SalesState["settings"]
) {
  const notePercent = notePercentFor(modality, settings);
  const gross = grossInstallmentCents(creditCents, modality, settings);
  const net = netInstallmentCents(creditCents, modality, settings);
  const tax = gross - net;
  const installments = settings.installments;
  return {
    notePercent,
    gross,
    net,
    tax,
    installments,
    totalGross: gross * installments,
    totalNet: net * installments,
    totalTax: tax * installments,
  };
}

/** Parcela do cliente (crédito + taxa da modalidade, diluída no prazo). */
export function clientInstallmentCents(creditCents: MoneyCents, modality: SalesModality) {
  const rate = modality === "MOTORS" ? 0.162 : 0.242;
  const periods = modality === "MOTORS" ? 90 : 220;
  return Math.round((creditCents * (1 + rate)) / periods);
}

export function monthsBetween(fromYM: YearMonth, toYM: YearMonth) {
  const from = splitYM(fromYM);
  const to = splitYM(toYM);
  return (to.year - from.year) * 12 + (to.monthIndex - from.monthIndex);
}

export function installmentForMonth(quota: SalesQuota, ym: YearMonth, settings: SalesState["settings"]) {
  const offset = monthsBetween(ymFromISO(quota.saleDateISO), ym);
  // Cancelamento remove apenas parcelas futuras: o previsto histórico do mês
  // em que a cota foi cancelada (e anteriores) continua intacto.
  if (quota.status === "cancelled") {
    if (!quota.cancelledAtISO) return null;
    const cancelOffset = monthsBetween(ymFromISO(quota.saleDateISO), ymFromISO(quota.cancelledAtISO));
    if (offset > cancelOffset) return null;
  }
  if (offset < 0 || offset >= settings.installments) return null;
  return {
    part: offset + 1,
    grossCents: grossInstallmentCents(quota.creditCents, quota.modality, settings),
    netCents: netInstallmentCents(quota.creditCents, quota.modality, settings),
  };
}

export function commissionSchedule(quota: SalesQuota, settings: SalesState["settings"]) {
  const start = ymFromISO(quota.saleDateISO);
  return Array.from({ length: settings.installments }, (_, index) => {
    const yearMonth = addMonthsYM(start, index);
    const gross = grossInstallmentCents(quota.creditCents, quota.modality, settings);
    const net = netInstallmentCents(quota.creditCents, quota.modality, settings);
    return { part: index + 1, yearMonth, grossCents: gross, netCents: net };
  });
}

export function projectedCommissionForMonth(
  sales: SalesState,
  ym: YearMonth,
  enrollmentId?: string
) {
  const quotas = sales.quotas.filter(
    (quota) => !enrollmentId || quota.enrollmentId === enrollmentId
  );
  let gross = 0;
  let net = 0;
  let activeCount = 0;
  for (const quota of quotas) {
    const installment = installmentForMonth(quota, ym, sales.settings);
    if (!installment) continue;
    gross += installment.grossCents;
    net += installment.netCents;
    activeCount += 1;
  }
  return { gross, net, tax: gross - net, activeCount };
}

export function projectedByEnrollment(sales: SalesState, ym: YearMonth) {
  return sales.enrollments.map((enrollment) => ({
    enrollment,
    ...projectedCommissionForMonth(sales, ym, enrollment.id),
  }));
}

export function closureNetForMonth(sales: SalesState, ym: YearMonth, enrollmentId?: string) {
  const closures = sales.closures.filter((closure) => closure.payableYM === ym);
  if (!enrollmentId) {
    return closures.reduce((total, closure) => total + closure.netCents, 0);
  }
  return closures.reduce(
    (total, closure) => total + (closure.byEnrollment[enrollmentId]?.netCents ?? 0),
    0
  );
}

export function closureGrossForMonth(sales: SalesState, ym: YearMonth, enrollmentId?: string) {
  const closures = sales.closures.filter((closure) => closure.payableYM === ym);
  if (!enrollmentId) return closures.reduce((total, closure) => total + closure.grossCents, 0);
  return closures.reduce(
    (total, closure) => total + (closure.byEnrollment[enrollmentId]?.grossCents ?? 0),
    0
  );
}

export function receivedCommissionForMonth(sales: SalesState, ym: YearMonth, enrollmentId?: string) {
  return sales.closures
    .filter((closure) => closure.status === "received" && closure.payableYM === ym)
    .reduce(
      (total, closure) =>
        total + (enrollmentId ? closure.byEnrollment[enrollmentId]?.netCents ?? 0 : closure.netCents),
      0
    );
}

/** Chaves ciclo + cota já consolidadas — cada ciclo libera 1 das 13 parcelas. */
export function closedInstallmentKeys(sales: SalesState) {
  return new Set(
    sales.closures.flatMap((closure) => closure.quotaIds.map((id) => `${closure.cycleYM}:${id}`))
  );
}

function installmentExists(quota: SalesQuota, cycleYM: YearMonth, settings: SalesState["settings"]) {
  const offset = monthsBetween(ymFromISO(quota.saleDateISO), cycleYM);
  return quota.status === "active" && offset >= 0 && offset < settings.installments;
}

/**
 * Cotas que entram no lote deste ciclo:
 * - ativas, com o pagamento do cliente marcado como PAGO;
 * - ainda com parcela de comissão disponível (1/13 por ciclo);
 * - essa mesma cota ainda não consolidada no ciclo correspondente.
 *
 * Uma cota paga em meses diferentes pode liberar parcelas diferentes da
 * comissão — o vínculo é (cota, ciclo), não apenas a cota.
 */
export function eligibleForCycle(sales: SalesState) {
  const closed = closedInstallmentKeys(sales);
  return sales.quotas.filter((quota) => {
    if (quota.status !== "active" || quota.paymentStatus !== "paid") return false;
    const cycleYM = cycleMonthForQuota(quota, sales.settings);
    if (!installmentExists(quota, cycleYM, sales.settings)) return false;
    return !closed.has(`${cycleYM}:${quota.id}`);
  });
}

export function paidAfterCutoff(sales: SalesState) {
  const closed = closedInstallmentKeys(sales);
  return sales.quotas.filter((quota) => {
    if (quota.status !== "active" || quota.paymentStatus !== "paid") return false;
    if (!quota.paidAtISO) return false;
    if (Number(quota.paidAtISO.slice(8, 10)) <= sales.settings.cutoffDay) return false;
    const installmentCycle = cycleMonthForQuota(quota, sales.settings);
    return !closed.has(`${installmentCycle}:${quota.id}`) && installmentExists(quota, installmentCycle, sales.settings);
  });
}

export function cycleSummary(sales: SalesState) {
  const active = sales.quotas.filter((quota) => quota.status === "active");
  const eligible = eligibleForCycle(sales);
  const grossCents = eligible.reduce(
    (total, quota) => total + grossInstallmentCents(quota.creditCents, quota.modality, sales.settings),
    0
  );
  const netCents = eligible.reduce(
    (total, quota) => total + netInstallmentCents(quota.creditCents, quota.modality, sales.settings),
    0
  );
  const overdue = active.filter((quota) => quota.paymentStatus === "overdue");
  const pending = active.filter((quota) => quota.paymentStatus !== "paid");
  const paid = active.filter((quota) => quota.paymentStatus === "paid");
  const afterCutoff = paidAfterCutoff(sales);
  return {
    activeCount: active.length,
    paidCount: paid.length,
    afterCutoffCount: afterCutoff.length,
    eligible,
    grossCents,
    netCents,
    taxCents: grossCents - netCents,
    overdueCount: overdue.length,
    overdueCreditCents: overdue.reduce((total, quota) => total + quota.creditCents, 0),
    pendingCount: pending.length,
    pendingCreditCents: pending.reduce((total, quota) => total + quota.creditCents, 0),
  };
}

/**
 * Ciclo de uma cota paga: pagamentos até o dia de corte entram no ciclo do
 * próprio mês; pagamentos depois do corte entram no ciclo seguinte.
 */
export function cycleMonthForQuota(quota: SalesQuota, settings: SalesState["settings"]): YearMonth {
  const paidYM = ymFromISO(quota.paidAtISO ?? `${currentYM()}-${pad2(settings.cutoffDay)}`);
  const paidDay = Number((quota.paidAtISO ?? "").slice(8, 10)) || settings.cutoffDay;
  return paidDay > settings.cutoffDay ? addMonthsYM(paidYM, 1) : paidYM;
}

/** Agrupa as cotas por ciclo e gera uma renda a receber por ciclo. */
export function buildClosures(sales: SalesState, eligible: SalesQuota[]): SalesClosure[] {
  const groups = new Map<YearMonth, SalesQuota[]>();
  for (const quota of eligible) {
    const cycle = cycleMonthForQuota(quota, sales.settings);
    groups.set(cycle, [...(groups.get(cycle) ?? []), quota]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cycle, quotas]) => buildClosure(sales, cycle, quotas));
}

export function buildClosure(
  sales: SalesState,
  cycleYM: YearMonth,
  eligible: SalesQuota[]
): SalesClosure {
  const payableYM = addMonthsYM(cycleYM, 1);
  const byEnrollment: SalesClosure["byEnrollment"] = {};
  let grossCents = 0;
  let netCents = 0;

  for (const quota of eligible) {
    const gross = grossInstallmentCents(quota.creditCents, quota.modality, sales.settings);
    const net = netInstallmentCents(quota.creditCents, quota.modality, sales.settings);
    grossCents += gross;
    netCents += net;
    const current = byEnrollment[quota.enrollmentId] ?? { grossCents: 0, netCents: 0 };
    byEnrollment[quota.enrollmentId] = {
      grossCents: current.grossCents + gross,
      netCents: current.netCents + net,
    };
  }

  const { year, monthIndex } = splitYM(payableYM);
  return {
    id: salesId("close"),
    cycleYM,
    payableYM,
    dueDateISO: `${year}-${pad2(monthIndex + 1)}-${pad2(sales.settings.payoutDay)}`,
    grossCents,
    taxCents: grossCents - netCents,
    netCents,
    quotaIds: eligible.map((quota) => quota.id),
    byEnrollment,
    status: "scheduled",
    createdAtISO: new Date().toISOString(),
    transactionId: "",
  };
}

export function modalLabel(modality: SalesModality) {
  return modality === "LAR" ? "LAR" : "MOTORS";
}

export function saleCycleLabel(dateISO = todayISO()) {
  return currentCycleDate(10).slice(0, 7) || ymFromISO(dateISO);
}

export function nextPayoutLabel(payoutDay = 10) {
  const ym = addMonthsYM(currentYM(), 1);
  const { year, monthIndex } = splitYM(ym);
  return `${pad2(monthIndex + 1)}/${year} · dia ${pad2(payoutDay)}`;
}


/** Normaliza vendas vindas de backups/convites antigos ou malformados. */
export function normalizeSalesState(input: unknown): SalesStateType {
  const fallback = createEmptySales();
  if (!input || typeof input !== "object") return fallback;
  const raw = input as Partial<SalesStateType>;
  const settings = raw.settings && typeof raw.settings === "object"
    ? { ...fallback.settings, ...raw.settings }
    : fallback.settings;
  return {
    settings,
    enrollments: Array.isArray(raw.enrollments) && raw.enrollments.length ? raw.enrollments : fallback.enrollments,
    quotas: Array.isArray(raw.quotas) ? raw.quotas : [],
    closures: Array.isArray(raw.closures) ? raw.closures : [],
  };
}
