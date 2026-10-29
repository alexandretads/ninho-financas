import React from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CopyPlus,
  Info,
  Pencil,
  Plus,
  Repeat2,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Page } from "../components/Layout";
import CategoryIcon from "../components/CategoryIcon";
import QuickEntry from "../components/QuickEntry";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  MoneyInput,
  ProgressBar,
  SectionHeader,
  Segmented,
  Select,
} from "../components/ui";
import { useToast } from "../components/Toast";
import { useStore } from "../state/store";
import { useAuth } from "../state/auth";
import type { Category, PlanItem, YearMonth } from "../state/types";
import { CATEGORIES } from "../state/types";
import {
  addMonthsYM,
  currentYM,
  dueDateForMonth,
  formatDate,
  formatWeekday,
  monthLabel,
  splitYM,
} from "../lib/date";
import {
  CATEGORY_META,
  getPlan,
  itemsForMonth,
  replicateToFuture,
  sumCents,
  withItems,
} from "../lib/finance";
import { clampInt, formatBRL, formatPercent } from "../lib/money";
import { projectedByEnrollment } from "../lib/sales";

type ItemDraft = {
  kind: "income" | "expense";
  name: string;
  amountCents: number;
  category: Category;
  day: number;
  fixed: boolean;
};

const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({
  value: category,
  label: CATEGORY_META[category].label,
}));

const EMPTY_DRAFT: ItemDraft = {
  kind: "expense",
  name: "",
  amountCents: 0,
  category: "Moradia",
  day: 10,
  fixed: true,
};

export default function Plan({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { data, dispatch, newId } = useStore();
  const { canUseModule } = useAuth();
  const canUseSales = canUseModule("sales");
  const toast = useToast();
  const [selectedYM, setSelectedYM] = React.useState<YearMonth>(() => {
    try {
      const preferred = sessionStorage.getItem("ninho:plano-mes");
      if (preferred && /^\d{4}-\d{2}$/.test(preferred)) return preferred;
    } catch {
      // usa o mês atual
    }
    return currentYM();
  });
  const [draftOpen, setDraftOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<PlanItem | null>(null);
  const [draft, setDraft] = React.useState<ItemDraft>(EMPTY_DRAFT);
  const [deleteTarget, setDeleteTarget] = React.useState<PlanItem | null>(null);
  const [replicateOpen, setReplicateOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "expense" | "income">("all");

  const { year, monthIndex } = splitYM(selectedYM);
  const plan = getPlan(data.budgetPlans, year);
  const items = itemsForMonth(plan, monthIndex);
  // As matrículas Ademicon são rendas parametrizadas: o valor vem do módulo de
  // vendas em tempo real, não de um item fixo digitado no plano.
  const sales = data.sales!;
  const enrollmentNames = new Set(sales.enrollments.map((enrollment) => enrollment.name));
  const incomeItems = items
    .filter((item) => item.kind === "income" && !enrollmentNames.has(item.name))
    .sort((a, b) => a.day - b.day);
  const expenseItems = items.filter((item) => item.kind === "expense").sort((a, b) => a.day - b.day);
  const liveSales = canUseSales ? projectedByEnrollment(sales, selectedYM) : [];
  const liveSalesNet = sumCents(liveSales.map((entry) => entry.net));
  const totalIncome = sumCents(incomeItems.map((item) => item.amountCents)) + liveSalesNet;
  const totalExpense = sumCents(expenseItems.map((item) => item.amountCents));
  const expectedBalance = totalIncome - totalExpense;
  const unpaidExpenses = expenseItems.filter((item) => !item.paid);
  const paidExpenses = expenseItems.filter((item) => item.paid);
  const toPay = sumCents(unpaidExpenses.map((item) => item.amountCents));
  const paidTotal = sumCents(paidExpenses.map((item) => item.amountCents));
  const fixedCount = items.filter((item) => item.fixed).length;
  const expenseGroups = CATEGORIES.map((category) => ({
    category,
    items: expenseItems.filter((item) => item.category === category),
    total: sumCents(expenseItems.filter((item) => item.category === category).map((item) => item.amountCents)),
  })).filter((group) => group.items.length > 0);

  const agenda = [...items].sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));

  function persistItems(nextItems: PlanItem[], propagateFixed = false) {
    let nextPlan = withItems(plan, monthIndex, nextItems);
    if (propagateFixed) {
      nextPlan = replicateToFuture(
        nextPlan,
        monthIndex,
        nextItems.filter((item) => item.fixed)
      );
    }
    dispatch({ type: "UPSERT_BUDGET_PLAN", plan: nextPlan });
  }

  function openNew(kind: "income" | "expense", category?: Category) {
    setEditingItem(null);
    setDraft({
      ...EMPTY_DRAFT,
      kind,
      category: category ?? (kind === "income" ? "Outros" : "Moradia"),
      fixed: kind === "expense",
    });
    setDraftOpen(true);
  }

  function openEdit(item: PlanItem) {
    setEditingItem(item);
    setDraft({
      kind: item.kind,
      name: item.name,
      amountCents: item.amountCents,
      category: item.category,
      day: item.day,
      fixed: item.fixed,
    });
    setDraftOpen(true);
  }

  function saveDraft() {
    if (!draft.name.trim()) {
      toast.push("Dê um nome para o item do plano.", "warning");
      return;
    }
    if (draft.amountCents <= 0) {
      toast.push("Informe um valor maior que zero.", "warning");
      return;
    }
    const nextItem: PlanItem = {
      id: editingItem?.id ?? newId("plan"),
      kind: draft.kind,
      name: draft.name.trim(),
      amountCents: draft.amountCents,
      category: draft.kind === "income" ? "Outros" : draft.category,
      day: clampInt(draft.day, 1, 31),
      fixed: draft.fixed,
      paid: editingItem?.paid ?? false,
    };
    const nextItems = editingItem
      ? items.map((item) => (item.id === editingItem.id ? nextItem : item))
      : [...items, nextItem];
    persistItems(nextItems, nextItem.fixed);
    setDraftOpen(false);
    setEditingItem(null);
    toast.push(
      draft.fixed
        ? "Item salvo e replicado como gasto fixo nos próximos meses."
        : "Item salvo no plano deste mês."
    );
  }

  function togglePaid(item: PlanItem) {
    persistItems(items.map((current) => (current.id === item.id ? { ...current, paid: !current.paid } : current)));
  }

  function replicatePrevious() {
    const previousMonth = addMonthsYM(selectedYM, -1);
    const previousYear = splitYM(previousMonth).year;
    const previousPlan = getPlan(data.budgetPlans, previousYear);
    const previousItems = itemsForMonth(previousPlan, splitYM(previousMonth).monthIndex);
    if (!previousItems.length) {
      toast.push("O mês anterior ainda não tem itens para replicar.", "warning");
      return;
    }
    const replicated = previousItems.map((item) => ({
      ...item,
      id: newId("plan"),
      paid: false,
    }));
    persistItems(replicated, false);
    setReplicateOpen(false);
    toast.push(`${replicated.length} itens copiados do mês anterior.`);
  }

  const expensesByCategoryData = expenseGroups.map((group) => ({
    label: group.category,
    value: group.total,
  }));

  return (
    <div className="page-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">Antes do mês começar</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Plano do mês<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
            Datas, valores e o que já foi pago. Cada coisa no seu tempo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border p-1" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <IconButton
              label="Mês anterior"
              onClick={() => setSelectedYM(addMonthsYM(selectedYM, -1))}
              className="!h-[31px] !w-[31px] !rounded-lg !border-0 !bg-transparent"
            >
              <ChevronLeft size={15} />
            </IconButton>
            <button type="button" onClick={() => setSelectedYM(currentYM())} className="min-w-[110px] text-[11.5px] font-extrabold text-[var(--text)]">
              {monthLabel(selectedYM)}
            </button>
            <IconButton
              label="Próximo mês"
              onClick={() => setSelectedYM(addMonthsYM(selectedYM, 1))}
              className="!h-[31px] !w-[31px] !rounded-lg !border-0 !bg-transparent"
            >
              <ChevronRight size={15} />
            </IconButton>
          </div>
          <Button variant="secondary" onClick={() => setReplicateOpen(true)}>
            <CopyPlus size={14} /> Replicar mês anterior
          </Button>
          <Button onClick={() => openNew("expense")}>
            <Plus size={15} /> Adicionar item
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.55fr_0.8fr]">
        <div className="min-w-0">
          <QuickEntry defaultMode="plan" lockMode defaultMonth={selectedYM} className="mb-4" />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PlanKpi label="A receber" value={formatBRL(totalIncome)} icon={<ArrowDownLeft size={14} />} tone="success" />
            <PlanKpi label="A pagar" value={formatBRL(totalExpense)} icon={<ArrowUpRight size={14} />} tone="coral" />
            <PlanKpi label="Saldo previsto" value={formatBRL(expectedBalance)} icon={<Wallet size={14} />} tone={expectedBalance >= 0 ? "success" : "coral"} />
            <PlanKpi label="Ainda a pagar" value={formatBRL(toPay)} icon={<CalendarClock size={14} />} tone="amber" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">Mostrar</span>
            {[
              { value: "all" as const, label: "Tudo" },
              { value: "expense" as const, label: "Só despesas" },
              { value: "income" as const, label: "Só receitas" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className="chip"
                style={{
                  background: filter === option.value ? "var(--accent)" : "var(--surface-2)",
                  borderColor: filter === option.value ? "var(--accent)" : "var(--border)",
                  color: filter === option.value ? "var(--accent-ink)" : "var(--text-soft)",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {filter !== "expense" ? <section className="panel mt-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeader
                title="Recebimentos previstos"
                description={`${incomeItems.length + liveSales.length} entradas · ${formatBRL(totalIncome)}`}
                className="!mb-0"
              />
              <Button size="sm" variant="secondary" onClick={() => openNew("income")}>
                <Plus size={12} /> Recebimento
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {liveSales.map(({ enrollment, net, activeCount }) => (
                <div
                  key={enrollment.id}
                  className="flex items-center gap-2.5 rounded-lg border p-2.5"
                  style={{ borderColor: "rgba(185,239,125,.2)", background: "var(--success-soft)" }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ background: "var(--surface)", color: "var(--accent)" }}
                  >
                    <TrendingUp size={13} />
                  </span>
                  <div className="flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <span className="num text-[10px] font-semibold leading-none text-[var(--text)]">10</span>
                    <span className="text-[10px] font-bold uppercase text-[var(--faint)]">dia</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[11px] font-bold text-[var(--text)]">{enrollment.name}</p>
                      <span className="chip chip-accent !py-0.5 !text-[7.5px]">vendas</span>
                    </div>
                    <p className="text-[10px] text-[var(--muted)]">
                      renda parametrizada · {activeCount} cota{activeCount === 1 ? "" : "s"} ativa{activeCount === 1 ? "" : "s"} · líquido
                    </p>
                  </div>
                  <span className="num shrink-0 text-[10.5px] font-semibold" style={{ color: "var(--success)" }}>
                    + {formatBRL(net)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate("sales")}
                    className="shrink-0 rounded-md p-1.5 text-[var(--muted)] transition hover:text-[var(--accent)]"
                    title="Abrir vendas e comissões"
                  >
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              ))}
              {incomeItems.length ? (
                incomeItems.map((item) => (
                  <PlanRow
                    key={item.id}
                    item={item}
                    year={year}
                    monthIndex={monthIndex}
                    onToggle={() => togglePaid(item)}
                    onEdit={() => openEdit(item)}
                    onDelete={() => setDeleteTarget(item)}
                  />
                ))
              ) : liveSales.length === 0 ? (
                <EmptyState
                  icon={<ArrowDownLeft size={19} />}
                  title="Nenhum recebimento previsto"
                  description="Adicione salário, freelas e outros valores com a data em que devem cair."
                  action={<Button size="sm" variant="secondary" onClick={() => openNew("income")}><Plus size={12} /> Adicionar</Button>}
                  className="!py-5"
                />
              ) : null}
            </div>
            {liveSales.length ? (
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                <TrendingUp size={10} style={{ color: "var(--accent)" }} />
                Rendimento calculado em tempo real pelas cotas ativas. Clique em Vendas para detalhar.
              </p>
            ) : null}
          </section> : null}

          {filter !== "income" ? <section className="panel mt-4 p-4 sm:p-5">
            <SectionHeader
              title="Despesas por módulo"
              description={`${expenseItems.length} contas · ${formatBRL(totalExpense)} previstos`}
            />

            {expenseGroups.length ? (
              <div className="space-y-4">
                {expenseGroups.map((group) => (
                  <div key={group.category} className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <CategoryIcon category={group.category} boxSize={28} size={13} rounded={8} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] font-bold text-[var(--text)]">{CATEGORY_META[group.category].label}</p>
                        <p className="text-[10px] text-[var(--muted)]">
                          {group.items.length} conta{group.items.length === 1 ? "" : "s"} · soma prevista
                        </p>
                      </div>
                      <p className="num text-[12px] font-semibold text-[var(--text)]">{formatBRL(group.total)}</p>
                      <button
                        type="button"
                        onClick={() => openNew("expense", group.category)}
                        aria-label={`Adicionar em ${group.category}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[var(--surface-3)]"
                        style={{ color: "var(--text-soft)" }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <div className="border-t px-2 pb-1 pt-1" style={{ borderColor: "var(--border)" }}>
                      {group.items.map((item) => (
                        <PlanRow
                          key={item.id}
                          item={item}
                          year={year}
                          monthIndex={monthIndex}
                          onToggle={() => togglePaid(item)}
                          onEdit={() => openEdit(item)}
                          onDelete={() => setDeleteTarget(item)}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ReceiptIcon />}
                title="Seu mês ainda está em branco"
                description="Que tal começar pelos gastos fixos? Aluguel, energia, água e internet costumam se repetir."
                action={
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openNew("expense", "Moradia")}><Plus size={12} /> Adicionar conta</Button>
                    <Button size="sm" variant="secondary" onClick={() => setReplicateOpen(true)}><CopyPlus size={12} /> Replicar</Button>
                  </div>
                }
              />
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10.5px] text-[var(--muted)]">
              <Repeat2 size={12} style={{ color: "var(--accent)" }} />
              {fixedCount} {fixedCount === 1 ? "item fixo" : "itens fixos"} se repetem automaticamente nos próximos meses.
            </div>
          </section> : null}
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="panel p-4">
            <SectionHeader
              title="Seu mês em números"
              description={monthLabel(selectedYM, "long")}
              action={<CalendarRange size={15} className="text-[var(--muted)]" />}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold text-[var(--muted)]">Contas quitadas</span>
              <span className="num text-[11px] font-semibold text-[var(--text)]">
                {paidExpenses.length}/{expenseItems.length}
              </span>
            </div>
            <ProgressBar
              className="mt-2"
              height={7}
              value={expenseItems.length ? (paidTotal / Math.max(1, totalExpense)) * 100 : 0}
              tone={paidExpenses.length === expenseItems.length && expenseItems.length > 0 ? "accent" : "amber"}
            />
            <p className="mt-2 text-[10.5px] text-[var(--muted)]">
              {expenseItems.length === 0
                ? "Sem despesas previstas."
                : toPay === 0
                  ? "Tudo pago! Você fechou o mês em dia."
                  : `Restam ${formatBRL(toPay)} em ${unpaidExpenses.length} conta${unpaidExpenses.length === 1 ? "" : "s"}.`}
            </p>

            <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              {expensesByCategoryData.length ? (
                expensesByCategoryData.map((group) => (
                  <div
                    key={group.label}
                    style={{
                      width: `${(group.value / Math.max(1, totalExpense)) * 100}%`,
                      background: CATEGORY_META[group.label as Category]?.color ?? "var(--muted)",
                    }}
                    title={`${CATEGORY_META[group.label as Category]?.label}: ${formatBRL(group.value)}`}
                  />
                ))
              ) : (
                <div className="w-full" style={{ background: "var(--surface-3)" }} />
              )}
            </div>
            <div className="mt-3 grid gap-1.5">
              {expensesByCategoryData.slice(0, 5).map((group) => (
                <div key={group.label} className="flex items-center gap-2" style={{ color: "var(--text-soft)" }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_META[group.label as Category]?.color }} />
                  <span className="flex-1 truncate text-[10.5px]">{CATEGORY_META[group.label as Category]?.label}</span>
                  <span className="num text-[10.5px] font-semibold">{formatBRL(group.value)}</span>
                  <span className="w-8 text-right text-[10px] text-[var(--faint)]">
                    {formatPercent((group.value / Math.max(1, totalExpense)) * 100, 0)}
                  </span>
                </div>
              ))}
              {!expensesByCategoryData.length ? <p className="text-[10.5px] text-[var(--muted)]">Nada por aqui ainda.</p> : null}
            </div>
            <div className="mt-4 rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-[var(--muted)]">Saldo previsto</span>
                <span className="num text-[12px] font-semibold" style={{ color: expectedBalance >= 0 ? "var(--success)" : "var(--coral)" }}>
                  {formatBRL(expectedBalance)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (totalExpense / Math.max(1, totalIncome)) * 100)}%`,
                    background: totalExpense > totalIncome ? "var(--coral)" : "var(--accent)",
                  }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-[var(--faint)]">
                {formatPercent((totalExpense / Math.max(1, totalIncome)) * 100, 0)} da renda prevista comprometida.
              </p>
            </div>
          </section>

          <section className="panel p-4">
            <SectionHeader title="Agenda do mês" description="Tudo em ordem de vencimento" action={<CalendarCheck2 size={15} className="text-[var(--accent)]" />} />
            <div className="thin-scroll max-h-[420px] space-y-0 overflow-y-auto">
              {agenda.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openEdit(item)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left transition hover:bg-[var(--surface-2)]"
                  style={index < agenda.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                >
                  <span
                    className="num flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-md"
                    style={{ background: item.paid ? "var(--success-soft)" : "var(--surface-2)", color: item.paid ? "var(--success)" : "var(--text-soft)" }}
                  >
                    <span className="text-[10px] font-semibold leading-none">{String(item.day).padStart(2, "0")}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] font-bold text-[var(--text)]">{item.name}</p>
                    <p className="text-[10px] capitalize text-[var(--muted)]">
                      {formatWeekday(dueDateForMonth(selectedYM, item.day))} · {item.kind === "income" ? "receber" : "pagar"}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[10px] font-semibold" style={{ color: item.kind === "income" ? "var(--success)" : "var(--text-soft)" }}>
                    {item.kind === "income" ? "+" : "−"} {formatBRL(item.amountCents)}
                  </span>
                  {item.paid ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} /> : <Circle size={13} style={{ color: "var(--border-strong)" }} />}
                </button>
              ))}
              {!agenda.length ? <p className="py-3 text-[10px] text-[var(--muted)]">Adicione contas e recebimentos para montar a agenda.</p> : null}
            </div>
          </section>

          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex gap-2">
              <Info size={13} className="mt-0.5 shrink-0 text-[var(--muted)]" />
              <p className="text-[10px] leading-relaxed text-[var(--muted)]">
                O plano é uma previsão e não altera o saldo. Ao pagar uma conta, toque no círculo para marcar como paga e registre a saída em Lançamentos.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={draftOpen}
        onClose={() => {
          setDraftOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? "Editar item do plano" : "Novo item no plano"}
        subtitle={`${monthLabel(selectedYM, "long")} · o valor entra apenas na previsão.`}
        icon={<CalendarClock size={17} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraftOpen(false)}>Cancelar</Button>
            <Button onClick={saveDraft}>{editingItem ? "Salvar item" : "Adicionar ao plano"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented
            value={draft.kind}
            onChange={(kind) => {
              const next = { ...draft, kind };
              setDraft(next);
            }}
            options={[
              { value: "income", label: "Recebimento" },
              { value: "expense", label: "Despesa" },
            ]}
          />
          <Field label="Nome">
            <Input
              autoFocus
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder={draft.kind === "income" ? "Ex.: Salário" : "Ex.: Aluguel"}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor previsto">
              <MoneyInput valueCents={draft.amountCents} onChangeCents={(amountCents) => setDraft({ ...draft, amountCents })} />
            </Field>
            <Field label="Dia do mês">
              <Input
                type="number"
                min={1}
                max={31}
                value={String(draft.day)}
                onChange={(event) => setDraft({ ...draft, day: Number(event.target.value) })}
              />
            </Field>
          </div>
          {draft.kind === "expense" ? (
            <Field label="Módulo / categoria">
              <Select
                value={draft.category}
                onChange={(category) => setDraft({ ...draft, category })}
                options={CATEGORY_OPTIONS}
              />
            </Field>
          ) : null}
          <button
            type="button"
            onClick={() => setDraft({ ...draft, fixed: !draft.fixed })}
            className="flex w-full items-center gap-3 rounded-xl border p-3 text-left"
            style={{ borderColor: draft.fixed ? "var(--accent)" : "var(--border)", background: draft.fixed ? "var(--success-soft)" : "var(--surface-2)" }}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-md border"
              style={{
                borderColor: draft.fixed ? "var(--accent)" : "var(--border-strong)",
                background: draft.fixed ? "var(--accent)" : "transparent",
                color: "var(--accent-ink)",
              }}
            >
              {draft.fixed ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <span>
              <span className="block text-[11px] font-bold text-[var(--text)]">
                {draft.kind === "income" ? "Recebimento recorrente" : "Gasto fixo mensal"}
              </span>
              <span className="block text-[10.5px] text-[var(--muted)]">Replica automaticamente nos próximos meses. Você não preenche de novo.</span>
            </span>
          </button>
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[10px] text-[var(--muted)]">
              Vencimento:{" "}
              <strong className="text-[var(--text)]">
                {formatDate(dueDateForMonth(selectedYM, clampInt(draft.day, 1, 31)), "long")}
              </strong>
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={replicateOpen}
        title="Replicar mês anterior?"
        message={`Vamos copiar ${monthLabel(addMonthsYM(selectedYM, -1), "long")} para ${monthLabel(selectedYM, "long")}. Os itens atuais deste mês serão substituídos e todos entram como não pagos.`}
        confirmText="Replicar itens"
        danger={false}
        onCancel={() => setReplicateOpen(false)}
        onConfirm={replicatePrevious}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remover do plano?"
        message={`“${deleteTarget?.name ?? ""}” será removido deste mês. Se for um item fixo, ele também sai dos próximos meses.`}
        confirmText="Remover"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          persistItems(items.filter((item) => item.id !== deleteTarget.id), true);
          setDeleteTarget(null);
          toast.push("Item removido do plano.");
        }}
      />
    </div>
  );
}

function PlanKpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "success" | "coral" | "amber";
}) {
  const colors = {
    success: { color: "var(--success)", soft: "var(--success-soft)" },
    coral: { color: "var(--coral)", soft: "var(--coral-soft)" },
    amber: { color: "var(--amber)", soft: "rgba(247, 200, 115, 0.1)" },
  }[tone];
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">{label}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: colors.soft, color: colors.color }}>
          {icon}
        </span>
      </div>
      <p className="num mt-2 truncate text-[15px] font-semibold leading-none text-[var(--text)] sm:text-[17px]">{value}</p>
    </div>
  );
}

function PlanRow({
  item,
  year,
  monthIndex,
  onToggle,
  onEdit,
  onDelete,
  compact = false,
}: {
  item: PlanItem;
  year: number;
  monthIndex: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`group flex items-center gap-2.5 rounded-lg ${compact ? "px-1 py-2" : "border px-2.5 py-2.5"}`} style={!compact ? { borderColor: "var(--border)", background: "var(--surface-2)" } : undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={item.paid ? `Marcar ${item.name} como pendente` : `Marcar ${item.name} como pago`}
        className="shrink-0"
        style={{ color: item.paid ? "var(--success)" : "var(--border-strong)" }}
      >
        {item.paid ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      </button>
      <div className="flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <span className="num text-[10px] font-semibold leading-none text-[var(--text)]">{String(item.day).padStart(2, "0")}</span>
        <span className="mt-0.5 text-[10px] font-bold uppercase text-[var(--faint)]">
          {formatDate(dueDateForMonth(`${year}-${String(monthIndex + 1).padStart(2, "0")}`, item.day)).split(" ")[1]}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`truncate text-[11px] font-bold ${item.paid ? "line-through opacity-60" : ""}`} style={{ color: "var(--text)" }}>
            {item.name}
          </p>
          {item.fixed ? <Repeat2 size={9} style={{ color: "var(--accent)", flexShrink: 0 }} aria-label="Gasto fixo" /> : null}
        </div>
        <p className="text-[10px] capitalize" style={{ color: "var(--muted)" }}>
          {item.kind === "income" ? "receber" : "pagar"} · {formatWeekday(dueDateForMonth(`${year}-${String(monthIndex + 1).padStart(2, "0")}`, item.day))}
        </p>
      </div>
      <span className="num shrink-0 text-[10.5px] font-semibold" style={{ color: item.kind === "income" ? "var(--success)" : "var(--text-soft)" }}>
        {item.kind === "income" ? "+" : "−"} {formatBRL(item.amountCents)}
      </span>
      <div className="flex shrink-0 items-center">
        <button type="button" onClick={onEdit} aria-label={`Editar ${item.name}`} className="rounded-md p-2.5 transition hover:bg-[var(--surface-3)]" style={{ color: "var(--faint)" }}>
          <Pencil size={11} />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Excluir ${item.name}`} className="rounded-md p-2.5 transition hover:bg-[var(--coral-soft)]" style={{ color: "var(--faint)" }}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function ReceiptIcon() {
  return <ArrowLeftRight size={19} />;
}
