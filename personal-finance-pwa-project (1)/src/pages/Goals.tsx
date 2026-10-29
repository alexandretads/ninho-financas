import React from "react";
import {
  ArrowDownLeft,
  Check,
  ChevronRight,
  Flag,
  Home,
  Lightbulb,
  Pencil,
  Plane,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  GraduationCap,
  CarFront,
  BriefcaseBusiness,
  HandCoins,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
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
import type { Goal } from "../state/types";
import { formatBRL } from "../lib/money";
import { formatDate, todayISO } from "../lib/date";
import { monthTransactions, sumCents, totalsForTransactions } from "../lib/finance";

type GoalCategory = Goal["category"];

const CATEGORY_META: Record<GoalCategory, { label: string; icon: React.ElementType; color: string; tint: string }> = {
  reserva: { label: "Reserva", icon: Wallet, color: "var(--accent)", tint: "var(--success-soft)" },
  viagem: { label: "Viagem", icon: Plane, color: "var(--sky)", tint: "rgba(125,211,252,.1)" },
  casa: { label: "Casa", icon: Home, color: "var(--amber)", tint: "rgba(247,200,115,.1)" },
  veiculo: { label: "Veículo", icon: CarFront, color: "var(--violet)", tint: "rgba(196,181,253,.1)" },
  educacao: { label: "Educação", icon: GraduationCap, color: "var(--sky)", tint: "rgba(125,211,252,.1)" },
  divida: { label: "Quitar dívida", icon: HandCoins, color: "var(--coral)", tint: "var(--coral-soft)" },
  negocio: { label: "Negócio", icon: BriefcaseBusiness, color: "var(--accent)", tint: "var(--success-soft)" },
  outro: { label: "Outro", icon: Flag, color: "var(--muted)", tint: "var(--surface-3)" },
};

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_META) as GoalCategory[]).map((category) => ({
  value: category,
  label: CATEGORY_META[category].label,
}));

const TEMPLATES: Array<{ title: string; category: GoalCategory; targetCents: number; months: number; description: string }> = [
  { title: "Reserva de emergência", category: "reserva", targetCents: 1800000, months: 12, description: "Seis meses de despesas essenciais para imprevistos." },
  { title: "Viagem em família", category: "viagem", targetCents: 800000, months: 10, description: "Passagens, hospedagem e passeios sem dívida." },
  { title: "Entrada da casa própria", category: "casa", targetCents: 3000000, months: 24, description: "Entrada, taxas e uma reserva para a mudança." },
  { title: "Quitar cartão e crediário", category: "divida", targetCents: 500000, months: 8, description: "Sair dos juros e liberar o orçamento." },
];

function monthsBetweenToday(iso: string) {
  const now = new Date();
  const target = new Date(`${iso}T12:00:00`);
  return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth());
}

function monthsLabel(months: number) {
  if (months <= 0) return "prazo vencido";
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

function daysBetweenToday(iso: string) {
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - Date.now()) / 86_400_000);
}

function categoryAdvice(category: GoalCategory) {
  switch (category) {
    case "reserva":
      return "Priorize de 3 a 6 meses das despesas essenciais. Deixe em liquidez diária e reponha sempre que usar.";
    case "viagem":
      return "Reserve passagens antes da hospedagem e prefira baixa temporada. Crie uma submeta para transporte e outra para gastos.";
    case "casa":
      return "Some entrada, ITBI, escritura e mudança. Guarde 10% a mais para custos que só aparecem no fim.";
    case "veiculo":
      return "Inclua seguro, IPTU e manutenção no cálculo. Comprar à vista costuma valer mais do que parcelar com juros.";
    case "educacao":
      return "Compare curso à vista e parcelado, verifique reembolso e planeje o material antes da matrícula.";
    case "divida":
      return "Quite primeiro a dívida com maior juro. Negocie desconto à vista e evite assumir novo crédito durante o processo.";
    case "negocio":
      return "Separe o caixa pessoal do negócio e mantenha 3 meses de custos fixos como colchão antes de investir mais.";
    default:
      return "Automatize uma transferência no dia do recebimento. Revisar uma vez por semana evita que a meta saia do foco.";
  }
}

export default function Goals() {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const goals = data.goals ?? [];
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Goal | null>(null);
  const [contributeTarget, setContributeTarget] = React.useState<Goal | null>(null);
  const [detailTarget, setDetailTarget] = React.useState<Goal | null>(null);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<GoalCategory>("reserva");
  const [targetCents, setTargetCents] = React.useState(0);
  const [savedCents, setSavedCents] = React.useState(0);
  const [deadlineISO, setDeadlineISO] = React.useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 12);
    return date.toISOString().slice(0, 10);
  });
  const [contributionCents, setContributionCents] = React.useState(0);
  const [contributionDate, setContributionDate] = React.useState(todayISO());
  const [contributionNote, setContributionNote] = React.useState("");

  const monthlySurplus = React.useMemo(() => {
    const actuals = [0, 1, 2].map((offset) => {
      const date = new Date();
      date.setMonth(date.getMonth() - offset);
      const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const totals = totalsForTransactions(monthTransactions(data.transactions, ym));
      return { income: totals.income, expense: totals.expense };
    }).filter((month) => month.income > 0);
    if (!actuals.length) {
      const plan = data.budgetPlans.find((item) => item.year === new Date().getFullYear());
      const month = plan?.months[new Date().getMonth()];
      if (!month) return 0;
      const income = sumCents(Object.values(month.income));
      const expense = sumCents(Object.values(month.expense));
      return Math.max(0, income - expense);
    }
    const avg = actuals.reduce((total, month) => total + (month.income - month.expense), 0) / actuals.length;
    return Math.max(0, Math.round(avg));
  }, [data.transactions, data.budgetPlans]);

  function resetForm() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setCategory("reserva");
    setTargetCents(0);
    setSavedCents(0);
    const date = new Date();
    date.setMonth(date.getMonth() + 12);
    setDeadlineISO(date.toISOString().slice(0, 10));
  }

  function openNew(template?: (typeof TEMPLATES)[number]) {
    resetForm();
    if (template) {
      setTitle(template.title);
      setDescription(template.description);
      setCategory(template.category);
      setTargetCents(template.targetCents);
      const date = new Date();
      date.setMonth(date.getMonth() + template.months);
      setDeadlineISO(date.toISOString().slice(0, 10));
    }
    setFormOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setTitle(goal.title);
    setDescription(goal.description);
    setCategory(goal.category);
    setTargetCents(goal.targetCents);
    setSavedCents(goal.savedCents);
    setDeadlineISO(goal.deadlineISO);
    setFormOpen(true);
  }

  function saveGoal() {
    if (title.trim().length < 2) {
      toast.push("Dê um nome à sua meta.", "warning");
      return;
    }
    if (targetCents <= 0) {
      toast.push("Defina um valor para a meta.", "warning");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineISO)) {
      toast.push("Informe uma data-alvo válida.", "warning");
      return;
    }
    const goal: Goal = {
      id: editing?.id ?? newId("goal"),
      title: title.trim(),
      description: description.trim(),
      category,
      targetCents,
      savedCents: Math.min(savedCents, targetCents),
      deadlineISO,
      createdAtISO: editing?.createdAtISO ?? new Date().toISOString(),
      contributions: editing?.contributions ?? [],
      completed: editing ? savedCents >= targetCents : false,
    };
    const next = editing ? goals.map((item) => (item.id === editing.id ? goal : item)) : [...goals, goal];
    dispatch({ type: "SET_GOALS", goals: next });
    setFormOpen(false);
    resetForm();
    toast.push(editing ? "Meta atualizada." : "Meta criada. O Ninho já preparou as sugestões.");
  }

  function contribute() {
    if (!contributeTarget) return;
    if (contributionCents <= 0) {
      toast.push("Informe quanto você guardou.", "warning");
      return;
    }
    const nextSaved = contributeTarget.savedCents + contributionCents;
    const next = goals.map((item) =>
      item.id === contributeTarget.id
        ? {
            ...item,
            savedCents: nextSaved,
            completed: nextSaved >= item.targetCents,
            contributions: [
              ...item.contributions,
              { id: newId("goalc"), amountCents: contributionCents, dateISO: contributionDate, note: contributionNote.trim() || undefined },
            ],
          }
        : item
    );
    dispatch({ type: "SET_GOALS", goals: next });
    toast.push(
      nextSaved >= contributeTarget.targetCents
        ? `Meta ${contributeTarget.title} concluída! 🎉`
        : `${formatBRL(contributionCents)} guardados em ${contributeTarget.title}.`
    );
    setContributeTarget(null);
    setContributionCents(0);
    setContributionNote("");
  }

  const totalTarget = sumCents(goals.map((goal) => goal.targetCents));
  const totalSaved = sumCents(goals.map((goal) => goal.savedCents));
  const totalRemaining = Math.max(0, totalTarget - totalSaved);
  const completedCount = goals.filter((goal) => goal.completed || goal.savedCents >= goal.targetCents).length;
  const monthlyNeededTotal = sumCents(
    goals
      .filter((goal) => goal.savedCents < goal.targetCents)
      .map((goal) => Math.ceil((goal.targetCents - goal.savedCents) / Math.max(1, monthsBetweenToday(goal.deadlineISO))))
  );

  return (
    <div className="page-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">Seus sonhos, com plano</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Metas<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
            Defina o valor, o prazo e receba um caminho possível até lá.
          </p>
        </div>
        <Button size="lg" onClick={() => openNew()} className="self-start sm:self-auto">
          <Plus size={16} /> Nova meta
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <SectionHeader title="Visão das metas" description={`${goals.length} ${goals.length === 1 ? "meta" : "metas"} · ${completedCount} ${completedCount === 1 ? "concluída" : "concluídas"}`} className="!mb-0" />
            <Badge tone="accent" dot>{formatBRL(totalSaved)} guardados</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Objetivo total" value={formatBRL(totalTarget)} />
            <Mini label="Já guardado" value={formatBRL(totalSaved)} />
            <Mini label="Falta" value={formatBRL(totalRemaining)} />
            <Mini label="Por mês" value={formatBRL(monthlyNeededTotal)} hint={monthlySurplus > 0 ? `sobra média ${formatBRL(monthlySurplus)}` : "sem sobra calculada"} />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[9.5px] font-semibold text-[var(--muted)]">
              <span>Progresso geral</span>
              <span className="num">{totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%</span>
            </div>
            <ProgressBar className="mt-1.5" value={totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0} height={8} />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <TrendingUp size={13} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
            <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
              Sua sobra média mensal é <strong className="num text-[var(--text-soft)]">{formatBRL(monthlySurplus)}</strong>.
              As sugestões abaixo usam esse valor para dizer se a meta cabe no seu mês.
            </p>
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <SectionHeader title="Sugestões do Ninho" description="Geradas a partir do seu orçamento e do prazo" action={<Sparkles size={15} className="text-[var(--accent)]" />} />
          <div className="space-y-2">
            {goals.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: "var(--border-strong)" }}>
                <Lightbulb size={20} className="mx-auto text-[var(--muted)]" />
                <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--muted)]">
                  Crie sua primeira meta. O Ninho calcula o valor mensal, o esforço e adapta as dicas ao tipo de sonho.
                </p>
              </div>
            ) : (
              goals
                .slice()
                .sort((a, b) => (a.completed === b.completed ? b.targetCents - a.targetCents : a.completed ? 1 : -1))
                .slice(0, 2)
                .map((goal) => {
                  const months = monthsBetweenToday(goal.deadlineISO);
                  const remaining = Math.max(0, goal.targetCents - goal.savedCents);
                  const required = Math.ceil(remaining / Math.max(1, months));
                  const fit = monthlySurplus > 0 ? required / monthlySurplus : 1;
                  const tone = fit <= 0.3 ? "confortável" : fit <= 0.65 ? "possível" : "desafiador";
                  const color = fit <= 0.3 ? "var(--success)" : fit <= 0.65 ? "var(--amber)" : "var(--coral)";
                  return (
                    <div key={goal.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[10.5px] font-bold text-[var(--text)]">{goal.title}</p>
                        <Badge tone={fit <= 0.3 ? "accent" : fit <= 0.65 ? "amber" : "coral"}>{tone}</Badge>
                      </div>
                      <p className="num mt-1.5 text-[13px] font-semibold" style={{ color }}>
                        {formatBRL(required)}<span className="text-[9px] font-medium text-[var(--muted)]"> /mês por {monthsLabel(months)}</span>
                      </p>
                      <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">{categoryAdvice(goal.category)}</p>
                      <button
                        type="button"
                        onClick={() => setDetailTarget(goal)}
                        className="mt-1.5 flex items-center gap-1 text-[9px] font-extrabold text-[var(--accent)]"
                      >
                        Ver plano completo <ChevronRight size={10} />
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </section>
      </div>

      {goals.length === 0 ? (
        <section className="panel mt-4 overflow-hidden">
          <div className="border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
            <SectionHeader title="Comece por uma meta pronta" description="Você pode ajustar valores e prazos depois." className="!mb-0" />
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
            {TEMPLATES.map((template) => {
              const meta = CATEGORY_META[template.category];
              return (
                <button
                  key={template.title}
                  type="button"
                  onClick={() => openNew(template)}
                  className="rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
                  style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: meta.tint, color: meta.color }}>
                    <meta.icon size={15} />
                  </span>
                  <p className="mt-2 text-[10.5px] font-bold text-[var(--text)]">{template.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-[var(--muted)]">{template.description}</p>
                  <p className="num mt-2 text-[11px] font-semibold text-[var(--text-soft)]">{formatBRL(template.targetCents)}</p>
                  <p className="text-[8.5px] text-[var(--faint)]">em {monthsLabel(template.months)}</p>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => {
            const meta = CATEGORY_META[goal.category] ?? CATEGORY_META.outro;
            const remaining = Math.max(0, goal.targetCents - goal.savedCents);
            const months = monthsBetweenToday(goal.deadlineISO);
            const required = Math.ceil(remaining / Math.max(1, months));
            const days = daysBetweenToday(goal.deadlineISO);
            const progress = goal.targetCents > 0 ? Math.min(100, (goal.savedCents / goal.targetCents) * 100) : 0;
            const done = progress >= 100;
            return (
              <article key={goal.id} className="panel flex flex-col p-4">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: meta.tint, color: meta.color }}>
                    <meta.icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-[var(--text)]">{goal.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[8.5px] text-[var(--muted)]">
                      <span>{meta.label}</span> · <span>até {formatDate(goal.deadlineISO)}</span>
                      {days < 0 && !done ? <span style={{ color: "var(--coral)" }}>· vencida</span> : null}
                    </p>
                  </div>
                  {done ? <Badge tone="accent" dot>concluída</Badge> : null}
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="num text-[18px] font-semibold leading-none text-[var(--text)]">{formatBRL(goal.savedCents)}</p>
                  <p className="text-[9px] text-[var(--muted)]">de {formatBRL(goal.targetCents)}</p>
                </div>
                <ProgressBar className="mt-2" value={progress} height={6} tone={done ? "accent" : progress > 60 ? "sky" : "amber"} />
                <div className="mt-1.5 flex items-center justify-between text-[8.5px]">
                  <span className="num font-semibold text-[var(--text-soft)]">{Math.round(progress)}%</span>
                  <span className="text-[var(--muted)]">{monthsLabel(months)} restantes</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <p className="text-[7.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--faint)]">Falta</p>
                    <p className="num mt-0.5 text-[10px] font-semibold text-[var(--text)]">{formatBRL(remaining)}</p>
                  </div>
                  <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <p className="text-[7.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--faint)]">Por mês</p>
                    <p className="num mt-0.5 text-[10px] font-semibold" style={{ color: remaining === 0 ? "var(--success)" : required <= monthlySurplus ? "var(--text)" : "var(--amber)" }}>
                      {remaining === 0 ? "concluída" : formatBRL(required)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-1.5">
                  <Button size="sm" className="flex-1" onClick={() => { setContributeTarget(goal); setContributionCents(Math.min(required, remaining)); setContributionDate(todayISO()); }}>
                    <ArrowDownLeft size={12} /> Guardar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setDetailTarget(goal)}>
                    Plano
                  </Button>
                  <button type="button" onClick={() => openEdit(goal)} aria-label={`Editar ${goal.title}`} className="rounded-lg p-2 text-[var(--faint)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]">
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(goal)} aria-label={`Excluir ${goal.title}`} className="rounded-lg p-2 text-[var(--faint)] transition hover:bg-[var(--coral-soft)] hover:text-[var(--coral)]">
                    <Trash2 size={12} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); resetForm(); }}
        title={editing ? "Editar meta" : "Nova meta"}
        subtitle="Transforme o sonho em um valor por mês."
        icon={<Target size={17} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setFormOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={saveGoal}>{editing ? "Salvar meta" : "Criar meta"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome da meta">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Reserva de emergência" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={category} onChange={(value) => setCategory(value as GoalCategory)} options={CATEGORY_OPTIONS} />
            </Field>
            <Field label="Prazo alvo">
              <Input type="date" value={deadlineISO} onChange={(event) => setDeadlineISO(event.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor da meta">
              <MoneyInput valueCents={targetCents} onChangeCents={setTargetCents} tone="large" />
            </Field>
            <Field label="Já guardado">
              <MoneyInput valueCents={savedCents} onChangeCents={setSavedCents} />
            </Field>
          </div>
          <Field label="Por que essa meta importa? (opcional)">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: dormir tranquilo com imprevistos" />
          </Field>
          {targetCents > 0 ? (
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-[var(--muted)]">Prévia do esforço</p>
              <p className="num mt-1 text-[14px] font-semibold text-[var(--text)]">
                {formatBRL(Math.ceil(Math.max(0, targetCents - savedCents) / Math.max(1, monthsBetweenToday(deadlineISO))))}
                <span className="text-[9px] font-medium text-[var(--muted)]"> por mês durante {monthsLabel(monthsBetweenToday(deadlineISO))}</span>
              </p>
              <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
                {monthlySurplus > 0
                  ? `Isso usa ${Math.round((Math.ceil(Math.max(0, targetCents - savedCents) / Math.max(1, monthsBetweenToday(deadlineISO))) / monthlySurplus) * 100)}% da sua sobra média (${formatBRL(monthlySurplus)}).`
                  : "Ainda não há sobra média calculada. Registre receitas e despesas para uma sugestão mais precisa."}
              </p>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={!!contributeTarget}
        onClose={() => setContributeTarget(null)}
        title="Guardar para a meta"
        subtitle={contributeTarget ? `${contributeTarget.title} · falta ${formatBRL(Math.max(0, contributeTarget.targetCents - contributeTarget.savedCents))}` : ""}
        icon={<ArrowDownLeft size={17} />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setContributeTarget(null)}>Cancelar</Button>
            <Button onClick={contribute}><Check size={14} /> Registrar valor</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Quanto você guardou?">
            <MoneyInput valueCents={contributionCents} onChangeCents={setContributionCents} tone="large" />
          </Field>
          <Field label="Data">
            <Input type="date" value={contributionDate} onChange={(event) => setContributionDate(event.target.value)} />
          </Field>
          <Field label="Observação (opcional)">
            <Input value={contributionNote} onChange={(event) => setContributionNote(event.target.value)} placeholder="Ex.: 13º salário" />
          </Field>
          <p className="text-[9px] leading-relaxed text-[var(--faint)]">
            Registrar aqui não cria lançamento no extrato. É o acompanhamento da meta.
          </p>
        </div>
      </Modal>

      <GoalDetailModal goal={detailTarget} monthlySurplus={monthlySurplus} onClose={() => setDetailTarget(null)} onContribute={(goal) => { setDetailTarget(null); setContributeTarget(goal); setContributionCents(0); setContributionDate(todayISO()); }} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir meta?"
        message={`“${deleteTarget?.title ?? ""}” e o histórico de aportes serão removidos deste Ninho.`}
        confirmText="Excluir meta"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          dispatch({ type: "SET_GOALS", goals: goals.filter((item) => item.id !== deleteTarget.id) });
          toast.push("Meta excluída.");
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="text-[8px] font-extrabold uppercase tracking-[0.06em] text-[var(--faint)]">{label}</p>
      <p className="num mt-0.5 text-[11px] font-semibold text-[var(--text)]">{value}</p>
      {hint ? <p className="mt-0.5 text-[8px] leading-tight text-[var(--faint)]">{hint}</p> : null}
    </div>
  );
}

function GoalDetailModal({
  goal,
  monthlySurplus,
  onClose,
  onContribute,
}: {
  goal: Goal | null;
  monthlySurplus: number;
  onClose: () => void;
  onContribute: (goal: Goal) => void;
}) {
  if (!goal) return null;
  const meta = CATEGORY_META[goal.category] ?? CATEGORY_META.outro;
  const months = monthsBetweenToday(goal.deadlineISO);
  const remaining = Math.max(0, goal.targetCents - goal.savedCents);
  const required = Math.ceil(remaining / Math.max(1, months));
  const weekly = Math.ceil(remaining / Math.max(1, months * 4.33));
  const fit = monthlySurplus > 0 ? required / monthlySurplus : 1;
  const progress = goal.targetCents > 0 ? Math.min(100, (goal.savedCents / goal.targetCents) * 100) : 0;

  const milestones = [25, 50, 75, 100].map((percent) => {
    const amount = Math.round((goal.targetCents * percent) / 100);
    const monthsFromNow = Math.max(0, Math.ceil((months * percent) / 100));
    return { percent, amount, monthsFromNow };
  });

  return (
    <Modal
      open={!!goal}
      onClose={onClose}
      title={goal.title}
      subtitle={goal.description || "Plano sugerido pelo Ninho"}
      icon={<meta.icon size={17} />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {progress < 100 ? <Button onClick={() => onContribute(goal)}><ArrowDownLeft size={14} /> Guardar agora</Button> : null}
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="Meta" value={formatBRL(goal.targetCents)} />
          <Mini label="Guardado" value={formatBRL(goal.savedCents)} />
          <Mini label="Falta" value={formatBRL(remaining)} />
          <Mini label="Prazo" value={formatDate(goal.deadlineISO)} hint={monthsLabel(months)} />
        </div>
        <div>
          <div className="flex items-center justify-between text-[9.5px] font-semibold text-[var(--muted)]">
            <span>Progresso</span><span className="num">{Math.round(progress)}%</span>
          </div>
          <ProgressBar className="mt-1.5" value={progress} height={7} />
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text)]"><Sparkles size={13} style={{ color: "var(--accent)" }} /> Como o Ninho sugere chegar lá</p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-soft)]">{categoryAdvice(goal.category)}</p>
          <ul className="mt-2.5 space-y-1.5">
            <li className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
              <Check size={11} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
              Separe <strong className="num text-[var(--text-soft)]">{formatBRL(required)}</strong> por mês ou <strong className="num text-[var(--text-soft)]">{formatBRL(weekly)}</strong> por semana.
            </li>
            <li className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
              <Check size={11} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
              {fit <= 0.3
                ? "Cabe com conforto na sua sobra média. Automatize no dia do recebimento."
                : fit <= 0.65
                  ? "Exige disciplina: programe a transferência logo que receber e revise os gastos variáveis."
                  : "Está apertado para a sobra atual. Alongue o prazo, reduza o alvo ou aumente a renda antes de começar."}
            </li>
            <li className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
              <Check size={11} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
              Verifique seus gastos variáveis no Plano do mês antes de aumentar o aporte.
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-bold text-[var(--text)]">Marcos do caminho</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {milestones.map((milestone) => (
              <div key={milestone.percent} className="rounded-xl border p-2.5" style={{ borderColor: milestone.amount <= goal.savedCents ? "var(--accent)" : "var(--border)", background: milestone.amount <= goal.savedCents ? "var(--success-soft)" : "var(--surface-2)" }}>
                <p className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-[0.06em] text-[var(--muted)]">
                  {milestone.percent}% {milestone.amount <= goal.savedCents ? <Check size={9} style={{ color: "var(--success)" }} /> : null}
                </p>
                <p className="num mt-1 text-[10.5px] font-semibold text-[var(--text)]">{formatBRL(milestone.amount)}</p>
                <p className="mt-0.5 text-[8px] text-[var(--faint)]">{milestone.percent === 100 ? "meta concluída" : `em ~${milestone.monthsFromNow} meses`}</p>
              </div>
            ))}
          </div>
        </div>

        {goal.contributions.length ? (
          <div>
            <p className="text-[10px] font-bold text-[var(--text)]">Histórico de aportes</p>
            <div className="mt-2 space-y-1">
              {goal.contributions.slice().reverse().slice(0, 6).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <span className="min-w-0 truncate text-[9px] text-[var(--muted)]">{formatDate(entry.dateISO)}{entry.note ? ` · ${entry.note}` : ""}</span>
                  <span className="num shrink-0 text-[9.5px] font-semibold" style={{ color: "var(--success)" }}>+ {formatBRL(entry.amountCents)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
