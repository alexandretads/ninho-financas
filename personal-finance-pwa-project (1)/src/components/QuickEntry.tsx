import React from "react";
import {
  ArrowUp,
  CalendarClock,
  Check,
  CreditCard,
  Info,
  ReceiptText,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";
import { Button, Field, Input, Modal, MoneyInput, Segmented, Select } from "./ui";
import { useToast } from "./Toast";
import { useStore } from "../state/store";
import type { CardPurchase, Goal, PaymentMethod, Transaction } from "../state/types";
import { CATEGORIES, PAYMENT_METHODS } from "../state/types";
import { type AssistantMode, type ParsedEntry, parseAssistantText } from "../lib/assistant";
import { CATEGORY_META, getPlan, itemsForMonth, replicateToFuture, withItems } from "../lib/finance";
import { formatBRL } from "../lib/money";
import { formatDate, monthLabel, ymFromISO } from "../lib/date";
import type { YearMonth } from "../state/types";
import CategoryIcon from "./CategoryIcon";

const SUGGESTIONS: Record<AssistantMode, string[]> = {
  transaction: [
    "Mercado 186,40 hoje no débito",
    "Recebi 350 de freelance",
    "Farmácia 42,90 ontem no pix",
    "Fone de ouvido 240 em 4x no cartão",
  ],
  plan: [
    "Aluguel 1.340 fixo dia 10",
    "Energia 240 dia 15",
    "Recebo salário 3.200 dia 5",
    "Escola da filha 450 todo dia 20",
  ],
  goal: [
    "Guardei 400 na reserva de emergência",
    "Poupei 150 para a viagem",
    "Separei 1.000 para a entrada da casa",
    "Aportei 200 na meta do carro",
  ],
};

const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({
  value: category,
  label: CATEGORY_META[category].label,
}));

const PAYMENT_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: method }));

export default function QuickEntry({
  defaultMode = "transaction",
  lockMode = false,
  defaultMonth,
  onSaved,
  className,
}: {
  defaultMode?: AssistantMode;
  lockMode?: boolean;
  defaultMonth?: YearMonth;
  onSaved?: (mode: AssistantMode) => void;
  className?: string;
}) {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const [mode, setMode] = React.useState<AssistantMode>(defaultMode);
  const [text, setText] = React.useState("");
  const [preview, setPreview] = React.useState<ParsedEntry | null>(null);

  const goals = data.goals ?? [];
  const draft = text.trim();
  const parsed = draft
    ? parseAssistantText(draft, mode, {
        referenceDateISO: defaultMonth ? `${defaultMonth}-15` : undefined,
        goals,
      })
    : null;

  function openPreview() {
    if (!draft) {
      toast.push("Conte o que aconteceu ou o que está planejando.", "warning");
      return;
    }
    const result = parseAssistantText(draft, mode, {
      referenceDateISO: defaultMonth ? `${defaultMonth}-15` : undefined,
      goals,
    });
    if (!result.description) {
      toast.push("Não consegui identificar uma descrição. Tente incluir o nome do gasto.", "warning");
      return;
    }
    setPreview(result);
  }

  function save(entry: ParsedEntry) {
    if (entry.amountCents <= 0) {
      toast.push("Inclua um valor na frase para eu registrar certinho.", "warning");
      return;
    }
    if (!entry.description.trim()) {
      toast.push("Inclua uma descrição.", "warning");
      return;
    }

    if (entry.mode === "goal") {
      const goal =
        goals.find((item) => item.id === entry.goalId) ??
        (goals.length === 1 ? goals[0] : undefined);
      if (!goal) {
        toast.push("Escolha para qual meta você guardou o valor.", "warning");
        return;
      }
      const nextSaved = goal.savedCents + entry.amountCents;
      const completed = nextSaved >= goal.targetCents;
      const nextGoals: Goal[] = goals.map((item) =>
        item.id === goal.id
          ? {
              ...item,
              savedCents: nextSaved,
              completed,
              contributions: [
                ...item.contributions,
                {
                  id: newId("goalc"),
                  amountCents: entry.amountCents,
                  dateISO: entry.dateISO,
                  note: "Aporte registrado pelo assistente",
                },
              ],
            }
          : item
      );
      dispatch({ type: "SET_GOALS", goals: nextGoals });
      toast.push(
        completed
          ? `Meta ${goal.title} concluída! ${formatBRL(nextSaved)} guardados. 🎉`
          : `${formatBRL(entry.amountCents)} guardados em ${goal.title} · ${Math.min(100, Math.round((nextSaved / Math.max(1, goal.targetCents)) * 100))}% da meta.`
      );
      setText("");
      setPreview(null);
      onSaved?.("goal");
      return;
    }

    if (entry.mode === "plan") {
      const year = Number(entry.dateISO.slice(0, 4));
      const monthIndex = Number(entry.dateISO.slice(5, 7)) - 1;
      const plan = getPlan(data.budgetPlans, year);
      const current = itemsForMonth(plan, monthIndex);
      const newItem = {
        id: newId("plan"),
        kind: entry.type === "Income" ? ("income" as const) : ("expense" as const),
        name: entry.description,
        amountCents: entry.amountCents,
        category: entry.category,
        day: Number(entry.dateISO.slice(8, 10)),
        fixed: entry.fixed,
        paid: false,
      };
      let nextPlan = withItems(plan, monthIndex, [...current, newItem]);
      if (entry.fixed) {
        nextPlan = replicateToFuture(
          nextPlan,
          monthIndex,
          (nextPlan.months[monthIndex].items ?? []).filter((item) => item.fixed)
        );
      }
      dispatch({ type: "UPSERT_BUDGET_PLAN", plan: nextPlan });
      toast.push(
        `${entry.type === "Income" ? "Recebimento" : "Despesa"} adicionado ao plano de ${monthLabel(entry.dateISO.slice(0, 7), "short")}.`
      );
    } else if (entry.isCard) {
      const purchase: CardPurchase = {
        id: newId("buy"),
        description: entry.description,
        amountCents: entry.amountCents,
        purchaseDateISO: entry.dateISO,
        category: entry.category === "Cartão" ? "Outros" : entry.category,
        installments:
          entry.installments > 1
            ? {
                totalCents: entry.amountCents,
                parts: entry.installments,
                currentPart: 1,
                firstInstallmentDateISO: entry.dateISO,
              }
            : undefined,
      };
      dispatch({ type: "ADD_PURCHASE", purchase });
      toast.push(
        entry.installments > 1
          ? `Compra de ${formatBRL(entry.amountCents)} em ${entry.installments}x adicionada ao cartão.`
          : "Compra adicionada ao cartão."
      );
    } else {
      const transaction: Transaction = {
        id: newId("tx"),
        description: entry.description,
        amountCents: entry.amountCents,
        dateISO: entry.dateISO,
        type: entry.type,
        category: entry.category,
        paymentMethod: entry.isCard ? "Cartão de Crédito" : entry.paymentMethod,
        status: "Paid",
      };
      dispatch({ type: "ADD_TX", tx: transaction });
      toast.push(
        `${entry.type === "Income" ? "Entrada" : "Despesa"} de ${formatBRL(entry.amountCents)} registrada.`
      );
    }

    setText("");
    setPreview(null);
    onSaved?.(entry.mode);
  }

  return (
    <>
      <section className={`panel overflow-hidden ${className ?? ""}`}>
        <div className="relative overflow-hidden px-4 pt-4 sm:px-5 sm:pt-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(204,245,110,.16), transparent 68%)" }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg border"
                style={{ borderColor: "var(--hero-border)", background: "var(--success-soft)", color: "var(--accent)" }}
              >
                <WandSparkles size={14} />
              </span>
              <div>
                <p className="font-display text-[12px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                  Assistente <span style={{ color: "var(--accent)" }}>Ninho</span>
                </p>
                <p className="text-[9.5px] text-[var(--muted)]">Escreva como falaria com alguém. Eu organizo o resto.</p>
              </div>
            </div>
            <span className="chip !py-1 !text-[8.5px]"><Sparkles size={10} style={{ color: "var(--accent)" }} /> interpretação local</span>
          </div>

          {!lockMode ? (
            <div className="relative mt-3 max-w-[420px]">
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "transaction", label: "Já aconteceu" },
                  { value: "plan", label: "Está previsto" },
                  { value: "goal", label: "Guardar na meta" },
                ]}
              />
            </div>
          ) : null}

          <div
            className="relative mt-3 rounded-2xl border p-3 transition focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--ring)]"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface-2)" }}
          >
            <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
              {mode === "goal" ? <Target size={11} /> : mode === "plan" ? <CalendarClock size={11} /> : <ReceiptText size={11} />}
              {mode === "goal" ? "aporte em uma meta" : mode === "plan" ? "nova despesa prevista" : "novo lançamento"}
            </div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  openPreview();
                }
              }}
              rows={2}
              aria-label="Descreva o lançamento ou despesa prevista"
              placeholder={
                mode === "goal"
                  ? "Ex.: guardei 400 para a reserva de emergência"
                  : mode === "plan"
                    ? "Ex.: aluguel 1.340 fixo no dia 10"
                    : "Ex.: mercado 186,40 hoje no débito"
              }
              className="mt-1.5 w-full resize-none border-0 bg-transparent text-[13px] font-semibold leading-relaxed text-[var(--text)] outline-none placeholder:font-medium placeholder:text-[var(--faint)]"
            />
            <div className="mt-1 flex items-end justify-between gap-3">
              <div className="min-w-0">
                {parsed && draft ? (
                  <p className="flex flex-wrap items-center gap-1.5 text-[9.5px] text-[var(--muted)]">
                    {parsed.amountCents > 0 ? (
                      <span className="num font-semibold text-[var(--text-soft)]">{formatBRL(parsed.amountCents)}</span>
                    ) : (
                      <span style={{ color: "var(--amber)" }}>inclua um valor</span>
                    )}
                    <span>·</span>
                    <span>{formatDate(parsed.dateISO)}</span>
                    <span>·</span>
                    <span>
                      {parsed.mode === "goal"
                        ? parsed.goalTitle
                          ? `Meta: ${parsed.goalTitle}`
                          : goals.length
                            ? "escolher meta"
                            : "crie uma meta"
                        : parsed.isCard && parsed.mode === "transaction"
                          ? "Cartão"
                          : parsed.category}
                    </span>
                  </p>
                ) : (
                  <p className="text-[9px] text-[var(--faint)]">Enter para revisar · Shift + Enter para nova linha</p>
                )}
              </div>
              <button
                type="button"
                onClick={openPreview}
                aria-label="Interpretar e revisar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition active:scale-95"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                <ArrowUp size={15} strokeWidth={2.6} />
              </button>
            </div>
          </div>

          <div className="scrollbar-none -mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 pb-4">
            {SUGGESTIONS[mode].slice(0, 4).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setText(suggestion)}
                className="chip shrink-0 !text-[9px] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </section>

      <AssistantPreview
        entry={preview}
        goals={goals}
        onClose={() => setPreview(null)}
        onSave={save}
      />
    </>
  );
}

function AssistantPreview({
  entry,
  goals,
  onClose,
  onSave,
}: {
  entry: ParsedEntry | null;
  goals: Goal[];
  onClose: () => void;
  onSave: (entry: ParsedEntry) => void;
}) {
  const [draft, setDraft] = React.useState<ParsedEntry | null>(entry);

  React.useEffect(() => {
    setDraft(entry);
  }, [entry]);

  if (!draft) return null;

  function patch(patchValue: Partial<ParsedEntry>) {
    setDraft((current) => (current ? { ...current, ...patchValue } : current));
  }

  const isPlan = draft.mode === "plan";
  const isGoal = draft.mode === "goal";
  const selectedGoal = goals.find((item) => item.id === draft.goalId) ?? null;
  const destination = isGoal
    ? selectedGoal
      ? `Meta: ${selectedGoal.title}`
      : "Aporte em meta"
    : isPlan
      ? `Plano de ${monthLabel(ymFromISO(draft.dateISO), "long")}`
      : draft.isCard
        ? "Conta do crédito"
        : "Lançamento realizado";

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      title="Confira o que eu entendi"
      subtitle="Ajuste qualquer detalhe antes de salvar. Nada é enviado para fora do seu aparelho."
      icon={<Sparkles size={17} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Voltar</Button>
          <Button onClick={() => onSave(draft)}>
            <Check size={15} /> {isGoal ? "Registrar aporte" : isPlan ? "Adicionar ao plano" : draft.isCard ? "Adicionar ao cartão" : "Registrar lançamento"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="chip chip-accent"><Check size={10} /> {destination}</span>
          <span className="chip">{formatBRL(draft.amountCents)}</span>
          <span className="chip">{formatDate(draft.dateISO, "long")}</span>
        </div>

        {isGoal ? (
          <div className="space-y-3">
            {goals.length ? (
              <>
                <Field label="Meta" hint="Escolha para qual meta o valor foi guardado.">
                  <Select
                    value={draft.goalId ?? ""}
                    onChange={(goalId) => {
                      const goal = goals.find((item) => item.id === goalId);
                      patch({ goalId, goalTitle: goal?.title, description: goal?.title ?? draft.description });
                    }}
                    options={[
                      { value: "", label: "Selecione a meta" },
                      ...goals.map((goal) => ({ value: goal.id, label: goal.title })),
                    ]}
                  />
                </Field>
                {selectedGoal ? (
                  <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">Progresso da meta</span>
                      <span className="num text-[9.5px] font-semibold text-[var(--text-soft)]">
                        {formatBRL(selectedGoal.savedCents)} de {formatBRL(selectedGoal.targetCents)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="progress" style={{ height: 6 }}>
                        <span style={{ width: `${Math.min(100, (selectedGoal.savedCents / Math.max(1, selectedGoal.targetCents)) * 100)}%`, background: "var(--accent)" }} />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[9px] text-[var(--muted)]">
                      Com este aporte:{" "}
                      <strong className="num text-[var(--text-soft)]">
                        {formatBRL(selectedGoal.savedCents + draft.amountCents)}
                      </strong>{" "}
                      ({Math.min(100, Math.round(((selectedGoal.savedCents + draft.amountCents) / Math.max(1, selectedGoal.targetCents)) * 100))}% da meta)
                    </p>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valor guardado">
                    <MoneyInput valueCents={draft.amountCents} onChangeCents={(amountCents) => patch({ amountCents })} />
                  </Field>
                  <Field label="Data do aporte">
                    <Input type="date" value={draft.dateISO} onChange={(event) => patch({ dateISO: event.target.value })} />
                  </Field>
                </div>
                <div className="flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <Info size={13} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                  <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
                    Vai para o progresso de <strong className="text-[var(--text-soft)]">{selectedGoal?.title ?? "sua meta"}</strong>, com registro no histórico.
                    Não cria lançamento no extrato. Você pode acompanhar tudo em Metas.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--border-strong)" }}>
                <p className="text-[11px] font-bold text-[var(--text)]">Você ainda não tem metas</p>
                <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">
                  Crie uma meta primeiro para registrar este valor. Depois volte e escreva, por exemplo, “guardei 400 na reserva de emergência”.
                </p>
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    onClose();
                    window.location.hash = "goals";
                  }}
                >
                  Criar uma meta
                </Button>
              </div>
            )}
          </div>
        ) : !isPlan ? (
          <Segmented
            value={draft.type}
            onChange={(type) => patch({ type })}
            options={[
              { value: "Income", label: "Entrada" },
              { value: "Expense", label: "Saída" },
            ]}
          />
        ) : (
          <Segmented
            value={draft.type}
            onChange={(type) => patch({ type })}
            options={[
              { value: "Income", label: "A receber" },
              { value: "Expense", label: "A pagar" },
            ]}
          />
        )}

        {!isGoal ? (
          <>
        <Field label="Descrição">
          <Input value={draft.description} onChange={(event) => patch({ description: event.target.value })} autoFocus />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor">
            <MoneyInput valueCents={draft.amountCents} onChangeCents={(amountCents) => patch({ amountCents })} />
          </Field>
          <Field label={isPlan ? (draft.type === "Income" ? "Data prevista" : "Vencimento") : "Data"}>
            <Input type="date" value={draft.dateISO} onChange={(event) => patch({ dateISO: event.target.value })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <Select
              value={draft.category}
              onChange={(category) => patch({ category })}
              options={CATEGORY_OPTIONS}
            />
          </Field>
          {isPlan ? (
            <Field label="Repetição" hint="Itens fixos se repetem nos próximos meses.">
              <Select
                value={draft.fixed ? "fixed" : "once"}
                onChange={(value) => patch({ fixed: value === "fixed" })}
                options={[
                  { value: "once", label: "Só neste mês" },
                  { value: "fixed", label: "Todo mês" },
                ]}
              />
            </Field>
          ) : (
            <Field label="Forma de pagamento">
              <Select
                value={draft.paymentMethod}
                onChange={(paymentMethod: PaymentMethod) => patch({ paymentMethod })}
                options={PAYMENT_OPTIONS}
              />
            </Field>
          )}
        </div>

        {!isPlan ? (
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <button
              type="button"
              onClick={() => patch({ isCard: !draft.isCard })}
              className="flex w-full items-center gap-2.5 text-left"
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md border"
                style={{
                  borderColor: draft.isCard ? "var(--accent)" : "var(--border-strong)",
                  background: draft.isCard ? "var(--accent)" : "transparent",
                  color: "var(--accent-ink)",
                }}
              >
                {draft.isCard ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <CreditCard size={14} className="text-[var(--muted)]" />
              <span className="flex-1">
                <span className="block text-[11px] font-bold text-[var(--text)]">Foi no cartão de crédito</span>
                <span className="block text-[9.5px] text-[var(--muted)]">Vai direto para a conta do crédito, sem duplicar no caixa.</span>
              </span>
            </button>
            {draft.installments > 1 ? (
              <div className="mt-2.5 flex items-center gap-2 border-t pt-2.5" style={{ borderColor: "var(--border)" }}>
                <CreditCard size={12} className="text-[var(--accent)]" />
                <p className="text-[10px] text-[var(--text-soft)]">
                  Compra em <strong>{draft.installments}x</strong> de aproximadamente{" "}
                  {formatBRL(Math.round(draft.amountCents / draft.installments))}.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <Info size={13} className="mt-0.5 shrink-0 text-[var(--muted)]" />
            <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
              Vai para <strong className="text-[var(--text-soft)]">{destination}</strong> como{" "}
              {draft.type === "Income" ? "recebimento" : "despesa prevista"}, no dia{" "}
              {Number(draft.dateISO.slice(8, 10))}. Você poderá marcar como pago e editar no Plano.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <CategoryIcon category={draft.category} boxSize={30} size={13} rounded={9} />
          <p className="text-[10px] text-[var(--muted)]">
            Categoria sugerida: <strong className="text-[var(--text-soft)]">{CATEGORY_META[draft.category].label}</strong>
          </p>
        </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
