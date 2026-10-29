import React from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CreditCard,
  PencilLine,
  Plus,
  ReceiptText,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Page } from "../components/Layout";
import CategoryIcon from "../components/CategoryIcon";
import QuickEntry from "../components/QuickEntry";
import { CashflowChart, DonutChart, type DonutSlice } from "../components/charts";
import {
  Badge,
  Button,
  IconButton,
  ProgressBar,
  SectionHeader,
} from "../components/ui";
import { useStore } from "../state/store";
import { useAuth } from "../state/auth";
import type { YearMonth } from "../state/types";
import { CATEGORIES } from "../state/types";
import {
  addMonthsYM,
  currentYM,
  formatDate,
  formatWeekday,
  greeting,
  longToday,
  monthLabel,
  MONTHS_SHORT,
  splitYM,
  yearMonths,
} from "../lib/date";
import {
  budgetTotals,
  CATEGORY_META,
  getPlan,
  groupExpensesByCategory,
  monthTransactions,
  nextOpenInvoice,
  sumCents,
  totalsForTransactions,
  yearActuals,
} from "../lib/finance";
import { formatBRL, formatPercent } from "../lib/money";

import { projectedByEnrollment, projectedCommissionForMonth } from "../lib/sales";

export default function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { data } = useStore();
  const { account, canUseModule } = useAuth();
  const canUseSales = canUseModule("sales");
  const [selectedYM, setSelectedYM] = React.useState<YearMonth>(currentYM());

  const { year, monthIndex } = splitYM(selectedYM);
  const plan = getPlan(data.budgetPlans, year);
  const budgetMonth = plan.months[monthIndex];
  const planned = budgetTotals(budgetMonth);
  // A renda vinda das cotas ativas entra no previsto do mês em tempo real.
  const plannedSalesNet = data.sales
    ? projectedCommissionForMonth(data.sales, selectedYM).net
    : 0;
  const plannedIncomeTotal = planned.income + plannedSalesNet;
  const selectedTransactions = monthTransactions(data.transactions, selectedYM);
  const actual = totalsForTransactions(selectedTransactions);
  const balance = actual.income - actual.expense;
  const plannedBalance = plannedIncomeTotal - planned.expense;
  const budgetUsage = planned.expense > 0 ? (actual.expense / planned.expense) * 100 : actual.expense > 0 ? 100 : 0;
  const savingsRate = actual.income > 0 ? ((actual.income - actual.expense) / actual.income) * 100 : 0;
  const remainingBudget = planned.expense - actual.expense;

  const previous = totalsForTransactions(monthTransactions(data.transactions, addMonthsYM(selectedYM, -1)));
  const incomeDelta = actual.income - previous.income;
  const expenseDelta = actual.expense - previous.expense;
  const categoryData = groupExpensesByCategory(selectedTransactions);
  const donutSlices: DonutSlice[] =
    categoryData.length > 5
      ? [
          ...categoryData.slice(0, 4).map((item) => ({
            label: CATEGORY_META[item.category].label,
            valueCents: item.value,
            color: CATEGORY_META[item.category].color,
          })),
          {
            label: "Demais categorias",
            valueCents: sumCents(categoryData.slice(4).map((item) => item.value)),
            color: CATEGORY_META.Outros.color,
          },
        ]
      : categoryData.map((item) => ({
          label: CATEGORY_META[item.category].label,
          valueCents: item.value,
          color: CATEGORY_META[item.category].color,
        }));

  const budgetRows = CATEGORIES.map((category) => ({
    category,
    actualCents: sumCents(
      selectedTransactions
        .filter((transaction) => transaction.type === "Expense" && transaction.category === category)
        .map((transaction) => transaction.amountCents)
    ),
    plannedCents: budgetMonth.expense[category] ?? 0,
  }))
    .filter((row) => row.actualCents > 0 || row.plannedCents > 0)
    .sort((a, b) => b.actualCents - a.actualCents)
    .slice(0, 6);

  const pending = selectedTransactions
    .filter((transaction) => transaction.status === "Pending" && transaction.type === "Expense")
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .slice(0, 4);

  const annual = yearActuals(data, year);
  const chartData = annual.map((month) => {
    const monthBudget = budgetTotals(plan.months[month.monthIndex]);
    const monthSales = data.sales
      ? projectedCommissionForMonth(data.sales, month.ym).net
      : 0;
    return {
      label: MONTHS_SHORT[month.monthIndex],
      incomeCents: month.income,
      expenseCents: month.expense,
      plannedIncomeCents: monthBudget.income + monthSales,
      plannedExpenseCents: monthBudget.expense,
      isCurrent: month.ym === selectedYM,
      isFuture: month.ym > currentYM(),
    };
  });
  const yearRealizedIncome = sumCents(annual.map((month) => month.income));
  const yearRealizedExpense = sumCents(annual.map((month) => month.expense));
  const invoice = nextOpenInvoice(data.cardPurchases, data.invoicePayments, data.cardSettings);
  const salesProjection = canUseSales && data.sales ? projectedByEnrollment(data.sales, selectedYM) : [];
  const salesProjectedNet = sumCents(salesProjection.map((item) => item.net));
  const salesProjectedGross = sumCents(salesProjection.map((item) => item.gross));
  const salesTax = sumCents(salesProjection.map((item) => item.tax));

  const latestMonth = splitYM(currentYM());
  function shiftMonth(delta: number) {
    setSelectedYM(addMonthsYM(selectedYM, delta));
  }

  function openPlan(ym: YearMonth = selectedYM) {
    try {
      sessionStorage.setItem("ninho:plano-mes", ym);
    } catch {
      // segue sem a preferência de mês
    }
    onNavigate("plan");
  }

  const firstName = (account?.name ?? data.profile.name).trim().split(/\s+/)[0] || "você";

  return (
    <div className="page-enter">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="overline">{greeting()}</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Olá, {firstName}<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]"><span className="capitalize">{longToday().split(", ")[0]}</span>, {longToday().split(", ")[1]}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-xl border p-1"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <IconButton
              label="Mês anterior"
              onClick={() => shiftMonth(-1)}
              className="!h-[31px] !w-[31px] !rounded-lg !border-0 !bg-transparent"
            >
              <ChevronLeft size={16} />
            </IconButton>
            <button
              type="button"
              onClick={() => setSelectedYM(currentYM())}
              className="flex min-w-[124px] items-center justify-center gap-1.5 px-1 text-[12px] font-extrabold text-[var(--text)]"
              title="Voltar para o mês atual"
            >
              <CalendarDays size={13} className="text-[var(--muted)]" />
              {monthLabel(selectedYM)}
              {selectedYM === currentYM() ? (
                <span className="h-1 w-1 rounded-full" style={{ background: "var(--accent)" }} />
              ) : null}
            </button>
            <IconButton
              label="Próximo mês"
              onClick={() => shiftMonth(1)}
              className="!h-[31px] !w-[31px] !rounded-lg !border-0 !bg-transparent"
            >
              <ChevronRight size={16} />
            </IconButton>
          </div>
          <Button onClick={() => onNavigate("transactions")} className="hidden sm:inline-flex">
            <Plus size={15} /> Novo lançamento
          </Button>
        </div>
      </div>

      <QuickEntry defaultMode="transaction" className="mt-5" />

      <div className="stagger mt-4 space-y-4">
        <section className="hero rounded-[26px] p-5 sm:p-6 lg:p-7">
          <div className="hero-content grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(275px,0.7fr)] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/70">
                  <Wallet size={12} /> Saldo do mês
                </span>
                <span
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold"
                  style={
                    budgetUsage <= 100
                      ? { borderColor: "rgba(204,245,110,.24)", background: "rgba(204,245,110,.1)", color: "#d9ff8e" }
                      : { borderColor: "rgba(255,144,121,.24)", background: "rgba(255,144,121,.1)", color: "#ffad9d" }
                  }
                >
                  {budgetUsage <= 100 ? <Check size={11} /> : <CircleAlert size={11} />}
                  {budgetUsage <= 100 ? "Despesas sob controle" : "Despesas acima do orçamento"}
                </span>
              </div>

              <p
                className="num mt-4 text-[34px] font-semibold leading-none tracking-[-0.055em] sm:text-[44px]"
                style={balance < 0 ? { color: "#ffad9d" } : undefined}
              >
                {formatBRL(balance)}
              </p>
              <p className="hero-muted mt-2.5 text-[11.5px] sm:text-[12.5px]">
                Realizado em {monthLabel(selectedYM, "long")} · planejado{" "}
                <span className="font-semibold text-white/85">{formatBRL(plannedBalance)}</span>
              </p>

              <div className="mt-5 max-w-[500px]">
                <div className="flex items-center justify-between text-[10.5px] font-semibold">
                  <span className="hero-muted">Orçamento de despesas consumido</span>
                  <span className="text-white/90">{formatPercent(budgetUsage)}</span>
                </div>
                <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-white/[0.09]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, budgetUsage)}%`,
                      background: budgetUsage > 100 ? "#ff9079" : "linear-gradient(90deg, #a9dc44, #e2ff9e)",
                    }}
                  />
                </div>
                <div className="hero-muted mt-2 flex items-center justify-between text-[10px]">
                  <span>{formatBRL(actual.expense)} gastos</span>
                  <span>{formatBRL(planned.expense)} previstos</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onNavigate("transactions")} className="!min-h-[35px]">
                  <Plus size={14} /> Novo lançamento
                </Button>
                <button
                  type="button"
                  onClick={() => openPlan()}
                  className="inline-flex min-h-[35px] items-center gap-1.5 rounded-[9px] border border-white/15 bg-white/[0.055] px-3 py-1.5 text-[11.5px] font-extrabold text-white/85 transition hover:bg-white/[0.1]"
                >
                  <PencilLine size={13} /> Abrir plano do mês
                </button>
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-black/[0.14] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/70">Seu plano</span>
                <Target size={15} className="text-[#ccf56e]" />
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div
                  className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(${budgetUsage > 100 ? "#ff9079" : "#ccf56e"} ${Math.min(100, budgetUsage) * 3.6}deg, rgba(255,255,255,.08) 0deg)`,
                  }}
                >
                  <div className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full bg-[#111b14]">
                    <span className="num text-[16px] font-semibold text-white">
                      {Math.round(budgetUsage)}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">usado</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 text-white/55">
                      <ArrowDownLeft size={12} style={{ color: "#ccf56e" }} /> Entradas
                    </span>
                    <span className="num font-semibold text-white/90">{formatBRL(actual.income)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 text-white/55">
                      <ArrowUpRight size={12} style={{ color: "#ff9079" }} /> Saídas
                    </span>
                    <span className="num font-semibold text-white/90">{formatBRL(actual.expense)}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-white/55">{remainingBudget >= 0 ? "Orçamento restante" : "Excedeu"}</span>
                    <span
                      className="num font-semibold"
                      style={{ color: remainingBudget >= 0 ? "#d9ff8e" : "#ffad9d" }}
                    >
                      {formatBRL(Math.abs(remainingBudget))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            label="Receitas"
            value={formatBRL(actual.income)}
            icon={<ArrowDownLeft size={15} />}
            color="var(--accent)"
            soft="var(--success-soft)"
            delta={incomeDelta}
            deltaLabel="vs. mês anterior"
          />
          <StatCard
            label="Despesas"
            value={formatBRL(actual.expense)}
            icon={<ArrowUpRight size={15} />}
            color="var(--coral)"
            soft="var(--coral-soft)"
            delta={expenseDelta}
            deltaLabel="vs. mês anterior"
            inverse
          />
          <StatCard
            label="Taxa de economia"
            value={formatPercent(savingsRate, 0)}
            icon={<TrendingUp size={15} />}
            color="var(--sky)"
            soft="rgba(125, 211, 252, .1)"
            footnote={savingsRate >= 20 ? "Excelente ritmo" : savingsRate > 0 ? "Dá para evoluir" : "Atenção ao caixa"}
          />
          <StatCard
            label="Pendências"
            value={formatBRL(actual.pending)}
            icon={<ReceiptText size={15} />}
            color="var(--amber)"
            soft="rgba(247, 200, 115, .1)"
            footnote={`${actual.pendingCount} lançamento${actual.pendingCount === 1 ? "" : "s"} em aberto`}
          />
        </div>

        {canUseSales ? <section className="panel p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              title="Renda de vendas e comissões"
              description={`Sincronizada com as cotas ativas · ${monthLabel(selectedYM, "long")}`}
              className="!mb-0"
            />
            <div className="flex items-center gap-2">
              <Badge tone="accent" dot>13 parcelas</Badge>
              <Button size="sm" variant="secondary" onClick={() => onNavigate("sales")}>
                Gerenciar vendas <ArrowRight size={12} />
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="overline">Previsto líquido · {monthLabel(selectedYM, "short")}</p>
              <p className="num mt-1.5 text-[26px] font-semibold leading-none text-[var(--text)]">{formatBRL(salesProjectedNet)}</p>
              <p className="mt-1.5 text-[10px] text-[var(--muted)]">
                {formatBRL(salesProjectedGross)} bruto · {formatBRL(salesTax)} de imposto retido
              </p>
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:max-w-[530px] sm:grid-cols-2">
              {salesProjection.map(({ enrollment, net, activeCount: count }) => (
                <button
                  key={enrollment.id}
                  type="button"
                  onClick={() => onNavigate("sales")}
                  className="flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition hover:border-[var(--border-strong)]"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--success-soft)", color: "var(--accent)" }}>
                    <TrendingUp size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-bold text-[var(--text)]">{enrollment.name}</span>
                    <span className="block text-[10px] text-[var(--muted)]">{count} cotas ativas · {enrollment.consultant}</span>
                  </span>
                  <span className="num shrink-0 text-[11px] font-semibold text-[var(--text)]">{formatBRL(net)}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 border-t pt-2.5 text-[10px] leading-relaxed text-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
            Bruto por parcela = (crédito × % nota) ÷ 100 · líquido = bruto × (1 − imposto). Alterações de status ou cancelamento nas cotas recalculam esta renda imediatamente.
          </p>
         </section> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(290px,1fr)]">
          <section className="panel p-4 sm:p-5">
            <SectionHeader
              title="Entradas e saídas"
              description={`${year} · realizado mês a mês · tracejado = planejado`}
              action={<Badge tone="accent" dot>Ano {year}</Badge>}
            />
            <CashflowChart data={chartData} />
            <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="overline">Receitas no ano</p>
                <p className="num mt-1 text-[13px] font-semibold text-[var(--text)]">{formatBRL(yearRealizedIncome)}</p>
              </div>
              <div>
                <p className="overline">Despesas no ano</p>
                <p className="num mt-1 text-[13px] font-semibold text-[var(--text)]">{formatBRL(yearRealizedExpense)}</p>
              </div>
              <div>
                <p className="overline">Resultado</p>
                <p
                  className="num mt-1 text-[13px] font-semibold"
                  style={{ color: yearRealizedIncome - yearRealizedExpense >= 0 ? "var(--success)" : "var(--coral)" }}
                >
                  {formatBRL(yearRealizedIncome - yearRealizedExpense)}
                </p>
              </div>
            </div>
          </section>

          <section className="panel p-4 sm:p-5">
            <SectionHeader
              title="Onde o dinheiro foi"
              description={`${monthLabel(selectedYM, "long")} · por categoria`}
              action={<Sparkles size={15} className="text-[var(--accent)]" />}
            />
            <DonutChart data={donutSlices} />
            <div className="mt-4 space-y-2">
              {donutSlices.slice(0, 5).map((slice) => {
                const total = sumCents(donutSlices.map((item) => item.valueCents));
                return (
                  <div key={slice.label} className="flex items-center gap-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slice.color }} />
                    <span className="flex-1 truncate text-[11.5px] font-semibold text-[var(--text-soft)]">
                      {slice.label}
                    </span>
                    <span className="num text-[11px] font-semibold text-[var(--text)]">
                      {formatBRL(slice.valueCents)}
                    </span>
                    <span className="w-[34px] text-right text-[10px] font-semibold text-[var(--muted)]">
                      {total ? `${Math.round((slice.valueCents / total) * 100)}%` : "0%"}
                    </span>
                  </div>
                );
              })}
              {donutSlices.length === 0 ? (
                <p className="py-2 text-center text-[11.5px] text-[var(--muted)]">Nenhuma despesa neste mês.</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onNavigate("transactions")}
              className="mt-4 flex w-full items-center justify-center gap-1.5 border-t pt-3 text-[11.5px] font-extrabold text-[var(--text-soft)] transition hover:text-[var(--accent)]"
              style={{ borderColor: "var(--border)" }}
            >
              Ver todos os lançamentos <ArrowRight size={12} />
            </button>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(290px,1fr)]">
          <section className="panel p-4 sm:p-5">
            <SectionHeader
              title="Orçamento por categoria"
              description={`Planejado x realizado em ${monthLabel(selectedYM, "long").toLowerCase()}`}
              action={
                <Button variant="ghost" size="sm" onClick={() => openPlan()}>
                  <PencilLine size={12} /> Abrir plano
                </Button>
              }
            />
            <div className="grid gap-x-7 gap-y-4 sm:grid-cols-2">
              {budgetRows.map((row) => {
                const ratio = row.plannedCents > 0 ? (row.actualCents / row.plannedCents) * 100 : row.actualCents > 0 ? 100 : 0;
                const over = row.plannedCents > 0 && row.actualCents > row.plannedCents;
                return (
                  <div key={row.category}>
                    <div className="flex items-center gap-2.5">
                      <CategoryIcon category={row.category} boxSize={28} size={13} rounded={8} />
                      <span className="flex-1 truncate text-[11.5px] font-bold text-[var(--text)]">
                        {CATEGORY_META[row.category].label}
                      </span>
                      <span className="num text-[10.5px] font-semibold text-[var(--text)]">
                        {formatBRL(row.actualCents)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar
                        value={ratio}
                        tone={over ? "coral" : ratio > 80 ? "amber" : "accent"}
                        height={5}
                      />
                      <span
                        className="num w-[32px] shrink-0 text-right text-[10px] font-bold"
                        style={{ color: over ? "var(--coral)" : "var(--muted)" }}
                      >
                        {row.plannedCents > 0 ? `${Math.round(ratio)}%` : "—"}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--faint)]">
                      {row.plannedCents > 0 ? `de ${formatBRL(row.plannedCents)} planejados` : "sem limite definido"}
                    </p>
                  </div>
                );
              })}
              {budgetRows.length === 0 ? (
                <p className="text-[12px] text-[var(--muted)]">Defina limites para acompanhar seu orçamento.</p>
              ) : null}
            </div>
            <div
              className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                {budgetUsage <= 100 ? <Check size={14} /> : <CircleAlert size={14} />}
              </span>
              <p className="flex-1 text-[11px] leading-snug text-[var(--text-soft)]">
                {budgetUsage <= 100
                  ? `Restam ${formatBRL(remainingBudget)} do orçamento planejado para este mês.`
                  : `Você ultrapassou o orçamento em ${formatBRL(Math.abs(remainingBudget))}.`}
              </p>
              <Button size="sm" variant="secondary" onClick={() => openPlan()}>
                Planejar
              </Button>
            </div>
          </section>

          <div className="space-y-4">
            <section className="panel p-4 sm:p-5">
              <SectionHeader
                title="Crédito do mês"
                description={invoice ? `A pagar em ${monthLabel(invoice.yearMonth, "short")} · ${data.cardPurchases.length} compras` : "Compras e contas do crédito"}
                action={
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "var(--surface-2)", color: "var(--coral)" }}
                  >
                    <CreditCard size={15} />
                  </span>
                }
              />
              {invoice ? (
                <>
                  <p className="num text-[23px] font-semibold leading-none text-[var(--text)]">
                    {formatBRL(invoice.remainingCents)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={invoice.daysUntilDue < 5 ? "coral" : "accent"} dot>
                      Vence {formatDate(invoice.dueDateISO)}
                    </Badge>
                    <span className="text-[10.5px] text-[var(--muted)]">
                      fecha dia {data.cardSettings.closingDay}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate("card")}
                    className="mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-[11.5px] font-extrabold text-[var(--text-soft)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    Ver compras e conta <ArrowUpRight size={13} />
                  </button>
                </>
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: "var(--border-strong)" }}>
                  <p className="text-[11.5px] text-[var(--muted)]">Nenhuma conta em aberto.</p>
                  <Button variant="secondary" size="sm" className="mt-2" onClick={() => onNavigate("card")}>
                    Abrir crédito
                  </Button>
                </div>
              )}
            </section>

            <section className="panel p-4 sm:p-5">
              <SectionHeader
                title="Próximos vencimentos"
                description={`${pending.length} pendência${pending.length === 1 ? "" : "s"} no mês`}
                action={<CalendarDays size={15} className="text-[var(--amber)]" />}
              />
              <div className="space-y-2.5">
                {pending.length ? (
                  pending.map((transaction) => (
                    <div key={transaction.id} className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg border"
                        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                      >
                        <span className="num text-[11px] font-semibold leading-none text-[var(--text)]">
                          {transaction.dateISO.slice(8, 10)}
                        </span>
                        <span className="mt-0.5 text-[7px] font-bold uppercase text-[var(--faint)]">
                          {MONTHS_SHORT[Number(transaction.dateISO.slice(5, 7)) - 1]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-bold text-[var(--text)]">{transaction.description}</p>
                        <p className="mt-0.5 truncate text-[10px] capitalize text-[var(--muted)]">
                          {formatWeekday(transaction.dateISO)} · {transaction.category}
                        </p>
                      </div>
                      <span className="num shrink-0 text-[11px] font-semibold text-[var(--text-soft)]">
                        {formatBRL(transaction.amountCents)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                      <Check size={14} />
                    </span>
                    <p className="text-[11px] leading-snug text-[var(--muted)]">Tudo em dia por aqui. Nenhuma conta pendente.</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate("transactions")}
                className="mt-3 flex w-full items-center justify-center gap-1.5 border-t pt-3 text-[11px] font-extrabold text-[var(--text-soft)] transition hover:text-[var(--accent)]"
                style={{ borderColor: "var(--border)" }}
              >
                Abrir lançamentos <ArrowRight size={12} />
              </button>
            </section>
          </div>
        </div>

        <section className="panel p-4 sm:p-5">
          <SectionHeader
            title="Planejamento do ano"
            description={`Clique em um mês para ajustar receitas e despesas · ${year}`}
            action={
              <div className="flex items-center gap-1.5">
                <Badge>Projetado</Badge>
                <Badge tone="accent" dot>12 meses</Badge>
              </div>
            }
          />
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {yearMonths(year).map((ym) => {
              const index = splitYM(ym).monthIndex;
              const monthPlan = plan.months[index];
              const totals = budgetTotals(monthPlan);
              const monthSalesNet = canUseSales && data.sales
                ? projectedCommissionForMonth(data.sales, ym).net
                : 0;
              const net = totals.income + monthSalesNet - totals.expense;
              const isSelected = ym === selectedYM;
              return (
                <button
                  key={ym}
                  type="button"
                  onClick={() => {
                    setSelectedYM(ym);
                    openPlan(ym);
                  }}
                  className="min-w-[96px] flex-1 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
                  style={{
                    borderColor: isSelected ? "var(--accent)" : "var(--border)",
                    background: isSelected ? "var(--success-soft)" : "var(--surface-2)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {MONTHS_SHORT[index]}
                    </span>
                    {splitYM(currentYM()).year === year && latestMonth.monthIndex === index ? (
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                    ) : null}
                  </div>
                  <p
                    className="num mt-2 text-[11px] font-semibold"
                    style={{ color: net >= 0 ? "var(--text)" : "var(--coral)" }}
                  >
                    {totals.income > 0 || totals.expense > 0 ? formatBRL(net) : "—"}
                  </p>
                  <p className="mt-1 text-[10px] leading-tight text-[var(--faint)]">
                    {totals.expense > 0 ? `${formatBRL(totals.expense)} em despesas` : "sem plano"}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </div>

    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  soft,
  footnote,
  delta,
  deltaLabel,
  inverse = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  soft: string;
  footnote?: string;
  delta?: number;
  deltaLabel?: string;
  inverse?: boolean;
}) {
  const good = delta === undefined ? true : inverse ? delta <= 0 : delta >= 0;
  return (
    <div className="panel p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: soft, color }}
        >
          {icon}
        </span>
        {delta !== undefined ? (
          <span
            className="flex items-center gap-0.5 text-[10px] font-extrabold"
            style={{ color: good ? "var(--success)" : "var(--coral)" }}
          >
            {delta >= 0 ? "↑" : "↓"} {formatBRL(Math.abs(delta)).replace("R$", "").trim()}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--muted)]">{label}</p>
      <p className="num mt-1.5 truncate text-[17px] font-semibold leading-none text-[var(--text)] sm:text-[19px]">
        {value}
      </p>
      <p className="mt-2 truncate text-[10px] text-[var(--faint)]">{deltaLabel || footnote || "neste mês"}</p>
    </div>
  );
}
