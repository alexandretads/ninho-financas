import React from "react";
import {
  AlertCircle,
  BadgePercent,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Landmark,
  LockKeyhole,
  Plus,
  ReceiptText,
  Search,
  SearchX,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  MoneyInput,
  ProgressBar,
  SectionHeader,
  Select,
} from "../components/ui";
import { useToast } from "../components/Toast";
import { useStore } from "../state/store";
import { SUPPORT_EMAIL, useAuth } from "../state/auth";
import type { SalesClosure, SalesModality, SalesPaymentStatus, SalesQuota } from "../state/types";
import {
  addMonthsYM,
  currentYM,
  formatDate,
  monthLabel,
  splitYM,
  todayISO,
} from "../lib/date";
import { formatBRL, formatPercent } from "../lib/money";
import {
  buildClosures,
  clientInstallmentCents,
  commissionBreakdown,
  commissionSchedule,
  cycleSummary,
  eligibleForCycle,
  closureNetForMonth,
  cycleMonthForQuota,
  netInstallmentCents,
  projectedByEnrollment,
  projectedCommissionForMonth,
} from "../lib/sales";

type QuotaFilter = "all" | "active" | "cancelled" | SalesPaymentStatus;

const STATUS_META: Record<SalesPaymentStatus | "cancelled", { label: string; tone: string; bg: string; color: string }> = {
  paid: { label: "Pago", tone: "accent", bg: "var(--success-soft)", color: "var(--success)" },
  overdue: { label: "Atrasado", tone: "coral", bg: "var(--coral-soft)", color: "var(--coral)" },
  pending: { label: "Pendente", tone: "amber", bg: "rgba(247,200,115,.1)", color: "var(--amber)" },
  rescheduled: { label: "Reagendado", tone: "sky", bg: "rgba(125,211,252,.09)", color: "var(--sky)" },
  cancelled: { label: "Cancelada", tone: "neutral", bg: "var(--surface-3)", color: "var(--faint)" },
};

function statusOf(quota: SalesQuota) {
  return quota.status === "cancelled" ? "cancelled" : quota.paymentStatus;
}

function initials(name: string) {
  return name
    .replace(/"/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function SalesWorkspace() {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const sales = data.sales!;
  const [enrollmentId, setEnrollmentId] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<QuotaFilter>("all");
  const [modality, setModality] = React.useState<"all" | SalesModality>("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [cancelTarget, setCancelTarget] = React.useState<SalesQuota | null>(null);
  const [detailQuota, setDetailQuota] = React.useState<SalesQuota | null>(null);
  const [receiveTarget, setReceiveTarget] = React.useState<SalesClosure | null>(null);

  const cycle = cycleSummary(sales);
  const lastClosure = sales.closures
    .slice()
    .sort((a, b) => b.payableYM.localeCompare(a.payableYM))[0];
  const currentProjection = projectedCommissionForMonth(
    sales,
    currentYM(),
    enrollmentId === "all" ? undefined : enrollmentId
  );
  const enrollmentProjection = projectedByEnrollment(sales, currentYM());
  const filteredQuotas = sales.quotas
    .filter((quota) => enrollmentId === "all" || quota.enrollmentId === enrollmentId)
    .filter((quota) => modality === "all" || quota.modality === modality)
    .filter((quota) => {
      if (filter === "all") return true;
      if (filter === "active") return quota.status === "active";
      if (filter === "cancelled") return quota.status === "cancelled";
      return quota.status === "active" && quota.paymentStatus === filter;
    })
    .filter((quota) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return `${quota.client} ${quota.group} ${quota.quota} ${quota.consultant} ${quota.observation}`
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => b.saleDateISO.localeCompare(a.saleDateISO));

  const totalCredit = sales.quotas
    .filter((quota) => quota.status === "active")
    .reduce((total, quota) => total + quota.creditCents, 0);
  const activeCount = sales.quotas.filter((quota) => quota.status === "active").length;
  const selectedEnrollment = sales.enrollments.find((enrollment) => enrollment.id === enrollmentId);
  const chartMonths = Array.from({ length: 10 }, (_, index) => addMonthsYM(currentYM(), index - 5));
  const chartMax = Math.max(
    1,
    ...chartMonths.map((ym) => {
      const projected = projectedCommissionForMonth(sales, ym, enrollmentId === "all" ? undefined : enrollmentId).net;
      const confirmed = closureNetForMonth(sales, ym, enrollmentId === "all" ? undefined : enrollmentId);
      return Math.max(projected, confirmed);
    })
  );

  function updateQuota(quota: SalesQuota, patch: Partial<SalesQuota>, message: string) {
    dispatch({ type: "UPDATE_SALE_QUOTA", quota: { ...quota, ...patch } });
    toast.push(message);
  }

  function markPaid(quota: SalesQuota) {
    updateQuota(quota, { paymentStatus: "paid", paidAtISO: todayISO() }, `${quota.client} marcado como pago.`);
  }

  function confirmCloseCycle() {
    const eligible = eligibleForCycle(sales);
    if (!eligible.length) {
      toast.push("Nenhuma cota paga e ainda não consolidada para fechar o ciclo.", "warning");
      return;
    }
    // Cada cota pertence ao ciclo do mês em que foi paga (ou ao seguinte, se
    // o pagamento passou do corte). Fechar com atraso mantém a data correta.
    const closures = buildClosures(sales, eligible);
    for (const closure of closures) {
      const transactionId = newId("tx");
      const transaction = {
        id: transactionId,
        description: `Comissão de vendas · ${monthLabel(closure.payableYM)} · ${closure.quotaIds.length} cotas`,
        amountCents: closure.netCents,
        dateISO: closure.dueDateISO,
        type: "Income" as const,
        category: "Outros" as const,
        paymentMethod: "Pix/Débito" as const,
        status: "Pending" as const,
      };
      dispatch({ type: "CLOSE_SALES_CYCLE", closure: { ...closure, transactionId }, tx: transaction });
    }
    setCloseOpen(false);
    const total = closures.reduce((sum, closure) => sum + closure.netCents, 0);
    const first = closures[0];
    const payableMonth = splitYM(first.payableYM).monthIndex + 1;
    toast.push(
      closures.length === 1
        ? `Ciclo encerrado! Renda de ${formatBRL(total)} lançada para recebimento no dia ${String(sales.settings.payoutDay).padStart(2, "0")}/${String(payableMonth).padStart(2, "0")}.`
        : `${closures.length} ciclos encerrados! Total de ${formatBRL(total)} lançado entre ${formatDate(first.dueDateISO)} e ${formatDate(closures[closures.length - 1].dueDateISO)}.`
    );
  }

  function receiveClosure(closure: SalesClosure) {
    dispatch({ type: "RECEIVE_SALES_CLOSURE", closureId: closure.id, receivedAtISO: todayISO() });
    setReceiveTarget(null);
    toast.push(`Renda de ${formatBRL(closure.netCents)} marcada como recebida.`);
  }

  return (
    <div className="page-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">CRM de comissões</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Vendas & renda<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
            Cada cota, cada parcela de comissão, conciliada com a renda do casal.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="lg" className="self-start sm:self-auto">
          <Plus size={16} /> Acrescentar venda
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-2 rounded-xl border p-2.5 sm:flex-row sm:items-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Landmark size={15} className="shrink-0 text-[var(--accent)]" />
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--faint)]">Renda parametrizada</p>
            <p className="truncate text-[11px] font-bold text-[var(--text)]">
              {selectedEnrollment ? selectedEnrollment.name : "Todas as matrículas"}
            </p>
          </div>
        </div>
        <div className="sm:w-[250px]">
          <Select
            ariaLabel="Selecionar matrícula de renda"
            value={enrollmentId}
            onChange={setEnrollmentId}
            options={[
              { value: "all", label: "Todas as matrículas" },
              ...sales.enrollments.map((enrollment) => ({
                value: enrollment.id,
                label: `${enrollment.name} · ${enrollment.consultant}`,
              })),
            ]}
            className="!min-h-[38px]"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SalesKpi
          label="Previsto neste mês"
          value={formatBRL(currentProjection.net)}
          hint={`${formatBRL(currentProjection.gross)} bruto · imposto ${formatBRL(currentProjection.tax)}`}
          icon={<TrendingUp size={15} />}
          color="var(--accent)"
          soft="var(--success-soft)"
        />
        <SalesKpi
          label="A consolidar"
          value={`${cycle.eligible.length} cotas`}
          hint={`${formatBRL(cycle.netCents)} líquido no ciclo`}
          icon={<FileCheck2 size={15} />}
          color="var(--sky)"
          soft="rgba(125,211,252,.09)"
        />
        <SalesKpi
          label="Atrasadas"
          value={`${cycle.overdueCount} cotas`}
          hint={`${formatBRL(cycle.overdueCreditCents)} em crédito em risco`}
          icon={<AlertCircle size={15} />}
          color="var(--coral)"
          soft="var(--coral-soft)"
        />
        <SalesKpi
          label="Cotas ativas"
          value={`${activeCount}`}
          hint={`${formatBRL(totalCredit)} de crédito vendido`}
          icon={<Users size={15} />}
          color="var(--violet)"
          soft="rgba(196,181,253,.1)"
        />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.6fr_0.85fr]">
        <div className="min-w-0 space-y-4">
          <section
            className="hero rounded-[22px] p-4 sm:p-5"
            style={{ background: "linear-gradient(135deg, #17251a 0%, #101a13 55%, #0b120e 100%)" }}
          >
            <div className="hero-content flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-white/65">
                    <Clock3 size={11} /> Ciclo atual · {monthLabel(currentYM())}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10.5px] font-bold text-white/55">
                    corte dia {sales.settings.cutoffDay} · pagamento dia {sales.settings.payoutDay}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/40">Liberado para receber</p>
                    <p className="num mt-1 text-[27px] font-semibold leading-none text-white sm:text-[32px]">
                      {formatBRL(cycle.netCents)}
                    </p>
                    <p className="mt-1.5 text-[10px] text-white/45">
                      líquido · {formatBRL(cycle.grossCents)} bruto · {formatBRL(cycle.taxCents)} de imposto
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.07em] text-white/40">Cotas pagas</p>
                      <p className="num mt-1 text-[14px] font-semibold text-[#d9ff8e]">{cycle.paidCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.07em] text-white/40">Pendentes</p>
                      <p className="num mt-1 text-[14px] font-semibold text-[#ffad9d]">{cycle.pendingCount}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full shrink-0 lg:w-[265px]">
                <p className="mb-2 text-[10.5px] font-bold leading-relaxed text-white/50">
                  {cycle.eligible.length === 0
                    ? lastClosure
                      ? `Tudo consolidado. Última renda agendada para ${formatDate(lastClosure.dueDateISO, "long")}.`
                      : "Marque as cotas como pagas para liberar o lote do dia 15."
                    : `As cotas pagas serão consolidadas em ${monthLabel(cycleMonthForQuota(cycle.eligible[0], sales.settings), "long")} e pagas no dia ${sales.settings.payoutDay}.`}
                </p>
                <button
                  type="button"
                  onClick={() => setCloseOpen(true)}
                  disabled={cycle.eligible.length === 0}
                  className="flex min-h-[43px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ background: "#ccf56e", color: "#17200d" }}
                >
                  <FileCheck2 size={15} />
                  {cycle.eligible.length === 0 ? "Nenhum ciclo em aberto" : "Fechar ciclo (dia 15)"}
                </button>
                <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-white/35">
                  <LockKeyhole size={9} /> renda prevista permanece intacta
                </p>
                {cycle.afterCutoffCount > 0 ? (
                  <p className="mt-1.5 text-center text-[10.5px] leading-relaxed text-white/40">
                    {cycle.afterCutoffCount} cota{cycle.afterCutoffCount === 1 ? "" : "s"} paga{cycle.afterCutoffCount === 1 ? "" : "s"} após o dia {sales.settings.cutoffDay} entra no próximo ciclo.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="panel p-4 sm:p-5">
            <SectionHeader
              title="Previsto x confirmado"
              description={`${selectedEnrollment?.name ?? "Todas as matrículas"} · comissão líquida mês a mês`}
              action={<Badge tone="accent" dot>13 parcelas</Badge>}
            />
            <div className="scrollbar-none -mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex min-w-[560px] items-end gap-1.5 sm:gap-2" style={{ height: 210 }}>
                {chartMonths.map((ym) => {
                  const projected = projectedCommissionForMonth(
                    sales,
                    ym,
                    enrollmentId === "all" ? undefined : enrollmentId
                  ).net;
                  const confirmed = closureNetForMonth(
                    sales,
                    ym,
                    enrollmentId === "all" ? undefined : enrollmentId
                  );
                  const isCurrent = ym === currentYM();
                  return (
                    <div key={ym} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                      <div className="flex flex-1 items-end justify-center gap-1">
                        <div
                          className="w-[42%] rounded-t-[4px] transition-all"
                          style={{
                            height: `${Math.max(2, (projected / chartMax) * 100)}%`,
                            background: isCurrent ? "var(--accent)" : "var(--accent)",
                            opacity: isCurrent ? 1 : 0.42,
                          }}
                          title={`Previsto ${monthLabel(ym)}: ${formatBRL(projected)}`}
                        />
                        <div
                          className="w-[42%] rounded-t-[4px] transition-all"
                          style={{
                            height: `${Math.max(2, (confirmed / chartMax) * 100)}%`,
                            background: "var(--coral)",
                            opacity: confirmed ? 0.85 : 0.18,
                          }}
                          title={`Confirmado ${monthLabel(ym)}: ${formatBRL(confirmed)}`}
                        />
                      </div>
                      <span
                        className="mt-2 truncate text-center text-[10px] font-bold uppercase"
                        style={{ color: isCurrent ? "var(--text)" : "var(--faint)" }}
                      >
                        {monthLabel(ym, "short").slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--muted)]">
                <span className="h-2 w-2 rounded-sm" style={{ background: "var(--accent)" }} /> Previsto (soma das cotas)
              </span>
              <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--muted)]">
                <span className="h-2 w-2 rounded-sm" style={{ background: "var(--coral)" }} /> Confirmado (ciclos fechados)
              </span>
              <span className="ml-auto text-[10px] text-[var(--faint)]">
                {formatBRL(chartMax)} = maior barra
              </span>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
              <SectionHeader
                title="Cotas e clientes"
                description={`${filteredQuotas.length} de ${sales.quotas.length} cotas · comissão por parcela`}
                className="!mb-0"
              />
              <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus size={12} /> Nova venda
              </Button>
            </div>
            <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:px-5" style={{ borderColor: "var(--border)" }}>
              <div className="relative min-w-0 flex-1">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  aria-label="Buscar cotas"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar cliente, grupo, cota..."
                  className="!min-h-[36px] !pl-8"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:w-[265px]">
                <Select
                  ariaLabel="Filtrar modalidade"
                  value={modality}
                  onChange={setModality}
                  options={[
                    { value: "all", label: "Modalidades" },
                    { value: "LAR", label: "LAR" },
                    { value: "MOTORS", label: "MOTORS" },
                  ]}
                  className="!min-h-[36px]"
                />
                <Select
                  ariaLabel="Filtrar status da cota"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: "Todos status" },
                    { value: "active", label: "Ativas" },
                    { value: "paid", label: "Pagas" },
                    { value: "overdue", label: "Atrasadas" },
                    { value: "pending", label: "Pendentes" },
                    { value: "rescheduled", label: "Reagendadas" },
                    { value: "cancelled", label: "Canceladas" },
                  ]}
                  className="!min-h-[36px]"
                />
              </div>
            </div>

            {filteredQuotas.length === 0 ? (
              <EmptyState
                icon={<SearchX size={20} />}
                title="Nenhuma cota encontrada"
                description="Ajuste a busca ou os filtros para ver outras vendas."
                action={<Button size="sm" variant="secondary" onClick={() => { setQuery(""); setFilter("all"); setModality("all"); setEnrollmentId("all"); }}>Limpar filtros</Button>}
              />
            ) : (
              <div>
                {filteredQuotas.map((quota, index) => {
                  const status = statusOf(quota);
                  const meta = STATUS_META[status];
                  const net = netInstallmentCents(quota.creditCents, quota.modality, sales.settings);
                  const enrollment = sales.enrollments.find((item) => item.id === quota.enrollmentId);
                  return (
                    <div
                      key={quota.id}
                      className="flex flex-wrap items-center gap-2.5 px-4 py-3 transition hover:bg-[var(--surface-2)] sm:px-5"
                      style={index < filteredQuotas.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-display text-[10px] font-bold"
                        style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: meta.color, opacity: quota.status === "cancelled" ? 0.5 : 1 }}
                      >
                        {initials(quota.client)}
                      </span>
                      <button type="button" onClick={() => setDetailQuota(quota)} className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[11.5px] font-bold text-[var(--text)]">{quota.client}</p>
                          <span className="text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: meta.color }}>{meta.label}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                          {enrollment?.code} · Grupo {quota.group} · Cota {quota.quota} · {quota.consultant}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--faint)]">{quota.observation}</p>
                      </button>
                      <div className="hidden text-right sm:block">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)]">{quota.modality} · crédito</p>
                        <p className="num mt-0.5 text-[10.5px] font-semibold text-[var(--text-soft)]">{formatBRL(quota.creditCents)}</p>
                      </div>
                      <div className="text-right">
                        <p className="num text-[11px] font-semibold" style={{ color: quota.status === "cancelled" ? "var(--faint)" : "var(--text)" }}>
                          {formatBRL(net)}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-[var(--faint)]">líq./parcela</p>
                      </div>
                      {quota.status === "active" ? (
                        <div className="flex shrink-0 items-center gap-1">
                          {quota.paymentStatus !== "paid" ? (
                            <button
                              type="button"
                              onClick={() => markPaid(quota)}
                              title="Marcar como pago"
                              className="rounded-lg border px-2 py-1.5 text-[10px] font-extrabold transition hover:brightness-110"
                              style={{ borderColor: "rgba(185,239,125,.24)", background: "var(--success-soft)", color: "var(--success)" }}
                            >
                              <Check size={10} className="mr-0.5 inline" /> Pago
                            </button>
                          ) : (
                            <span className="chip !py-1 !text-[10px]" title="Pago neste ciclo">
                              <CheckCircle2 size={10} /> pago
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => updateQuota(quota, { paymentStatus: "overdue" }, `Cota de ${quota.client} marcada como atrasada.`)}
                            title="Marcar como atrasado"
                            className="rounded-lg p-2.5 transition hover:bg-[var(--coral-soft)]"
                            style={{ color: quota.paymentStatus === "overdue" ? "var(--coral)" : "var(--faint)" }}
                          >
                            <AlertCircle size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelTarget(quota)}
                            title="Cancelar cota"
                            className="rounded-lg p-2.5 transition hover:bg-[var(--coral-soft)] hover:text-[var(--coral)]"
                            style={{ color: "var(--faint)" }}
                          >
                            <XCircle size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="chip !py-1 !text-[10px]" style={{ color: "var(--faint)" }}>histórico</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="panel p-4">
            <SectionHeader
              title="Renda por matrícula"
              description={`Previsão de ${monthLabel(currentYM(), "long").toLowerCase()}`}
              action={<Landmark size={15} className="text-[var(--accent)]" />}
            />
            <div className="space-y-3">
              {enrollmentProjection.map(({ enrollment, gross, net, tax, activeCount: quotas }) => (
                <button
                  key={enrollment.id}
                  type="button"
                  onClick={() => setEnrollmentId(enrollment.id)}
                  className="w-full rounded-xl border p-3 text-left transition hover:border-[var(--border-strong)]"
                  style={{
                    borderColor: enrollmentId === enrollment.id ? "var(--accent)" : "var(--border)",
                    background: enrollmentId === enrollment.id ? "var(--success-soft)" : "var(--surface-2)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10.5px] font-bold text-[var(--text)]">{enrollment.name}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">{enrollment.consultant} · {quotas} cotas ativas</p>
                    </div>
                    <span className="num text-[13px] font-semibold text-[var(--text)]">{formatBRL(net)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--faint)]">
                    <span>Bruto {formatBRL(gross)}</span>
                    <span>Imposto {formatBRL(tax)}</span>
                  </div>
                  <ProgressBar className="mt-2" height={4} value={gross ? (net / gross) * 100 : 0} tone="accent" />
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <BadgePercent size={13} className="shrink-0 text-[var(--muted)]" />
              <p className="text-[10px] leading-relaxed text-[var(--muted)]">
                Nota {formatPercent(sales.settings.notePercentLar, 4)} LAR e {formatPercent(sales.settings.notePercentMotors, 4)} MOTORS · imposto {formatPercent(sales.settings.taxPercent, 2)}.
              </p>
            </div>
          </section>

          <section className="panel p-4">
            <SectionHeader
              title="Renda a receber"
              description={`${sales.closures.length} ciclo${sales.closures.length === 1 ? "" : "s"} fechado${sales.closures.length === 1 ? "" : "s"}`}
              action={<CalendarClock size={15} className="text-[var(--amber)]" />}
            />
            {sales.closures.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: "var(--border-strong)" }}>
                <p className="text-[10px] leading-relaxed text-[var(--muted)]">
                  Feche o ciclo do dia 15 para agendar a primeira renda para o mês seguinte, no dia {sales.settings.payoutDay}.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sales.closures
                  .slice()
                  .sort((a, b) => b.payableYM.localeCompare(a.payableYM))
                  .map((closure) => (
                    <div key={closure.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">
                            {closure.status === "received" ? "Recebida" : "Agendada"}
                          </p>
                          <p className="num mt-1 text-[14px] font-semibold text-[var(--text)]">{formatBRL(closure.netCents)}</p>
                          <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                            {formatDate(closure.dueDateISO, "long")} · {closure.quotaIds.length} cotas
                          </p>
                        </div>
                        <Badge tone={closure.status === "received" ? "accent" : "amber"} dot>
                          {closure.status === "received" ? "recebido" : "a receber"}
                        </Badge>
                      </div>
                      {closure.status === "scheduled" ? (
                        <Button size="sm" variant="secondary" className="mt-2.5 w-full" onClick={() => setReceiveTarget(closure)}>
                          <CheckCircle2 size={12} /> Marcar como recebido
                        </Button>
                      ) : (
                        <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold" style={{ color: "var(--success)" }}>
                          <Check size={10} /> lançado na renda do mês
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex gap-2">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
              <div>
                <p className="text-[10.5px] font-bold text-[var(--text)]">Previsto imutável</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
                  O fechamento cria uma renda a receber, mas não altera a projeção histórica. Cancelar remove só as parcelas futuras. Cada ciclo libera 1 das 13 parcelas; após fechar, a cota volta a pendente para o próximo mês.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <QuotaModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(quota) => {
          dispatch({ type: "ADD_SALE_QUOTA", quota });
          setAddOpen(false);
          toast.push(`Venda de ${quota.client} acrescentada. Comissão recalculada em 13 parcelas.`);
        }}
        newId={newId}
      />

      <QuotaDetail
        quota={detailQuota}
        onClose={() => setDetailQuota(null)}
        onPaid={(quota) => { markPaid(quota); setDetailQuota(null); }}
        onOverdue={(quota) => { updateQuota(quota, { paymentStatus: "overdue" }, "Cota marcada como atrasada."); setDetailQuota(null); }}
        onCancel={(quota) => { setDetailQuota(null); setCancelTarget(quota); }}
      />

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Fechar ciclo de comissões"
        subtitle={`Consolidação das cotas pagas até o dia ${sales.settings.cutoffDay}.`}
        icon={<ReceiptText size={17} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>Cancelar</Button>
            <Button onClick={confirmCloseCycle}>
              <FileCheck2 size={14} /> Fechar e gerar renda
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-[var(--muted)]">Cotas pagas no ciclo (até dia {sales.settings.cutoffDay})</span>
              <span className="num font-semibold text-[var(--text)]">{cycle.eligible.length}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px]">
              <span className="text-[var(--muted)]">Comissão bruta</span>
              <span className="num font-semibold text-[var(--text)]">{formatBRL(cycle.grossCents)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px]">
              <span className="text-[var(--muted)]">Imposto ({formatPercent(sales.settings.taxPercent, 2)})</span>
              <span className="num font-semibold" style={{ color: "var(--coral)" }}>− {formatBRL(cycle.taxCents)}</span>
            </div>
            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-[var(--text)]">Renda líquida a receber</span>
                <span className="num" style={{ color: "var(--accent)" }}>{formatBRL(cycle.netCents)}</span>
              </div>
            </div>
          </div>
          {cycle.afterCutoffCount > 0 ? (
            <div className="rounded-xl border p-3" style={{ borderColor: "rgba(247,200,115,.22)", background: "rgba(247,200,115,.06)" }}>
              <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
                {cycle.afterCutoffCount} cota{cycle.afterCutoffCount === 1 ? "" : "s"} paga{cycle.afterCutoffCount === 1 ? "" : "s"} depois do corte do dia {sales.settings.cutoffDay} permanece{cycle.afterCutoffCount === 1 ? "" : "m"} para o próximo lote.
              </p>
            </div>
          ) : null}
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-[10px] font-bold text-[var(--text)]">Agendamento automático</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--muted)]">
              As cotas são agrupadas pelo ciclo do mês do pagamento e cada lote vence no dia {sales.settings.payoutDay} do mês seguinte. O lançamento fica pendente no Financeiro e a renda prevista do mês de origem não é alterada.
            </p>
          </div>
          <div className="space-y-1.5">
            {eligibleForCycle(sales).map((quota) => (
              <div key={quota.id} className="flex items-center justify-between gap-2 text-[10.5px]">
                <span className="truncate text-[var(--text-soft)]">{quota.client}</span>
                <span className="num shrink-0 text-[var(--muted)]">
                  {formatBRL(netInstallmentCents(quota.creditCents, quota.modality, sales.settings))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!receiveTarget}
        title="Confirmar recebimento?"
        message={`A renda de ${receiveTarget ? formatBRL(receiveTarget.netCents) : ""} será marcada como recebida e entrará no realizado do Financeiro.`}
        confirmText="Recebi a renda"
        danger={false}
        onCancel={() => setReceiveTarget(null)}
        onConfirm={() => receiveTarget && receiveClosure(receiveTarget)}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancelar esta cota?"
        message={`A cota de ${cancelTarget?.client ?? ""} fica no histórico e todas as 13 parcelas futuras de comissão saem da renda prevista.`}
        confirmText="Cancelar cota"
        cancelText="Manter ativa"
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (!cancelTarget) return;
          dispatch({
            type: "UPDATE_SALE_QUOTA",
            quota: { ...cancelTarget, status: "cancelled", cancelledAtISO: todayISO(), observation: `${cancelTarget.observation} · cancelada em ${formatDate(todayISO())}` },
          });
          toast.push(`Cota de ${cancelTarget.client} cancelada. Renda prevista recalculada.`);
          setCancelTarget(null);
        }}
      />
    </div>
  );
}

function SalesKpi({
  label,
  value,
  hint,
  icon,
  color,
  soft,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  color: string;
  soft: string;
}) {
  return (
    <div className="panel p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">{label}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: soft, color }}>{icon}</span>
      </div>
      <p className="num mt-2 text-[17px] font-semibold leading-none text-[var(--text)]">{value}</p>
      <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-[var(--faint)]">{hint}</p>
    </div>
  );
}

function QuotaModal({
  open,
  onClose,
  onSave,
  newId,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (quota: SalesQuota) => void;
  newId: (prefix?: string) => string;
}) {
  const { data } = useStore();
  const toast = useToast();
  const sales = data.sales!;
  const [client, setClient] = React.useState("");
  const [group, setGroup] = React.useState("");
  const [quota, setQuota] = React.useState("");
  const [modality, setModality] = React.useState<SalesModality>("LAR");
  const [creditCents, setCreditCents] = React.useState(0);
  const [saleDateISO, setSaleDateISO] = React.useState(todayISO());
  const [enrollmentId, setEnrollmentId] = React.useState(sales.enrollments[0]?.id ?? "");
  const [observation, setObservation] = React.useState("");
  const [paymentStatus, setPaymentStatus] = React.useState<SalesPaymentStatus>("pending");

  React.useEffect(() => {
    if (!open) return;
    setClient("");
    setGroup("");
    setQuota("");
    setModality("LAR");
    setCreditCents(0);
    setSaleDateISO(todayISO());
    setEnrollmentId(sales.enrollments[0]?.id ?? "");
    setObservation("");
    setPaymentStatus("pending");
  }, [open, sales.enrollments]);

  const enrollment = sales.enrollments.find((item) => item.id === enrollmentId);
  const breakdown = commissionBreakdown(creditCents, modality, sales.settings);
  const clientInstallment = clientInstallmentCents(creditCents, modality);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!client.trim() || !group.trim() || !quota.trim()) {
      toast.push("Preencha cliente, grupo e cota.", "warning");
      return;
    }
    if (creditCents <= 0) {
      toast.push("Informe o valor do crédito.", "warning");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDateISO)) {
      toast.push("Informe uma data de venda válida.", "warning");
      return;
    }
    if (!enrollment) {
      toast.push("Selecione a matrícula vinculada.", "warning");
      return;
    }
    const duplicated = sales.quotas.some(
      (item) =>
        item.status === "active" &&
        item.group.trim() === group.trim() &&
        item.quota.trim() === quota.trim()
    );
    if (duplicated) {
      toast.push("Já existe uma cota ativa com esse grupo e número.", "warning");
      return;
    }
    onSave({
      id: newId("sale"),
      client: client.trim(),
      group: group.trim(),
      quota: quota.trim(),
      modality,
      creditCents,
      saleDateISO,
      enrollmentId,
      consultant: enrollment.consultant,
      status: "active",
      paymentStatus,
      paidAtISO: paymentStatus === "paid" ? todayISO() : undefined,
      observation: observation.trim() || (paymentStatus === "paid" ? "Em dia" : "Nova venda"),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Acrescentar nova venda"
      subtitle="A comissão entra automaticamente na projeção de 13 parcelas da matrícula."
      icon={<Plus size={17} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="sale-form">Salvar venda</Button>
        </>
      }
    >
      <form id="sale-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cliente"><Input autoFocus value={client} onChange={(event) => setClient(event.target.value)} placeholder="Nome completo" /></Field>
          <Field label="Atendente"><Input value={enrollment?.consultant ?? ""} readOnly /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grupo"><Input value={group} onChange={(event) => setGroup(event.target.value)} inputMode="numeric" placeholder="Ex.: 12167" /></Field>
          <Field label="Cota"><Input value={quota} onChange={(event) => setQuota(event.target.value)} inputMode="numeric" placeholder="Ex.: 8275" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modalidade">
            <Select
              value={modality}
              onChange={setModality}
              options={[{ value: "LAR", label: "LAR" }, { value: "MOTORS", label: "MOTORS" }]}
            />
          </Field>
          <Field label="Data da venda"><Input type="date" value={saleDateISO} onChange={(event) => setSaleDateISO(event.target.value)} /></Field>
        </div>
        <Field label="Valor do crédito"><MoneyInput valueCents={creditCents} onChangeCents={setCreditCents} tone="large" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Matrícula vinculada">
            <Select
              value={enrollmentId}
              onChange={setEnrollmentId}
              options={sales.enrollments.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Field>
          <Field label="Status inicial">
            <Select
              value={paymentStatus}
              onChange={setPaymentStatus}
              options={[
                { value: "pending", label: "Pendente" },
                { value: "paid", label: "Pago" },
                { value: "overdue", label: "Atrasado" },
                { value: "rescheduled", label: "Reagendado" },
              ]}
            />
          </Field>
        </div>
        <Field label="Observação"><Input value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Ex.: em dia, vencimento..." /></Field>

        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.07em] text-[var(--muted)]">Comissão calculada</p>
            <span className="chip !py-1 !text-[10px]">{formatPercent(breakdown.notePercent, 4)} nota</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-[var(--muted)]">Bruto por parcela</p>
              <p className="num text-[13px] font-semibold text-[var(--text)]">{formatBRL(breakdown.gross)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--muted)]">Líquido por parcela</p>
              <p className="num text-[13px] font-semibold" style={{ color: "var(--accent)" }}>{formatBRL(breakdown.net)}</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
            (crédito × nota) ÷ 100 = bruto · bruto × (1 − {formatPercent(sales.settings.taxPercent, 2)}) = líquido. Projeção total de {formatBRL(breakdown.totalNet)} em {sales.settings.installments} parcelas.
          </p>
          <p className="mt-1.5 text-[10.5px] text-[var(--faint)]">
            Parcela estimada do cliente: {formatBRL(clientInstallment)} · {modality === "MOTORS" ? "90" : "220"} meses. Antes da contemplação, pode variar até ×0,6.
          </p>
        </div>
      </form>
    </Modal>
  );
}

function QuotaDetail({
  quota,
  onClose,
  onPaid,
  onOverdue,
  onCancel,
}: {
  quota: SalesQuota | null;
  onClose: () => void;
  onPaid: (quota: SalesQuota) => void;
  onOverdue: (quota: SalesQuota) => void;
  onCancel: (quota: SalesQuota) => void;
}) {
  const { data } = useStore();
  if (!quota) return null;
  const sales = data.sales!;
  const enrollment = sales.enrollments.find((item) => item.id === quota.enrollmentId);
  const breakdown = commissionBreakdown(quota.creditCents, quota.modality, sales.settings);
  const schedule = commissionSchedule(quota, sales.settings);
  const status = quota.status === "cancelled" ? "cancelled" : quota.paymentStatus;
  const meta = STATUS_META[status];

  return (
    <Modal
      open={!!quota}
      onClose={onClose}
      title={quota.client}
      subtitle={`${enrollment?.name ?? ""} · ${quota.modality} · cota ${quota.quota}`}
      icon={<UserRound size={17} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {quota.status === "active" ? (
            <>
              <Button variant="secondary" onClick={() => onOverdue(quota)}><AlertCircle size={13} /> Atrasado</Button>
              {quota.paymentStatus !== "paid" ? <Button onClick={() => onPaid(quota)}><Check size={13} /> Marcar pago</Button> : null}
              <Button variant="danger" onClick={() => onCancel(quota)}><XCircle size={13} /> Cancelar</Button>
            </>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{enrollment?.code}</Badge>
          <Badge tone={meta.tone === "accent" ? "accent" : meta.tone === "coral" ? "coral" : "amber"}>{meta.label}</Badge>
          <Badge>{quota.consultant}</Badge>
          <Badge>{formatDate(quota.saleDateISO, "long")}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Crédito vendido</p>
            <p className="num mt-1 text-[16px] font-semibold text-[var(--text)]">{formatBRL(quota.creditCents)}</p>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Parcela do cliente</p>
            <p className="num mt-1 text-[16px] font-semibold text-[var(--text)]">{formatBRL(clientInstallmentCents(quota.creditCents, quota.modality))}</p>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Bruto / parcela</p>
            <p className="num mt-1 text-[13px] font-semibold text-[var(--text)]">{formatBRL(breakdown.gross)}</p>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Líquido / parcela</p>
            <p className="num mt-1 text-[13px] font-semibold" style={{ color: "var(--accent)" }}>{formatBRL(breakdown.net)}</p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-bold text-[var(--text)]">Agenda de 13 parcelas</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {schedule.map((item) => (
              <div key={item.part} className="flex items-center justify-between rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--border)", background: item.part === 1 ? "var(--success-soft)" : "var(--surface-2)" }}>
                <span className="text-[10px] text-[var(--muted)]">{item.part}/{sales.settings.installments} · {monthLabel(item.yearMonth, "short")}</span>
                <span className="num text-[10px] font-semibold text-[var(--text-soft)]">{formatBRL(item.netCents)}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[10px] leading-relaxed text-[var(--muted)]">
          {quota.observation}. Imposto de {formatPercent(sales.settings.taxPercent, 2)} retido em cada parcela. Total líquido previsto: {formatBRL(breakdown.totalNet)}. A parcela paga pelo cliente é variável até a contemplação (pode chegar a ×0,6).
        </p>
      </div>
    </Modal>
  );
}


function LockedSalesModule() {
  return (
    <div className="page-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">Módulo adicional</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Vendas & Comissões<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
            Um módulo liberado pelo administrador do Ninho.
          </p>
        </div>
        <Badge tone="amber" dot>acesso bloqueado</Badge>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full" style={{ background: "radial-gradient(circle, rgba(204,245,110,.14), transparent 70%)" }} />
          <div className="relative">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--accent)" }}>
              <LockKeyhole size={20} />
            </span>
            <h2 className="font-display mt-3 text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              Este módulo ainda não está liberado para o seu Ninho
            </h2>
            <p className="mt-1.5 max-w-[540px] text-[11.5px] leading-relaxed text-[var(--muted)]">
              Controle de cotas, comissões em 13 parcelas, fechamento de ciclo no dia 15 e conciliação da renda ficam disponíveis somente após a liberação do administrador. Seus dados financeiros continuam intactos.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                "Cadastre cotas e acompanhe cada cliente",
                "Veja comissão bruta e líquida por parcela",
                "Feche o ciclo e agende a renda a receber",
                "Compare previsto x realizado por matrícula",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 rounded-xl border p-2.5 text-[10px] leading-snug text-[var(--text-soft)]" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <Check size={12} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => { window.location.hash = "overview"; }}>
                Voltar para a visão geral
              </Button>
              <Button variant="secondary" onClick={() => { window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Libera%C3%A7%C3%A3o%20do%20m%C3%B3dulo%20Vendas%20%26%20Comiss%C3%B5es&body=Ol%C3%A1%2C%20gostaria%20de%20liberar%20o%20m%C3%B3dulo%20de%20Vendas%20%26%20Comiss%C3%B5es%20no%20meu%20Ninho.`; }}>
                <Users size={13} /> Solicitar ao administrador
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="panel p-4">
            <p className="overline">Como liberar</p>
            <ol className="mt-2.5 space-y-2.5">
              {[
                { step: "1", text: "Fale com o administrador do Ninho e peça a liberação do módulo." },
                { step: "2", text: "Ele libera em Clientes → Módulo de vendas." },
                { step: "3", text: "O módulo aparece no seu menu e libera o controle de cotas e comissões." },
              ].map((item) => (
                <li key={item.step} className="flex gap-2.5">
                  <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>{item.step}</span>
                  <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">{item.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t pt-2.5 text-[8.5px] leading-relaxed text-[var(--faint)]" style={{ borderColor: "var(--border)" }}>
              A permissão é da casa: todos os logins vinculados ao mesmo Ninho herdam a liberação do titular.
            </p>
          </div>
          <div className="panel p-4">
            <SectionHeader title="Módulo protegido" description="Seus dados atuais estão seguros." className="!mb-2" />
            <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
              Lançamentos, plano do mês, crédito e metas continuam funcionando normalmente. Apenas Vendas & Comissões permanece oculto até a liberação.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function Sales() {
  const { canUseModule } = useAuth();
  if (!canUseModule("sales")) return <LockedSalesModule />;
  return <SalesWorkspace />;
}
