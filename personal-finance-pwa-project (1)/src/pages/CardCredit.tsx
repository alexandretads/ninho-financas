import React from "react";
import {
  ArrowRight,
  BadgePercent,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  CreditCard,
  Info,
  Pencil,
  Percent,
  Plus,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Wallet,
} from "lucide-react";
import CategoryIcon from "../components/CategoryIcon";
import {
  Badge,
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
import type { Category, CardPurchase, CreditCardSettings, Transaction, YearMonth } from "../state/types";
import { CATEGORIES } from "../state/types";
import {
  addMonthsYM,
  currentYM,
  dueDateForMonth,
  formatDate,
  invoiceMonthForDate,
  monthLabel,
  nextInvoiceYM,
  todayISO,
} from "../lib/date";
import {
  CATEGORY_META,
  computeCommittedCents,
  computeMinimumPaymentCents,
  nextOpenInvoice,
  expandPurchaseSchedule,
  invoiceEntriesForMonth,
  invoiceStatus,
  invoiceTotalForMonth,
  invoiceTotalsByMonth,
  paidForInvoice,
  simulateInvoice,
  sumCents,
} from "../lib/finance";
import { clampInt, clampNumber, formatBRL, formatPercent } from "../lib/money";

const PURCHASE_CATEGORIES: Array<{ value: Exclude<Category, "Cartão">; label: string }> = CATEGORIES.filter(
  (category) => category !== "Cartão"
).map((category) => ({ value: category, label: CATEGORY_META[category].label }));

export default function CardCredit({ onNavigate }: { onNavigate?: (page: "transactions") => void }) {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const settings = data.cardSettings;
  const startingYM = addMonthsYM(nextInvoiceYM(settings.closingDay), -1);
  const [purchaseMonth, setPurchaseMonth] = React.useState<YearMonth>(currentYM());
  const [selectedYM, setSelectedYM] = React.useState<YearMonth>(() => {
    const next = nextOpenInvoice(data.cardPurchases, data.invoicePayments, settings);
    return next?.yearMonth ?? nextInvoiceYM(settings.closingDay);
  });
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);
  const [editingPurchase, setEditingPurchase] = React.useState<CardPurchase | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CardPurchase | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [simOpen, setSimOpen] = React.useState(false);

  const committed = computeCommittedCents(data.cardPurchases, data.invoicePayments, settings.closingDay, currentYM());
  const available = Math.max(0, settings.limitTotalCents - committed);
  const limitUsage = settings.limitTotalCents > 0 ? (committed / settings.limitTotalCents) * 100 : 0;
  const invoiceMonths = Array.from({ length: 8 }, (_, index) => addMonthsYM(startingYM, index));
  const futureMonths = Array.from({ length: 6 }, (_, index) => addMonthsYM(selectedYM, index));
  const invoiceMap = invoiceTotalsByMonth(data.cardPurchases, settings.closingDay);
  const invoiceTotal = invoiceTotalForMonth(data.cardPurchases, settings.closingDay, selectedYM);
  const invoicePaid = paidForInvoice(data.invoicePayments, selectedYM);
  const invoiceRemaining = Math.max(0, invoiceTotal - invoicePaid);
  const selectedStatus = invoiceStatus(invoiceTotal, data.invoicePayments, selectedYM);
  const invoiceEntries = invoiceEntriesForMonth(data.cardPurchases, settings.closingDay, selectedYM);
  const dueDate = dueDateForMonth(selectedYM, settings.dueDay);
  const dueDays = Math.round((new Date(`${dueDate}T12:00:00`).getTime() - Date.now()) / 86_400_000);
  const isOverdue = selectedStatus !== "paid" && invoiceRemaining > 0 && dueDays < 0;

  const purchasesInMonth = data.cardPurchases
    .filter((purchase) => purchase.purchaseDateISO.startsWith(purchaseMonth))
    .sort((a, b) => b.purchaseDateISO.localeCompare(a.purchaseDateISO));
  const purchaseTotal = sumCents(purchasesInMonth.map((purchase) => purchase.amountCents));
  const paymentHistory = data.invoicePayments
    .filter((payment) => payment.invoiceYM === selectedYM)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  const installmentPurchases = data.cardPurchases
    .filter((purchase) => purchase.installments && purchase.installments.currentPart <= purchase.installments.parts)
    .sort((a, b) => b.purchaseDateISO.localeCompare(a.purchaseDateISO));

  const pendingBills = data.transactions
    .filter(
      (transaction) =>
        transaction.type === "Expense" &&
        transaction.status === "Pending" &&
        transaction.category !== "Cartão" &&
        transaction.dateISO.startsWith(purchaseMonth)
    )
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const pendingBillsTotal = sumCents(pendingBills.map((bill) => bill.amountCents));
  const purchasesInvoiceYM = invoiceMonthForDate(
    purchasesInMonth[0]?.purchaseDateISO ?? `${purchaseMonth}-15`,
    settings.closingDay
  );
  const showInvoiceRedirect = invoiceTotal <= 0 && purchasesInMonth.length > 0;

  function openNewPurchase() {
    setEditingPurchase(null);
    setPurchaseOpen(true);
  }

  function openEditPurchase(purchase: CardPurchase) {
    setEditingPurchase(purchase);
    setPurchaseOpen(true);
  }

  function savePurchase(purchase: CardPurchase) {
    if (editingPurchase) {
      dispatch({ type: "UPDATE_PURCHASE", purchase });
      toast.push("Compra atualizada.");
    } else {
      dispatch({ type: "ADD_PURCHASE", purchase });
      toast.push("Compra lançada no crédito.");
    }
    setPurchaseMonth(purchase.purchaseDateISO.slice(0, 7));
    setSelectedYM(invoiceMonthForDate(purchase.purchaseDateISO, settings.closingDay));
    setPurchaseOpen(false);
    setEditingPurchase(null);
  }

  function payInvoice(amountCents: number, dateISO: string) {
    const applied = Math.min(amountCents, Math.max(0, invoiceRemaining));
    if (applied <= 0) return;
    const transaction: Transaction = {
      id: newId("tx"),
      description: `Pagamento da conta do crédito · ${monthLabel(selectedYM)}`,
      amountCents: applied,
      dateISO,
      type: "Expense",
      category: "Cartão",
      paymentMethod: "Pix/Débito",
      status: "Paid",
    };
    const newPaid = invoicePaid + applied;
    dispatch({
      type: "PAY_INVOICE",
      tx: transaction,
      payment: {
        id: newId("pay"),
        invoiceYM: selectedYM,
        invoiceTotalCents: invoiceTotal,
        amountPaidCents: applied,
        dateISO,
        transactionId: transaction.id,
        status: newPaid >= invoiceTotal ? "paid" : "partial",
      },
    });
    toast.push(
      newPaid >= invoiceTotal
        ? "Pagamento registrado e conta quitada."
        : "Pagamento parcial registrado como lançamento."
    );
    setPayOpen(false);
  }

  return (
    <div className="page-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">Controle de crédito</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Gastos no crédito<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
            Anote o que comprou e veja exatamente o que precisa pagar.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={14} /> Ajustar ciclo
          </Button>
          <Button onClick={openNewPurchase}>
            <Plus size={15} /> Lançar compra
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 rounded-xl border p-2.5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex items-center gap-1">
          <span className="pl-1 pr-2 text-[9px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">Compras de</span>
          <IconButton label="Mês anterior das compras" onClick={() => setPurchaseMonth(addMonthsYM(purchaseMonth, -1))} className="!h-8 !w-8">
            <ChevronLeft size={15} />
          </IconButton>
          <button type="button" onClick={() => setPurchaseMonth(currentYM())} className="min-w-[118px] px-1 text-[12px] font-extrabold text-[var(--text)]" title="Voltar ao mês atual">
            {monthLabel(purchaseMonth)}
          </button>
          <IconButton label="Próximo mês das compras" onClick={() => setPurchaseMonth(addMonthsYM(purchaseMonth, 1))} className="!h-8 !w-8">
            <ChevronRight size={15} />
          </IconButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <CalendarDays size={11} /> Fecha dia {settings.closingDay}
          </span>
          <span className="chip">
            <Clock3 size={11} /> Vence dia {settings.dueDay}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSimOpen(true)}>
            <BadgePercent size={12} /> Simular encargos
          </Button>
        </div>
      </div>

      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[1fr_1.15fr]">
        <section className="panel p-4 sm:p-5">
          <SectionHeader
            title={`Compras lançadas em ${monthLabel(purchaseMonth, "short").toLowerCase()}`}
            description="Tudo o que você lançou no crédito neste mês."
            action={
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--success-soft)", color: "var(--accent)" }}>
                <ShoppingBag size={15} />
              </span>
            }
          />
          <p className="num text-[28px] font-semibold leading-none text-[var(--text)]">{formatBRL(purchaseTotal)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge dot>{purchasesInMonth.length} compra{purchasesInMonth.length === 1 ? "" : "s"}</Badge>
            {purchasesInMonth.length > 0 ? (
              <span className="text-[10px] text-[var(--muted)]">
                média de {formatBRL(Math.round(purchaseTotal / purchasesInMonth.length))}
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Parcelado em aberto</p>
              <p className="num mt-1 text-[12px] font-semibold text-[var(--text)]">
                {formatBRL(sumCents(installmentPurchases.flatMap((purchase) => expandPurchaseSchedule(purchase, settings.closingDay).map((entry) => entry.amountCents))))}
              </p>
            </div>
            <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Limite disponível</p>
              <p className="num mt-1 text-[12px] font-semibold text-[var(--text)]">{formatBRL(available)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={openNewPurchase}>
              <Plus size={14} /> Anotar compra
            </Button>
            <Button variant="secondary" onClick={() => setSelectedYM(purchasesInvoiceYM)}>
              <ReceiptText size={13} /> Conta de {monthLabel(purchasesInvoiceYM, "short")}
            </Button>
          </div>
          <p className="mt-2.5 text-[9px] leading-relaxed text-[var(--faint)]">
            Compras deste mês entram na conta conforme o fechamento do dia {settings.closingDay}. Por isso podem cair no mês seguinte.
          </p>
        </section>

        <section
          className="relative overflow-hidden rounded-[22px] border p-4 text-white sm:p-5"
          style={{
            borderColor: "var(--hero-border)",
            background: "linear-gradient(135deg, #17251a 0%, #101a13 55%, #0b120e 100%)",
            boxShadow: "0 24px 60px -34px rgba(0,0,0,.7)",
          }}
        >
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/45">Total a pagar</p>
                <p className="font-display mt-1 text-[15px] font-semibold text-white">Conta do crédito · {monthLabel(selectedYM, "long")}</p>
              </div>
              <div className="mb-1 flex items-center gap-1 self-end">
                <button type="button" aria-label="Conta anterior" onClick={() => setSelectedYM(addMonthsYM(selectedYM, -1))} className="rounded-md border border-white/10 p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"><ChevronLeft size={13} /></button>
                <span className="min-w-[76px] text-center text-[9px] font-bold text-white/55">{monthLabel(selectedYM, "short")}</span>
                <button type="button" aria-label="Próxima conta" onClick={() => setSelectedYM(addMonthsYM(selectedYM, 1))} className="rounded-md border border-white/10 p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"><ChevronRight size={13} /></button>
              </div>
              <span
                className="rounded-full border px-2.5 py-1 text-[9px] font-extrabold"
                style={
                  selectedStatus === "paid"
                    ? { borderColor: "rgba(204,245,110,.3)", background: "rgba(204,245,110,.12)", color: "#d9ff8e" }
                    : isOverdue
                      ? { borderColor: "rgba(255,144,121,.32)", background: "rgba(255,144,121,.12)", color: "#ffb3a5" }
                      : { borderColor: "rgba(255,255,255,.16)", background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.8)" }
                }
              >
                {selectedStatus === "paid"
                  ? "Paga"
                  : isOverdue
                    ? "Atrasada"
                    : selectedStatus === "partial"
                      ? "Parcial"
                      : invoiceTotal > 0
                        ? `Vence em ${dueDays} dia${dueDays === 1 ? "" : "s"}`
                        : "Sem cobranças"}
              </span>
            </div>

            <p className="num mt-4 text-[32px] font-semibold leading-none sm:text-[36px]">{formatBRL(invoiceRemaining)}</p>
            <p className="mt-2 text-[10.5px] text-white/55">
              Conta total de {formatBRL(invoiceTotal)} · vence {formatDate(dueDate, "long")}
            </p>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[9.5px] font-bold text-white/50">
                <span>Pago {formatBRL(invoicePaid)}</span>
                <span>{invoiceTotal > 0 ? Math.min(100, Math.round((invoicePaid / invoiceTotal) * 100)) : 0}%</span>
              </div>
              <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${invoiceTotal > 0 ? Math.min(100, (invoicePaid / invoiceTotal) * 100) : 0}%`,
                    background: selectedStatus === "paid" ? "#ccf56e" : "#ff9079",
                  }}
                />
              </div>
            </div>

            {showInvoiceRedirect ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-[10px] leading-relaxed text-white/65">
                  Suas {purchasesInMonth.length} compra{purchasesInMonth.length === 1 ? "" : "s"} deste mês entram na conta de{" "}
                  <strong className="text-white/90">{monthLabel(purchasesInvoiceYM, "short")}</strong>, com vencimento em{" "}
                  {formatDate(dueDateForMonth(purchasesInvoiceYM, settings.dueDay))}.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedYM(purchasesInvoiceYM)}
                  className="mt-2 flex items-center gap-1 text-[9.5px] font-extrabold"
                  style={{ color: "#ccf56e" }}
                >
                  Abrir conta de {monthLabel(purchasesInvoiceYM, "short")} <ArrowRight size={11} />
                </button>
              </div>
            ) : invoiceTotal > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setPayOpen(true)}
                  disabled={selectedStatus === "paid"}
                  className="!min-h-[36px]"
                >
                  <Wallet size={13} /> {selectedStatus === "paid" ? "Conta quitada" : "Registrar pagamento"}
                </Button>
                <span className="text-[9.5px] text-white/45">
                  {invoiceEntries.length} cobrança{invoiceEntries.length === 1 ? "" : "s"} nesta conta
                </span>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-[10px] leading-relaxed text-white/55">
                Nenhuma cobrança vence neste mês. Lance uma compra para começar a acompanhar a próxima conta.
              </p>
            )}
            {invoicePaid > 0 && selectedStatus !== "paid" ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-[9px] text-white/40">
                <Info size={10} /> Você pode registrar o restante quando pagar.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CreditKpi label="Pagamentos registrados" value={formatBRL(invoicePaid)} hint={`${paymentHistory.length} pagamento${paymentHistory.length === 1 ? "" : "s"} nesta conta`} />
        <CreditKpi label="Próxima conta" value={formatBRL(invoiceMap.get(addMonthsYM(selectedYM, 1)) ?? 0)} hint={`vence em ${monthLabel(addMonthsYM(selectedYM, 1), "short")}`} />
        <CreditKpi label="Contas fora do crédito" value={formatBRL(pendingBillsTotal)} hint={`${pendingBills.length} pendente${pendingBills.length === 1 ? "" : "s"} em ${monthLabel(purchaseMonth, "short")}`} />
        <CreditKpi label="Limite usado" value={formatBRL(committed)} hint={`${formatPercent(limitUsage)} de ${formatBRL(settings.limitTotalCents)}`} />
      </div>

      <div className="mt-4 grid items-start gap-4">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
            <SectionHeader
              title="O que você comprou"
              description={`${monthLabel(purchaseMonth, "long")} · ${purchasesInMonth.length} compra${purchasesInMonth.length === 1 ? "" : "s"} · ${formatBRL(purchaseTotal)}`}
              className="!mb-0"
            />
            <Button size="sm" variant="secondary" onClick={openNewPurchase}>
              <Plus size={12} /> Lançar compra
            </Button>
          </div>
          {purchasesInMonth.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag size={20} />}
              title="Nenhuma compra neste mês"
              description="Anote o que comprou hoje e o app calcula em qual conta cada valor vai cair."
              action={<Button size="sm" onClick={openNewPurchase}><Plus size={13} /> Lançar primeira compra</Button>}
            />
          ) : (
            <div>
              {purchasesInMonth.map((purchase, index) => {
                const invoiceYM = invoiceMonthForDate(purchase.purchaseDateISO, settings.closingDay);
                return (
                  <div
                    key={purchase.id}
                    className="flex flex-wrap items-center gap-2.5 px-4 py-3 transition hover:bg-[var(--surface-2)] sm:px-5"
                    style={index < purchasesInMonth.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                  >
                    <CategoryIcon category={purchase.category} boxSize={34} size={15} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-[var(--text)]">{purchase.description}</p>
                      <p className="mt-0.5 truncate text-[9.5px] text-[var(--muted)]">
                        {formatDate(purchase.purchaseDateISO)} · {CATEGORY_META[purchase.category].label} ·{" "}
                        {purchase.installments
                          ? `${purchase.installments.parts}x de ${formatBRL(Math.round(purchase.installments.totalCents / purchase.installments.parts))}`
                          : "à vista"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedYM(invoiceYM)}
                        className="mt-0.5 text-left text-[9px] text-[var(--faint)] transition hover:text-[var(--accent)]"
                      >
                        Entra na conta de {monthLabel(invoiceYM, "short")} · vence {formatDate(dueDateForMonth(invoiceYM, settings.dueDay))}
                      </button>
                    </div>
                    <p className="num ml-auto shrink-0 text-[12px] font-semibold text-[var(--text)]">{formatBRL(purchase.amountCents)}</p>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => openEditPurchase(purchase)}
                        aria-label={`Editar ${purchase.description}`}
                        className="rounded-md p-2.5 text-[var(--faint)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(purchase)}
                        aria-label={`Excluir ${purchase.description}`}
                        className="rounded-md p-2.5 text-[var(--faint)] transition hover:bg-[var(--coral-soft)] hover:text-[var(--coral)]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid min-w-0 items-start gap-4 sm:grid-cols-2">
          <section className="panel p-4">
            <SectionHeader
              title="Itens desta conta"
              description={`${monthLabel(selectedYM, "long")} · ${invoiceEntries.length} item${invoiceEntries.length === 1 ? "" : "s"}`}
              action={<ReceiptText size={15} className="text-[var(--coral)]" />}
            />
            {invoiceEntries.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-[10.5px] leading-relaxed text-[var(--muted)]" style={{ borderColor: "var(--border-strong)" }}>
                Nenhuma cobrança nesta conta. As compras que você lançar aparecerão aqui conforme o dia de fechamento.
              </p>
            ) : (
              <div className="space-y-2">
                {invoiceEntries.slice(0, 6).map(({ entry, purchase }) => (
                  <div key={`${entry.purchaseId}-${entry.part}`} className="flex items-center gap-2">
                    <CategoryIcon category={purchase.category} boxSize={26} size={12} rounded={8} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10.5px] font-bold text-[var(--text)]">{purchase.description}</p>
                      <p className="text-[8.5px] text-[var(--muted)]">
                        {entry.parts > 1 ? `${entry.part}/${entry.parts}` : "à vista"} · compra em {formatDate(purchase.purchaseDateISO)}
                      </p>
                    </div>
                    <span className="num shrink-0 text-[10px] font-semibold text-[var(--text-soft)]">{formatBRL(entry.amountCents)}</span>
                  </div>
                ))}
                {invoiceEntries.length > 6 ? (
                  <p className="pt-1 text-[9px] text-[var(--faint)]">+ {invoiceEntries.length - 6} outras cobranças nesta conta.</p>
                ) : null}
                <div className="mt-2 flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[10px] font-bold text-[var(--text-soft)]">Total</span>
                  <span className="num text-[11px] font-semibold text-[var(--text)]">{formatBRL(invoiceTotal)}</span>
                </div>
              </div>
            )}
          </section>

          <section className="panel p-4">
            <SectionHeader
              title="Outras contas do mês"
              description={`Pendências fora do crédito · ${monthLabel(purchaseMonth, "short")}`}
              action={<ClipboardList size={15} className="text-[var(--amber)]" />}
            />
            {pendingBills.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                  <Check size={14} />
                </span>
                <p className="text-[10px] leading-snug text-[var(--muted)]">Nenhuma conta pendente fora do crédito.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingBills.slice(0, 4).map((bill) => (
                  <div key={bill.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Marcar ${bill.description} como paga`}
                      title="Marcar como paga"
                      onClick={() => {
                        dispatch({ type: "UPDATE_TX", tx: { ...bill, status: "Paid" } });
                        toast.push(`${bill.description} marcada como paga.`);
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--faint)" }}
                    >
                      <Check size={11} />
                    </button>
                    <p className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-[var(--text)]">{bill.description}</p>
                    <span className="num shrink-0 text-[10px] font-semibold text-[var(--text-soft)]">{formatBRL(bill.amountCents)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[9.5px] font-bold text-[var(--text-soft)]">{pendingBills.length} contas pendentes</span>
                  <span className="num text-[11px] font-semibold text-[var(--amber)]">{formatBRL(pendingBillsTotal)}</span>
                </div>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {onNavigate ? (
                <>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => onNavigate("transactions")}>
                    <Plus size={12} /> Conta a pagar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onNavigate("transactions")}>
                    Ver todas <ArrowRight size={11} />
                  </Button>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[1.25fr_1fr]">
        <section className="panel p-4 sm:p-5">
          <SectionHeader
            title="Próximas contas"
            description="Quanto já está previsto para pagar em cada mês"
            action={<CalendarDays size={15} className="text-[var(--muted)]" />}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {futureMonths.map((ym, index) => {
              const total = invoiceMap.get(ym) ?? 0;
              const isSelected = ym === selectedYM;
              return (
                <button
                  key={ym}
                  type="button"
                  onClick={() => setSelectedYM(ym)}
                  className="rounded-xl border p-2.5 text-left transition hover:border-[var(--border-strong)]"
                  style={{
                    borderColor: isSelected ? "var(--accent)" : "var(--border)",
                    background: isSelected ? "var(--success-soft)" : "var(--surface-2)",
                  }}
                >
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-[var(--muted)]">
                    {index === 0 ? "Conta em foco" : monthLabel(ym, "short")}
                  </p>
                  <p className="num mt-1 text-[12px] font-semibold" style={{ color: total > 0 ? "var(--text)" : "var(--faint)" }}>
                    {total > 0 ? formatBRL(total) : "—"}
                  </p>
                  <p className="mt-0.5 text-[8px] text-[var(--faint)]">
                    {paidForInvoice(data.invoicePayments, ym) >= total && total > 0
                      ? "paga"
                      : `vence ${formatDate(dueDateForMonth(ym, settings.dueDay))}`}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <Info size={12} className="mt-0.5 shrink-0 text-[var(--muted)]" />
            <p className="text-[9px] leading-relaxed text-[var(--muted)]">
              Cada compra entra na conta conforme o fechamento (dia {settings.closingDay}). Parcelas futuras já aparecem aqui e reservam seu limite.
            </p>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3.5" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="font-display text-[13px] font-semibold text-[var(--text)]">Compras parceladas</p>
              <p className="mt-0.5 text-[9.5px] text-[var(--muted)]">{installmentPurchases.length} em andamento</p>
            </div>
            <ShieldCheck size={15} className="text-[var(--muted)]" />
          </div>
          {installmentPurchases.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag size={18} />}
              title="Nada parcelado"
              description="Compras parceladas mostram aqui o progresso e o valor que ainda falta."
              className="!py-6"
            />
          ) : (
            <div>
              {installmentPurchases.slice(0, 5).map((purchase, index) => {
                const installments = purchase.installments!;
                const paidParts = installments.currentPart - 1;
                const progress = (paidParts / installments.parts) * 100;
                const remainingCents = sumCents(expandPurchaseSchedule(purchase, settings.closingDay).map((entry) => entry.amountCents));
                return (
                  <div
                    key={purchase.id}
                    className="px-4 py-2.5"
                    style={index < Math.min(5, installmentPurchases.length) - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[10.5px] font-bold text-[var(--text)]">{purchase.description}</p>
                      <span className="num shrink-0 text-[9.5px] font-semibold text-[var(--text-soft)]">{formatBRL(remainingCents)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={progress} height={4} tone={progress >= 100 ? "accent" : "sky"} />
                      <span className="shrink-0 text-[8px] font-semibold text-[var(--faint)]">
                        {paidParts}/{installments.parts}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <PurchaseModal
        open={purchaseOpen}
        onClose={() => {
          setPurchaseOpen(false);
          setEditingPurchase(null);
        }}
        editing={editingPurchase}
        settings={settings}
        newId={newId}
        onSave={savePurchase}
      />

      <Modal
        open={simOpen}
        onClose={() => setSimOpen(false)}
        title="Simulador de encargos"
        subtitle="Veja o impacto de pagar o mínimo ou atrasar a conta."
        icon={<BadgePercent size={17} />}
        size="lg"
      >
        <div className="-mx-1">
          <Simulator
            selectedYM={selectedYM}
            purchasesCents={invoiceTotal}
            settings={settings}
            onOpenSettings={() => {
              setSimOpen(false);
              setSettingsOpen(true);
            }}
            onChangeSettings={(next) => dispatch({ type: "UPDATE_CARD_SETTINGS", settings: next })}
          />
        </div>
      </Modal>

      <CardSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={(next) => {
          dispatch({ type: "UPDATE_CARD_SETTINGS", settings: next });
          toast.push("Configurações de crédito atualizadas.");
          setSettingsOpen(false);
          setSelectedYM((current) => (invoiceMonths.includes(current) ? current : startingYM));
        }}
      />

      <PayInvoiceModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        invoiceYM={selectedYM}
        invoiceTotalCents={invoiceTotal}
        alreadyPaidCents={invoicePaid}
        dueDateISO={dueDate}
        onPay={payInvoice}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir esta compra?"
        message={`“${deleteTarget?.description ?? ""}” e todo o impacto nas próximas contas será removido.`}
        confirmText="Excluir compra"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          dispatch({ type: "DELETE_PURCHASE", id: deleteTarget.id });
          toast.push("Compra removida.");
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function CreditKpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel p-3">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">{label}</p>
      <p className="num mt-1.5 truncate text-[15px] font-semibold leading-none text-[var(--text)]">{value}</p>
      <p className="mt-1.5 line-clamp-2 text-[9px] leading-snug text-[var(--faint)]">{hint}</p>
    </div>
  );
}

function MiniLine({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  tone?: "success";
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10.5px] text-[var(--muted)]">{label}</span>
      <span
        className={`num text-[10.5px] ${strong ? "font-semibold" : "font-medium"}`}
        style={{ color: tone === "success" ? "var(--success)" : strong ? "var(--text)" : "var(--text-soft)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PurchaseModal({
  open,
  onClose,
  editing,
  settings,
  newId,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: CardPurchase | null;
  settings: CreditCardSettings;
  newId: (prefix?: string) => string;
  onSave: (purchase: CardPurchase) => void;
}) {
  const toast = useToast();
  const [description, setDescription] = React.useState("");
  const [amountCents, setAmountCents] = React.useState(0);
  const [purchaseDateISO, setPurchaseDateISO] = React.useState(todayISO());
  const [category, setCategory] = React.useState<Exclude<Category, "Cartão">>("Alimentação");
  const [installmentsEnabled, setInstallmentsEnabled] = React.useState(false);
  const [parts, setParts] = React.useState(2);
  const [currentPart, setCurrentPart] = React.useState(1);
  const [firstInstallmentDateISO, setFirstInstallmentDateISO] = React.useState(todayISO());

  function defaultFirstDue(dateISO: string) {
    const ym = invoiceMonthForDate(dateISO, settings.closingDay);
    return dueDateForMonth(ym, settings.dueDay);
  }

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setDescription(editing.description);
      setAmountCents(editing.amountCents);
      setPurchaseDateISO(editing.purchaseDateISO);
      setCategory(editing.category);
      setInstallmentsEnabled(!!editing.installments);
      setParts(editing.installments?.parts ?? 2);
      setCurrentPart(editing.installments?.currentPart ?? 1);
      setFirstInstallmentDateISO(editing.installments?.firstInstallmentDateISO ?? defaultFirstDue(editing.purchaseDateISO));
    } else {
      setDescription("");
      setAmountCents(0);
      setPurchaseDateISO(todayISO());
      setCategory("Alimentação");
      setInstallmentsEnabled(false);
      setParts(2);
      setCurrentPart(1);
      setFirstInstallmentDateISO(defaultFirstDue(todayISO()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, settings.closingDay, settings.dueDay]);

  const previewInvoiceYM = invoiceMonthForDate(purchaseDateISO, settings.closingDay);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!description.trim()) {
      toast.push("Dê um nome para a compra.", "warning");
      return;
    }
    if (amountCents <= 0) {
      toast.push("O valor precisa ser maior que zero.", "warning");
      return;
    }
    const safeParts = clampInt(parts, 2, 48);
    if (installmentsEnabled && safeParts < 2) {
      toast.push("Use pelo menos 2 parcelas.", "warning");
      return;
    }
    const purchase: CardPurchase = {
      id: editing?.id ?? newId("buy"),
      description: description.trim(),
      amountCents,
      purchaseDateISO,
      category,
      installments: installmentsEnabled
        ? {
            totalCents: amountCents,
            parts: safeParts,
            currentPart: clampInt(currentPart, 1, safeParts),
            firstInstallmentDateISO,
          }
        : undefined,
    };
    onSave(purchase);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar compra" : "Lançar compra no crédito"}
      subtitle="Informe o que comprou. O app encaixa na conta certa."
      icon={<CreditCard size={17} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="purchase-form">
            {editing ? "Salvar compra" : "Lançar compra"}
          </Button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={submit} className="space-y-4">
        <Field label="Descrição">
          <Input
            autoFocus
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex.: Notebook, mercado, farmácia..."
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor total">
            <MoneyInput valueCents={amountCents} onChangeCents={setAmountCents} tone="large" />
          </Field>
          <Field label="Data da compra">
            <Input
              type="date"
              value={purchaseDateISO}
              onChange={(event) => {
                const nextDate = event.target.value;
                setPurchaseDateISO(nextDate);
                if (/^\d{4}-\d{2}-\d{2}$/.test(nextDate) && !editing) {
                  setFirstInstallmentDateISO(defaultFirstDue(nextDate));
                }
              }}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <Select value={category} onChange={setCategory} options={PURCHASE_CATEGORIES} />
          </Field>
          <Field label="Entra na conta de" hint="Calculado pelo dia de fechamento.">
            <div className="input flex items-center gap-1.5 !py-2">
              <CalendarDays size={13} className="text-[var(--muted)]" />
              <span className="text-[12px] font-bold text-[var(--text)]">{monthLabel(previewInvoiceYM)}</span>
            </div>
          </Field>
        </div>

        <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <button
            type="button"
            onClick={() => setInstallmentsEnabled((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <p className="text-[12px] font-bold text-[var(--text)]">Compra parcelada</p>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">Distribua o valor nas próximas contas.</p>
            </div>
            <span
              className="relative h-6 w-11 shrink-0 rounded-full transition"
              style={{ background: installmentsEnabled ? "var(--accent)" : "var(--surface-3)" }}
            >
              <span
                className="absolute top-1 h-4 w-4 rounded-full transition-all"
                style={{
                  left: installmentsEnabled ? "23px" : "4px",
                  background: installmentsEnabled ? "var(--accent-ink)" : "var(--muted)",
                }}
              />
            </span>
          </button>

          {installmentsEnabled ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Nº de parcelas">
                <Input
                  type="number"
                  min={2}
                  max={48}
                  value={String(parts)}
                  onChange={(event) => setParts(Number(event.target.value))}
                />
              </Field>
              <Field label="Parcela em aberto" hint="Use 1 para compras novas.">
                <Input
                  type="number"
                  min={1}
                  max={clampInt(parts, 2, 48)}
                  value={String(currentPart)}
                  onChange={(event) => setCurrentPart(Number(event.target.value))}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Vencimento da 1ª parcela">
                  <Input
                    type="date"
                    value={firstInstallmentDateISO}
                    onChange={(event) => setFirstInstallmentDateISO(event.target.value)}
                  />
                </Field>
              </div>
              <div className="col-span-2 flex items-center gap-2 rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <Percent size={12} className="text-[var(--muted)]" />
                <p className="text-[9.5px] leading-snug text-[var(--muted)]">
                  {clampInt(parts, 2, 48)}x de aproximadamente{" "}
                  <strong className="num text-[var(--text-soft)]">
                    {formatBRL(Math.round(amountCents / clampInt(parts, 2, 48)))}
                  </strong>
                  . Parcelas futuras consomem seu limite.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <p className="flex items-start gap-2 text-[10px] leading-relaxed text-[var(--muted)]">
          <Info size={13} className="mt-0.5 shrink-0" />
          Compras no crédito não entram como despesa no orçamento até a conta ser paga. O limite é comprometido assim que você registra a compra.
        </p>
      </form>
    </Modal>
  );
}

function Simulator({
  selectedYM,
  purchasesCents,
  settings,
  onOpenSettings,
  onChangeSettings,
}: {
  selectedYM: YearMonth;
  purchasesCents: number;
  settings: CreditCardSettings;
  onOpenSettings: () => void;
  onChangeSettings: (settings: CreditCardSettings) => void;
}) {
  const defaults = settings.simulatorDefaults;
  const [mode, setMode] = React.useState<"min" | "total" | "custom">("total");
  const [customCents, setCustomCents] = React.useState(0);
  const [daysLate, setDaysLate] = React.useState(0);
  const [showPrevious, setShowPrevious] = React.useState(false);

  const minimum = computeMinimumPaymentCents({
    currentPurchasesCents: purchasesCents,
    prevRevolvingPurchasesCents: defaults.prevRevolvingCents,
    otherChargesCents: defaults.otherChargesCents,
    prevBillInstallmentCents: defaults.prevBillInstallmentCents,
  });
  const totalBase =
    purchasesCents +
    defaults.prevRevolvingCents +
    defaults.prevBillInstallmentCents +
    defaults.otherChargesCents;
  const paymentCents = mode === "total" ? totalBase : mode === "min" ? Math.min(minimum, totalBase) : clampNumber(customCents, 0, totalBase);
  const simulation = simulateInvoice({
    settings,
    purchasesCents,
    paymentCents,
    daysLate,
  });

  function updateDefaults(patch: Partial<CreditCardSettings["simulatorDefaults"]>) {
    onChangeSettings({
      ...settings,
      simulatorDefaults: { ...defaults, ...patch },
    });
  }

  return (
    <section className="panel p-4 sm:p-5">
      <SectionHeader
        title="Simulador de encargos"
        description={`Simule a conta de ${monthLabel(selectedYM, "long").toLowerCase()}`}
        action={<BadgePercent size={16} className="text-[var(--amber)]" />}
      />

      <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-[var(--muted)]">Conta estimada</p>
            <p className="num mt-1 text-[20px] font-semibold leading-none text-[var(--text)]">{formatBRL(totalBase)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-[var(--muted)]">Mínimo</p>
            <p className="num mt-1 text-[11px] font-semibold text-[var(--text-soft)]">{formatBRL(minimum)}</p>
          </div>
        </div>
        <div className="mt-3">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "min", label: "Mínimo" },
              { value: "total", label: "Tudo" },
              { value: "custom", label: "Outro" },
            ]}
          />
        </div>
        {mode === "custom" ? (
          <div className="mt-2.5">
            <MoneyInput valueCents={customCents} onChangeCents={setCustomCents} />
          </div>
        ) : null}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Field label="Dias de atraso">
            <Input
              type="number"
              min={0}
              max={365}
              value={String(daysLate)}
              onChange={(event) => setDaysLate(clampInt(Number(event.target.value), 0, 365))}
              className="!min-h-[36px]"
            />
          </Field>
          <Field label="Valor pago">
            <div className="input flex items-center !min-h-[36px] !py-1.5">
              <span className="num text-[11px] font-semibold text-[var(--text)]">{formatBRL(paymentCents)}</span>
            </div>
          </Field>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SimMetric label="Saldo não pago" value={formatBRL(simulation.unpaid)} tone="coral" />
        <SimMetric label="Rotativo (1 ciclo)" value={formatBRL(simulation.interest)} tone="amber" />
        <SimMetric label="IOF" value={formatBRL(simulation.iof)} tone="muted" />
        <SimMetric label="Multa + mora" value={formatBRL(simulation.late.totalCents)} tone="coral" />
      </div>

      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "rgba(247,200,115,.22)", background: "rgba(247,200,115,.06)" }}>
        <p className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-[var(--muted)]">Se pagar só isso, a próxima conta tende a</p>
        <p className="num mt-1.5 text-[20px] font-semibold leading-none" style={{ color: "var(--amber)" }}>
          {formatBRL(simulation.nextInvoice)}
        </p>
        <p className="mt-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
          {simulation.nextInvoice === 0
            ? "Sem rotativo: a conta seria quitada integralmente."
            : `Estimativa com ${settings.rates.rotativoMonthlyPercent.toLocaleString("pt-BR")}% de rotativo, IOF ${
                settings.iof.enabled ? "ativo" : "desligado"
              } e ${daysLate} dia${daysLate === 1 ? "" : "s"} de atraso.`}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() =>
            onChangeSettings({
              ...settings,
              iof: { ...settings.iof, enabled: !settings.iof.enabled },
            })
          }
          className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: settings.iof.enabled ? "var(--amber)" : "var(--border-strong)" }}
          />
          IOF {settings.iof.enabled ? "ligado" : "desligado"}
        </button>
        <Button variant="ghost" size="sm" onClick={onOpenSettings}>
          <Settings2 size={12} /> Taxas
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setShowPrevious((current) => !current)}
        className="mt-1 flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-[10px] font-bold text-[var(--text-soft)] transition hover:border-[var(--border-strong)]"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        Valores de contas anteriores
        <ChevronRight size={12} className={`transition-transform ${showPrevious ? "rotate-90" : ""}`} />
      </button>

      {showPrevious ? (
        <div className="mt-2 space-y-2">
          <Field label="Rotativo anterior">
            <MoneyInput valueCents={defaults.prevRevolvingCents} onChangeCents={(cents) => updateDefaults({ prevRevolvingCents: cents })} />
          </Field>
          <Field label="Parcelamento anterior">
            <MoneyInput valueCents={defaults.prevBillInstallmentCents} onChangeCents={(cents) => updateDefaults({ prevBillInstallmentCents: cents })} />
          </Field>
          <Field label="Outros encargos (IOF, juros, saque)">
            <MoneyInput valueCents={defaults.otherChargesCents} onChangeCents={(cents) => updateDefaults({ otherChargesCents: cents })} />
          </Field>
        </div>
      ) : null}

      <p className="mt-2 flex items-start gap-1.5 text-[9px] leading-relaxed text-[var(--faint)]">
        <CircleAlert size={11} className="mt-0.5 shrink-0" />
        Estimativa educativa. Os valores oficiais são definidos pela operadora do cartão.
      </p>
    </section>
  );
}

function SimMetric({ label, value, tone }: { label: string; value: string; tone: "coral" | "amber" | "muted" }) {
  const color = tone === "coral" ? "var(--coral)" : tone === "amber" ? "var(--amber)" : "var(--muted)";
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="text-[8.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--muted)]">{label}</p>
      <p className="num mt-1 text-[11.5px] font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}

function CardSettingsModal({
  open,
  onClose,
  settings,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  settings: CreditCardSettings;
  onSave: (settings: CreditCardSettings) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = React.useState<CreditCardSettings>(settings);

  React.useEffect(() => {
    if (open) {
      setDraft({
        ...settings,
        rates: { ...settings.rates },
        iof: { ...settings.iof },
        simulatorDefaults: { ...settings.simulatorDefaults },
      });
    }
  }, [open, settings]);

  function patch(patchValue: Partial<CreditCardSettings>) {
    setDraft((current) => ({ ...current, ...patchValue }));
  }

  function save() {
    if (draft.limitTotalCents <= 0) {
      toast.push("Informe um limite maior que zero.", "warning");
      return;
    }
    onSave({
      ...draft,
      closingDay: clampInt(draft.closingDay, 1, 31),
      dueDay: clampInt(draft.dueDay, 1, 31),
      rates: {
        rotativoMonthlyPercent: clampNumber(draft.rates.rotativoMonthlyPercent, 0, 200),
        billInstallmentMonthlyPercent: clampNumber(draft.rates.billInstallmentMonthlyPercent, 0, 200),
        lateMoraMonthlyPercent: clampNumber(draft.rates.lateMoraMonthlyPercent, 0, 100),
        lateFinePercent: clampNumber(draft.rates.lateFinePercent, 0, 100),
        cashAdvanceMonthlyPercent: clampNumber(draft.rates.cashAdvanceMonthlyPercent, 0, 200),
      },
      iof: {
        enabled: draft.iof.enabled,
        fixedPercent: clampNumber(draft.iof.fixedPercent, 0, 100),
        dailyPercent: clampNumber(draft.iof.dailyPercent, 0, 10),
      },
      simulatorDefaults: {
        ...draft.simulatorDefaults,
        simulateDays: clampInt(draft.simulatorDefaults.simulateDays, 1, 90),
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configurações do crédito"
      subtitle="Fechamento, vencimento, limite e taxas das simulações."
      icon={<Settings2 size={17} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar ajustes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Limite total">
          <MoneyInput
            valueCents={draft.limitTotalCents}
            onChangeCents={(cents) => patch({ limitTotalCents: cents })}
            tone="large"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de fechamento">
            <Input
              type="number"
              min={1}
              max={31}
              value={String(draft.closingDay)}
              onChange={(event) => patch({ closingDay: Number(event.target.value) })}
            />
          </Field>
          <Field label="Dia de vencimento">
            <Input
              type="number"
              min={1}
              max={31}
              value={String(draft.dueDay)}
              onChange={(event) => patch({ dueDay: Number(event.target.value) })}
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Percent size={13} className="text-[var(--muted)]" />
            <p className="text-[11px] font-extrabold text-[var(--text)]">Taxas mensais</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rotativo (%)">
              <Input type="number" step="0.01" value={String(draft.rates.rotativoMonthlyPercent)} onChange={(event) => patch({ rates: { ...draft.rates, rotativoMonthlyPercent: Number(event.target.value) } })} />
            </Field>
            <Field label="Parcelamento de conta (%)">
              <Input type="number" step="0.01" value={String(draft.rates.billInstallmentMonthlyPercent)} onChange={(event) => patch({ rates: { ...draft.rates, billInstallmentMonthlyPercent: Number(event.target.value) } })} />
            </Field>
            <Field label="Mora mensal (%)">
              <Input type="number" step="0.01" value={String(draft.rates.lateMoraMonthlyPercent)} onChange={(event) => patch({ rates: { ...draft.rates, lateMoraMonthlyPercent: Number(event.target.value) } })} />
            </Field>
            <Field label="Multa por atraso (%)">
              <Input type="number" step="0.01" value={String(draft.rates.lateFinePercent)} onChange={(event) => patch({ rates: { ...draft.rates, lateFinePercent: Number(event.target.value) } })} />
            </Field>
            <Field label="Saque / rotativo (%)">
              <Input type="number" step="0.01" value={String(draft.rates.cashAdvanceMonthlyPercent)} onChange={(event) => patch({ rates: { ...draft.rates, cashAdvanceMonthlyPercent: Number(event.target.value) } })} />
            </Field>
            <Field label="Dias da simulação de IOF">
              <Input type="number" min={1} max={90} value={String(draft.simulatorDefaults.simulateDays)} onChange={(event) => patch({ simulatorDefaults: { ...draft.simulatorDefaults, simulateDays: Number(event.target.value) } })} />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <button type="button" onClick={() => patch({ iof: { ...draft.iof, enabled: !draft.iof.enabled } })} className="flex w-full items-center justify-between">
            <div className="text-left">
              <p className="text-[11.5px] font-bold text-[var(--text)]">Incluir IOF na simulação</p>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">Fixado em 0,38% + 0,0082% ao dia.</p>
            </div>
            <span className="relative h-6 w-11 shrink-0 rounded-full transition" style={{ background: draft.iof.enabled ? "var(--accent)" : "var(--surface-3)" }}>
              <span className="absolute top-1 h-4 w-4 rounded-full transition-all" style={{ left: draft.iof.enabled ? "23px" : "4px", background: draft.iof.enabled ? "var(--accent-ink)" : "var(--muted)" }} />
            </span>
          </button>
          {draft.iof.enabled ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="IOF fixo (%)">
                <Input type="number" step="0.01" value={String(draft.iof.fixedPercent)} onChange={(event) => patch({ iof: { ...draft.iof, fixedPercent: Number(event.target.value) } })} />
              </Field>
              <Field label="IOF diário (%)">
                <Input type="number" step="0.0001" value={String(draft.iof.dailyPercent)} onChange={(event) => patch({ iof: { ...draft.iof, dailyPercent: Number(event.target.value) } })} />
              </Field>
            </div>
          ) : null}
        </div>

        <p className="flex items-start gap-2 text-[10px] leading-relaxed text-[var(--muted)]">
          <Info size={13} className="mt-0.5 shrink-0" />
          Alterações no limite e nas datas afetam o cálculo da conta e do limite comprometido de todas as compras.
        </p>
      </div>
    </Modal>
  );
}

function PayInvoiceModal({
  open,
  onClose,
  invoiceYM,
  invoiceTotalCents,
  alreadyPaidCents,
  dueDateISO,
  onPay,
}: {
  open: boolean;
  onClose: () => void;
  invoiceYM: YearMonth;
  invoiceTotalCents: number;
  alreadyPaidCents: number;
  dueDateISO: string;
  onPay: (amountCents: number, dateISO: string) => void;
}) {
  const [amountCents, setAmountCents] = React.useState(0);
  const [dateISO, setDateISO] = React.useState(todayISO());
  const remaining = Math.max(0, invoiceTotalCents - alreadyPaidCents);

  React.useEffect(() => {
    if (!open) return;
    setAmountCents(remaining);
    setDateISO(todayISO());
  }, [open, remaining]);

  const applied = Math.min(amountCents, remaining);
  const willPayAll = applied >= remaining;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar pagamento da conta"
      subtitle={`${monthLabel(invoiceYM)} · vence ${formatDate(dueDateISO)}`}
      icon={<Wallet size={17} />}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onPay(applied, dateISO)} disabled={applied <= 0}>
            Confirmar pagamento
          </Button>
        </>
      }
    >
      <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <MiniLine label="Total da conta" value={formatBRL(invoiceTotalCents)} />
        <div className="my-2 h-px" style={{ background: "var(--border)" }} />
        <MiniLine label="Já pago" value={`− ${formatBRL(alreadyPaidCents)}`} tone="success" />
        <div className="my-2 h-px" style={{ background: "var(--border)" }} />
        <MiniLine label="Falta pagar" value={formatBRL(remaining)} strong />
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Valor do pagamento" hint="Você pode registrar um pagamento parcial.">
          <MoneyInput valueCents={amountCents} onChangeCents={setAmountCents} tone="large" />
        </Field>
        {amountCents > remaining ? (
          <p className="text-[10.5px] font-semibold" style={{ color: "var(--amber)" }}>
            O valor será limitado ao saldo restante de {formatBRL(remaining)}.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data do pagamento">
            <Input type="date" value={dateISO} onChange={(event) => setDateISO(event.target.value)} />
          </Field>
          <Field label="Forma">
            <div className="input flex items-center !py-2">
              <span className="text-[12px] font-semibold text-[var(--text)]">Pix / Débito</span>
            </div>
          </Field>
        </div>

        <div
          className="flex items-start gap-2.5 rounded-xl border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
          <p className="text-[10.5px] leading-relaxed text-[var(--text-soft)]">
            {willPayAll ? "Esta conta ficará marcada como paga." : "A conta ficará como parcial até o saldo ser quitado."}{" "}
            Um lançamento de despesa na categoria <strong>Cartão</strong> será criado automaticamente com status pago.
          </p>
        </div>
      </div>
    </Modal>
  );
}
