import React from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Pencil,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from "lucide-react";
import CategoryIcon from "../components/CategoryIcon";
import QuickEntry from "../components/QuickEntry";
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
  SectionHeader,
  Segmented,
  Select,
} from "../components/ui";
import { useToast } from "../components/Toast";
import { useStore } from "../state/store";
import type { Category, PaymentMethod, Transaction, TransactionStatus, TransactionType, YearMonth } from "../state/types";
import { CATEGORIES, PAYMENT_METHODS } from "../state/types";
import {
  addMonthsYM,
  currentYM,
  formatDate,
  formatWeekday,
  monthLabel,
  todayISO,
} from "../lib/date";
import { CATEGORY_META, totalsForTransactions } from "../lib/finance";
import { formatBRL } from "../lib/money";

type FilterType = "all" | "income" | "expense" | "pending";

const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = CATEGORIES.map((category) => ({
  value: category,
  label: CATEGORY_META[category].label,
}));

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: method === "Cartão de Crédito" ? "Cartão de crédito (use a aba Crédito)" : method,
}));

export default function Transactions() {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const [selectedYM, setSelectedYM] = React.useState<YearMonth>(currentYM());
  const [filterType, setFilterType] = React.useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<Category | "all">("all");
  const [query, setQuery] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Transaction | null>(null);

  const monthTx = data.transactions.filter((transaction) => transaction.dateISO.startsWith(selectedYM));
  const totals = totalsForTransactions(monthTx);
  const previous = totalsForTransactions(data.transactions.filter((transaction) => transaction.dateISO.startsWith(addMonthsYM(selectedYM, -1))));

  const filtered = monthTx
    .filter((transaction) => {
      if (filterType === "income") return transaction.type === "Income";
      if (filterType === "expense") return transaction.type === "Expense";
      if (filterType === "pending") return transaction.status === "Pending";
      return true;
    })
    .filter((transaction) => categoryFilter === "all" || transaction.category === categoryFilter)
    .filter((transaction) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return `${transaction.description} ${transaction.category} ${transaction.paymentMethod}`
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setFormOpen(true);
  }

  function saveTransaction(transaction: Transaction) {
    if (editing) {
      dispatch({ type: "UPDATE_TX", tx: transaction });
      toast.push("Lançamento atualizado.");
    } else {
      dispatch({ type: "ADD_TX", tx: transaction });
      toast.push("Lançamento adicionado.");
    }
    setSelectedYM(transaction.dateISO.slice(0, 7));
    setFormOpen(false);
    setEditing(null);
  }

  return (
    <div className="page-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">Seu dia a dia</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Lançamentos<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
            Tudo o que entra e sai, com status e contexto.
          </p>
        </div>
        <Button onClick={openNew} size="lg" className="self-start sm:self-auto">
          <Plus size={16} /> Novo lançamento
        </Button>
      </div>

      <QuickEntry defaultMode="transaction" className="mt-5" onSaved={(mode) => {
        if (mode === "plan") setSelectedYM(currentYM());
      }} />

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Entradas"
          value={formatBRL(totals.income)}
          hint={`${previous.income ? `${totals.income >= previous.income ? "+" : ""}${(((totals.income - previous.income) / previous.income) * 100).toFixed(0)}% vs. mês anterior` : "neste mês"}`}
          icon={<ArrowDownLeft size={15} />}
          color="var(--accent)"
          soft="var(--success-soft)"
        />
        <SummaryCard
          label="Saídas"
          value={formatBRL(totals.expense)}
          hint={`${previous.expense ? `${(((totals.expense - previous.expense) / previous.expense) * 100).toFixed(0)}% vs. mês anterior` : "neste mês"}`}
          icon={<ArrowUpRight size={15} />}
          color="var(--coral)"
          soft="var(--coral-soft)"
        />
        <SummaryCard
          label="Resultado"
          value={formatBRL(totals.income - totals.expense)}
          hint="entradas menos saídas"
          icon={<Wallet size={15} />}
          color={totals.income - totals.expense >= 0 ? "var(--success)" : "var(--coral)"}
          soft={totals.income - totals.expense >= 0 ? "var(--success-soft)" : "var(--coral-soft)"}
        />
        <SummaryCard
          label="Pendentes"
          value={`${totals.pendingCount}`}
          hint={`${formatBRL(totals.pending)} a confirmar`}
          icon={<CalendarDays size={15} />}
          color="var(--amber)"
          soft="rgba(247, 200, 115, 0.1)"
        />
      </div>

      <section className="panel mt-4 p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border p-1" style={{ borderColor: "var(--border)" }}>
              <IconButton
                label="Mês anterior"
                className="!h-[30px] !w-[30px] !rounded-lg !border-0 !bg-transparent"
                onClick={() => setSelectedYM(addMonthsYM(selectedYM, -1))}
              >
                <ChevronLeft size={15} />
              </IconButton>
              <button
                type="button"
                onClick={() => setSelectedYM(currentYM())}
                className="min-w-[106px] px-1 text-[11.5px] font-extrabold text-[var(--text)]"
                title="Voltar para o mês atual"
              >
                {monthLabel(selectedYM)}
              </button>
              <IconButton
                label="Próximo mês"
                className="!h-[30px] !w-[30px] !rounded-lg !border-0 !bg-transparent"
                onClick={() => setSelectedYM(addMonthsYM(selectedYM, 1))}
              >
                <ChevronRight size={15} />
              </IconButton>
            </div>
            <Badge dot>{monthTx.length} registros</Badge>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented
              value={filterType}
              onChange={setFilterType}
              options={[
                { value: "all", label: "Todos" },
                { value: "income", label: "Entradas" },
                { value: "expense", label: "Saídas" },
                { value: "pending", label: "Pendentes" },
              ]}
              className="w-full [&>button]:!px-1.5 [&>button]:!text-[10.5px] sm:min-w-[310px] sm:[&>button]:!px-2.5 sm:[&>button]:!text-[12px]"
            />
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <Input
                  aria-label="Buscar lançamentos"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar..."
                  className="!min-h-[38px] !pl-8 sm:!w-[150px]"
                />
              </div>
              <div className="w-[136px] shrink-0">
                <Select
                  ariaLabel="Filtrar categoria"
                  value={categoryFilter}
                  onChange={(value) => setCategoryFilter(value as Category | "all")}
                  options={[{ value: "all", label: "Categorias" }, ...CATEGORY_OPTIONS]}
                  className="!min-h-[38px] !py-2"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel mt-3 overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <SectionHeader
            title={filterType === "pending" ? "Contas pendentes" : "Movimentações do mês"}
            description={`${filtered.length} ${filtered.length === 1 ? "lançamento encontrado" : "lançamentos encontrados"}`}
            className="!mb-0"
          />
          {(filterType !== "all" || categoryFilter !== "all" || query) ? (
            <button
              type="button"
              onClick={() => {
                setFilterType("all");
                setCategoryFilter("all");
                setQuery("");
              }}
              className="text-[10.5px] font-extrabold text-[var(--muted)] transition hover:text-[var(--accent)]"
            >
              Limpar filtros
            </button>
          ) : (
            <span className="hidden items-center gap-1 text-[10px] font-semibold text-[var(--faint)] sm:flex">
              <SlidersHorizontal size={11} /> mais recentes primeiro
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<SearchX size={20} />}
            title="Nada por aqui"
            description="Não encontramos lançamentos com esses filtros. Ajuste a busca ou registre uma nova movimentação."
            action={<Button size="sm" variant="secondary" onClick={openNew}><Plus size={13} /> Adicionar</Button>}
          />
        ) : (
          <div>
            {filtered.map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                last={index === filtered.length - 1}
                onEdit={() => openEdit(transaction)}
                onDelete={() => setDeleteTarget(transaction)}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mt-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <Info size={14} className="mt-0.5 shrink-0 text-[var(--muted)]" />
        <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
          Lançamentos pendentes também entram no realizado. Para registrar uma compra no crédito, use{" "}
          <strong className="text-[var(--text-soft)]">Crédito</strong>; para pagar a conta do crédito, registre o pagamento dentro do próprio módulo.
        </p>
      </div>

      <TransactionModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
        defaultYM={selectedYM}
        onSave={saveTransaction}
        newId={newId}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir lançamento?"
        message={`“${deleteTarget?.description ?? ""}” será removido permanentemente deste dispositivo.`}
        confirmText="Excluir"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          dispatch({ type: "DELETE_TX", id: deleteTarget.id });
          toast.push("Lançamento excluído.");
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function SummaryCard({
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
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: soft, color }}>
          {icon}
        </span>
      </div>
      <p className="num mt-2.5 truncate text-[17px] font-semibold leading-none text-[var(--text)] sm:text-[19px]">
        {value}
      </p>
      <p className="mt-1.5 truncate text-[10px] text-[var(--faint)]">{hint}</p>
    </div>
  );
}

function TransactionRow({
  transaction,
  last,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isIncome = transaction.type === "Income";
  return (
    <div
      className="group flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-2)] sm:px-5"
      style={!last ? { borderBottom: "1px solid var(--border)" } : undefined}
    >
      {isIncome ? (
        <span
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border"
          style={{ borderColor: "var(--border)", background: "var(--success-soft)", color: "var(--success)" }}
        >
          <ArrowDownLeft size={17} />
        </span>
      ) : (
        <CategoryIcon category={transaction.category} boxSize={38} size={17} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[12.5px] font-bold text-[var(--text)]">{transaction.description}</p>
          {transaction.status === "Pending" ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--amber)" }} title="Pendente" />
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] capitalize text-[var(--muted)]">
          <span className="sm:hidden">
            {transaction.category} · {formatDate(transaction.dateISO)}
          </span>
          <span className="hidden sm:inline">
            {transaction.category} · {transaction.paymentMethod}
          </span>
        </p>
      </div>

      <div className="hidden w-[85px] shrink-0 lg:block">
        <p className="text-[10.5px] font-semibold text-[var(--text-soft)]">{formatDate(transaction.dateISO)}</p>
        <p className="mt-0.5 text-[10px] capitalize text-[var(--faint)]">{formatWeekday(transaction.dateISO)}</p>
      </div>

      <div className="hidden w-[84px] shrink-0 sm:block">
        <Badge tone={transaction.status === "Paid" ? "accent" : "amber"}>
          {transaction.status === "Paid" ? "Pago" : "Pendente"}
        </Badge>
      </div>

      <div className="shrink-0 text-right">
        <p
          className="num text-[12.5px] font-semibold sm:text-[13px]"
          style={{ color: isIncome ? "var(--success)" : "var(--text)" }}
        >
          {isIncome ? "+" : "−"} {formatBRL(transaction.amountCents)}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--faint)]">
          {transaction.type === "Income" ? "entrada" : "saída"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${transaction.description}`}
          className="rounded-lg p-2.5 text-[var(--faint)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Excluir ${transaction.description}`}
          className="rounded-lg p-2.5 text-[var(--faint)] transition hover:bg-[var(--coral-soft)] hover:text-[var(--coral)]"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function TransactionModal({
  open,
  onClose,
  editing,
  defaultYM,
  onSave,
  newId,
}: {
  open: boolean;
  onClose: () => void;
  editing: Transaction | null;
  defaultYM: YearMonth;
  onSave: (transaction: Transaction) => void;
  newId: (prefix?: string) => string;
}) {
  const toast = useToast();
  const [type, setType] = React.useState<TransactionType>("Expense");
  const [description, setDescription] = React.useState("");
  const [amountCents, setAmountCents] = React.useState(0);
  const [dateISO, setDateISO] = React.useState(todayISO());
  const [category, setCategory] = React.useState<Category>("Alimentação");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("Pix/Débito");
  const [status, setStatus] = React.useState<TransactionStatus>("Paid");

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setDescription(editing.description);
      setAmountCents(editing.amountCents);
      setDateISO(editing.dateISO);
      setCategory(editing.category);
      setPaymentMethod(editing.paymentMethod);
      setStatus(editing.status);
    } else {
      setType("Expense");
      setDescription("");
      setAmountCents(0);
      setDateISO(defaultYM === currentYM() ? todayISO() : `${defaultYM}-01`);
      setCategory("Alimentação");
      setPaymentMethod("Pix/Débito");
      setStatus("Paid");
    }
  }, [open, editing, defaultYM]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!description.trim()) {
      toast.push("Dê um nome para o lançamento.", "warning");
      return;
    }
    if (amountCents <= 0) {
      toast.push("O valor precisa ser maior que zero.", "warning");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      toast.push("Informe uma data válida.", "warning");
      return;
    }
    if (paymentMethod === "Cartão de Crédito") {
      toast.push("Compras no crédito devem ser registradas no módulo Crédito.", "warning");
      return;
    }
    onSave({
      id: editing?.id ?? newId("tx"),
      description: description.trim(),
      amountCents,
      dateISO,
      type,
      category,
      paymentMethod,
      status,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar lançamento" : "Novo lançamento"}
      subtitle={editing ? "Ajuste os detalhes da movimentação." : "Registre uma entrada ou saída do seu dia a dia."}
      icon={<ArrowLeftRight size={17} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="transaction-form">
            {editing ? "Salvar alterações" : "Adicionar lançamento"}
          </Button>
        </>
      }
    >
      <form id="transaction-form" onSubmit={submit} className="space-y-4">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: "Income", label: "Entrada" },
            { value: "Expense", label: "Saída" },
          ]}
        />

        <div className="grid gap-2">
          <Field label="Descrição">
            <Input
              autoFocus
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={type === "Income" ? "Ex.: Salário, freelance..." : "Ex.: Mercado, aluguel..."}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor">
            <MoneyInput valueCents={amountCents} onChangeCents={setAmountCents} tone="large" />
          </Field>
          <Field label="Data">
            <Input type="date" value={dateISO} onChange={(event) => setDateISO(event.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <Select value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
          </Field>
          <Field label="Forma de pagamento">
            <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_OPTIONS} />
          </Field>
        </div>

        <Field label="Status" hint={status === "Pending" ? "Contas pendentes entram no realizado e aparecem nos vencimentos." : "O valor já foi movimentado."}>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "Paid", label: "Pago" },
              { value: "Pending", label: "Pendente" },
            ]}
          />
        </Field>

        <div className="flex gap-2.5 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <Info size={14} className="mt-0.5 shrink-0 text-[var(--muted)]" />
          <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
            Saldo atual deste lançamento:{" "}
            <span className="num font-semibold text-[var(--text-soft)]">{formatBRL(amountCents)}</span>
            {type === "Expense" ? " em saídas." : " em entradas."}
          </p>
        </div>
      </form>
    </Modal>
  );
}
