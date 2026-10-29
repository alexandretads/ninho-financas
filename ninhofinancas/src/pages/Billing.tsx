import React from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CreditCard,
  Landmark,
  LockKeyhole,
  QrCode,
  ReceiptText,
  Ticket,
  TrendingUp,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import type { Page } from "../components/Layout";
import { Badge, Button, ConfirmDialog, Field, Input, Modal, SectionHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import {
  MODULE_CATALOG,
  PLANS,
  PLAN_ORDER,
  accessLabel,
  promotionPrice,
  annualSavings,
  monthlyEquivalentCents,
  useAuth,
  type PlanId,
} from "../state/auth";
import { formatBRL } from "../lib/money";
import { formatDate } from "../lib/date";
import { loadPaymentsConfig, openStripeBillingPortal, startStripeCheckout, type PaymentsConfig } from "../lib/payments";
import { SUPPORT_EMAIL } from "../state/auth";
import { cn } from "../utils/cn";

function luhnValid(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function formatCardNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export default function Billing({ onNavigate, paywall = false }: { onNavigate: (page: Page) => void; paywall?: boolean }) {
  const { account, household, db, hasAccess, subscribe, cancelSubscription, myPromotions, canUseModule } = useAuth();
  const toast = useToast();
  const [selectedPlan, setSelectedPlan] = React.useState<PlanId>(account?.planId ?? "monthly_shared");
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [method, setMethod] = React.useState<"card" | "pix">("card");
  const [cardNumber, setCardNumber] = React.useState("");
  const [cardName, setCardName] = React.useState(account?.name ?? "");
  const [expiry, setExpiry] = React.useState("");
  const [cvv, setCvv] = React.useState("");
  const [errors, setErrors] = React.useState<string[]>([]);
  const [pixGenerated, setPixGenerated] = React.useState(false);
  const [promoCode, setPromoCode] = React.useState("");
  const [appliedPromoId, setAppliedPromoId] = React.useState<string | null>(null);
  const [paymentsConfig, setPaymentsConfig] = React.useState<PaymentsConfig | null>(null);
  const [provider, setProvider] = React.useState<"checking" | "stripe" | "demo">("checking");
  const [paymentBusy, setPaymentBusy] = React.useState(false);
  const [pagePayments, setPagePayments] = React.useState<PaymentsConfig | null>(null);
  const [portalBusy, setPortalBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    loadPaymentsConfig().then((config) => {
      if (active) setPagePayments(config);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!account) return null;
  const owner = db.accounts.find((item) => item.id === household?.ownerId);
  const isOwner = owner?.id === account.id;
  const canManage = isOwner || account.role === "admin";
  const effectivePlanId = isOwner ? account.planId : owner?.planId ?? account.planId;
  const plan = PLANS[effectivePlanId];
  const members = (household?.memberIds ?? [])
    .map((memberId) => db.accounts.find((item) => item.id === memberId))
    .filter(Boolean);
  const savings = annualSavings(effectivePlanId);

  async function manageStripeSubscription() {
    const stripePayment = account?.payments.find((payment) => payment.note?.startsWith("Stripe") && payment.reference.startsWith("cs_"));
    if (!stripePayment) {
      toast.push("Nenhuma assinatura Stripe encontrada neste login.", "warning");
      return;
    }
    setPortalBusy(true);
    const result = await openStripeBillingPortal({ sessionId: stripePayment.reference });
    setPortalBusy(false);
    if (result.ok && result.url) {
      window.location.assign(result.url);
      return;
    }
    toast.push(result.error ?? "Não foi possível abrir o gerenciamento da assinatura.", "error");
  }

  function openCheckout(planId: PlanId) {
    if (!canManage) {
      toast.push("A assinatura é gerenciada pelo titular do Ninho. Peça a ele para trocar o plano.", "warning");
      return;
    }
    setSelectedPlan(planId);
    setMethod("card");
    setCardNumber("");
    setExpiry("");
    setCvv("");
    setCardName(account?.name ?? "");
    setErrors([]);
    setPixGenerated(false);
    setAppliedPromoId(null);
    setPromoCode("");
    setCheckoutOpen(true);
    setProvider("checking");
    setPaymentsConfig(null);
    setPaymentBusy(false);
    loadPaymentsConfig().then((config) => {
      setPaymentsConfig(config);
      setProvider(config.mode);
    });
  }

  function confirmPayment() {
    if (provider === "stripe") {
      setErrors([]);
      setPaymentBusy(true);
      startStripeCheckout({ planId: selectedPlan, email: account?.email })
        .then((result) => {
          if (result.ok && result.url) {
            window.location.assign(result.url);
            return;
          }
          setErrors([result.error ?? "Não foi possível abrir o checkout do Stripe."]);
          setPaymentBusy(false);
        })
        .catch(() => {
          setErrors(["Falha ao iniciar o pagamento. Tente novamente."]);
          setPaymentBusy(false);
        });
      return;
    }

    const nextErrors: string[] = [];
    if (method === "card") {
      if (!luhnValid(cardNumber)) nextErrors.push("Número do cartão inválido. Use um número de teste válido, como 4242 4242 4242 4242.");
      if (cardName.trim().length < 3) nextErrors.push("Informe o nome impresso no cartão.");
      const [month, year] = expiry.split("/").map(Number);
      if (!month || !year || month < 1 || month > 12) nextErrors.push("Validade inválida (MM/AA).");
      else {
        const expires = new Date(2000 + year, month, 0, 23, 59, 59);
        if (expires < new Date()) nextErrors.push("O cartão está vencido.");
      }
      if (cvv.replace(/\D/g, "").length < 3) nextErrors.push("CVV inválido.");
    } else if (!pixGenerated) {
      setPixGenerated(true);
      return;
    }
    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }
    const result = subscribe(selectedPlan, method, appliedPromotion?.promotion.code);
    if (!result.ok) {
      setErrors([result.message ?? "Não foi possível concluir."]);
      return;
    }
    setCheckoutOpen(false);
    toast.push(
      appliedPromotion
        ? `Plano ${PLANS[selectedPlan].label} ativado com ${appliedPromotion.promotion.discountPercent}% de desconto. Pagamento simulado.`
        : `Plano ${PLANS[selectedPlan].label} ativado. Este pagamento é simulado; nenhuma cobrança real foi feita.`
    );
  }

  const selected = PLANS[selectedPlan];
  const availablePromotions = myPromotions.filter((entry) => !entry.expired && !entry.redeemed);
  const appliedPromotion = availablePromotions.find((entry) => entry.promotion.id === appliedPromoId && (entry.promotion.planIds.length === 0 || entry.promotion.planIds.includes(selectedPlan))) ?? null;
  const serverPriceCents = paymentsConfig?.plans?.[selectedPlan];
  const listPriceCents = provider === "stripe" && typeof serverPriceCents === "number" ? serverPriceCents : selected.priceCents;
  const finalPriceCents = provider === "stripe"
    ? listPriceCents
    : appliedPromotion
      ? promotionPrice(selected.priceCents, appliedPromotion.promotion.discountPercent)
      : selected.priceCents;

  return (
    <div className="page-enter">
      {paywall ? (
        <div className="mb-4 rounded-2xl border p-4" style={{ borderColor: "rgba(255,144,121,.3)", background: "var(--coral-soft)" }}>
          <p className="font-display text-[14px] font-semibold text-[var(--danger)]">
            {account?.blocked ? "Seu acesso está bloqueado" : account?.subscriptionStatus === "canceled" ? "Seu período de acesso terminou" : "Seu período de teste terminou"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-soft)]">
            {account?.blocked
              ? "Fale com o administrador do Ninho para reativar este login."
              : "Escolha um plano para voltar a salvar e editar seus dados. Nada foi apagado: tudo continua guardado neste login."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">Assinatura Ninho</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Seu plano<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">Tudo do Ninho, do jeito que faz sentido para sua casa.</p>
        </div>
        {account.role !== "admin" ? (
          <Button variant="secondary" onClick={() => onNavigate("settings")}>
            <Users size={14} /> Gerenciar casa
          </Button>
        ) : null}
      </div>

      <section className="panel mt-5 overflow-hidden">
        <div
          aria-hidden
          className="h-[3px] w-full"
          style={{ background: "linear-gradient(90deg, var(--accent), rgba(125,211,252,.55), transparent)" }}
        />
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={account.compAccess ? "accent" : hasAccess ? "sky" : "coral"} dot>
                {account.compAccess ? "Acesso gratuito liberado" : accessLabel(account)}
              </Badge>
              {account.compAccess && account.compNote ? <span className="text-[9.5px] text-[var(--muted)]">{account.compNote}</span> : null}
            </div>
            <p className="font-display mt-3 text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">{plan.label}</p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              {isOwner ? "Você é o titular deste Ninho." : `Titular: ${owner?.name ?? "—"}`} · {members.length} de {plan.seats} login{plan.seats === 1 ? "" : "s"}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <div>
                <p className="text-[8.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--faint)]">Valor</p>
                <p className="num mt-0.5 text-[14px] font-semibold text-[var(--text)]">
                  {formatBRL(plan.priceCents)}<span className="text-[9px] text-[var(--muted)]">/{plan.period === "year" ? "ano" : "mês"}</span>
                </p>
              </div>
              <div>
                <p className="text-[8.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--faint)]">
                  {account.subscriptionStatus === "trial" ? "Teste até" : "Renova em"}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-soft)]">
                  {formatDate((account.subscriptionStatus === "trial" ? account.trialEndsAtISO : account.currentPeriodEndISO ?? account.trialEndsAtISO).slice(0, 10), "long")}
                </p>
              </div>
              {savings ? (
                <div>
                  <p className="text-[8.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--faint)]">Economia no ano</p>
                  <p className="num mt-0.5 text-[11px] font-semibold" style={{ color: "var(--success)" }}>
                    {formatBRL(savings.savingsCents)} ({savings.percent.toFixed(1).replace(".", ",")}%)
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button onClick={() => openCheckout(effectivePlanId)} disabled={!canManage}>
              <CreditCard size={14} /> {canManage ? "Renovar / trocar plano" : "Gerenciado pelo titular"}
            </Button>
            {canManage && pagePayments?.configured && account.payments.some((payment) => payment.note?.startsWith("Stripe")) ? (
              <Button variant="secondary" onClick={manageStripeSubscription} disabled={portalBusy}>
                <Wallet size={14} /> {portalBusy ? "Abrindo..." : "Gerenciar assinatura"}
              </Button>
            ) : canManage && account.subscriptionStatus === "active" && !account.compAccess ? (
              <Button variant="secondary" onClick={() => setCancelOpen(true)}>Cancelar</Button>
            ) : null}
          </div>
        </div>
        {!canManage ? (
          <div className="border-t px-4 py-2.5 text-[9px] text-[var(--muted)] sm:px-5" style={{ borderColor: "var(--border)" }}>
            Você faz parte do Ninho de {owner?.name}. A assinatura, o cancelamento e a troca de plano são feitos pelo titular.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2.5 text-[9px] text-[var(--faint)] sm:px-5">
          <span className="flex items-center gap-1"><ShieldCheck size={10} /> Senha com hash</span>
          <span className="flex items-center gap-1"><LockKeyhole size={10} /> Dados salvos no seu login</span>
          <span className="flex items-center gap-1"><Users size={10} /> {plan.shared ? "Até 2 pessoas" : "1 pessoa"}</span>
        </div>
      </section>

      <section className="panel mt-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border)", background: canUseModule("sales") ? "var(--success-soft)" : "var(--surface-2)", color: canUseModule("sales") ? "var(--accent)" : "var(--muted)" }}>
              <TrendingUp size={16} />
            </span>
            <div>
              <p className="text-[12px] font-bold text-[var(--text)]">Módulo {MODULE_CATALOG.sales.label}</p>
              <p className="mt-0.5 max-w-[520px] text-[9.5px] leading-relaxed text-[var(--muted)]">
                {MODULE_CATALOG.sales.description} Liberado pelo administrador do Ninho — não é ativado automaticamente pelo plano.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={canUseModule("sales") ? "accent" : "neutral"} dot>
              {canUseModule("sales") ? "Liberado" : "Bloqueado"}
            </Badge>
            {!canUseModule("sales") ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Solicita%C3%A7%C3%A3o%20de%20libera%C3%A7%C3%A3o%20do%20m%C3%B3dulo%20de%20Vendas&body=Ol%C3%A1%2C%20gostaria%20de%20liberar%20o%20m%C3%B3dulo%20de%20Vendas%20%26%20Comiss%C3%B5es%20no%20meu%20Ninho.`;
                }}
              >
                <Users size={12} /> Solicitar liberação
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-6 flex items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">Escolha seu plano</h2>
          <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">Pagamento simulado neste ambiente. Você pode trocar depois.</p>
        </div>
        <div className="hidden h-px flex-1 sm:block" style={{ background: "var(--border)" }} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((planId) => {
          const item = PLANS[planId];
          const save = annualSavings(planId);
          const isCurrent = effectivePlanId === planId;
          return (
            <article
              key={planId}
              className={cn("panel relative flex flex-col p-4", isCurrent && "ring-1")}
              style={isCurrent ? { borderColor: "var(--accent)" } : undefined}
            >
              {save ? (
                <span className="absolute right-3 top-3 rounded-full px-2 py-1 text-[8px] font-extrabold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                  −{save.percent.toFixed(1).replace(".", ",")}%
                </span>
              ) : null}
              <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">{item.shared ? "Compartilhado" : "Individual"}</p>
              <p className="font-display mt-1 text-[13px] font-semibold text-[var(--text)]">{item.period === "year" ? "Anual" : "Mensal"}</p>
              <p className="num mt-3 text-[24px] font-semibold leading-none text-[var(--text)]">
                {formatBRL(item.priceCents)}
              </p>
              <p className="mt-1 text-[9px] text-[var(--muted)]">
                {item.period === "year" ? `equivale a ${formatBRL(monthlyEquivalentCents(planId))}/mês` : "por mês"}
              </p>
              {save ? (
                <p className="mt-2 text-[9px] font-semibold" style={{ color: "var(--success)" }}>
                  Economize {formatBRL(save.savingsCents)} vs. 12x mensal
                </p>
              ) : (
                <p className="mt-2 text-[9px] text-[var(--faint)]">Cancele quando quiser</p>
              )}
              <ul className="mt-3 flex-1 space-y-1.5">
                {item.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[var(--text-soft)]">
                    <Check size={11} className="mt-0.5 shrink-0" style={{ color: "var(--success)" }} /> {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                variant={isCurrent ? "secondary" : "primary"}
                size="sm"
                onClick={() => openCheckout(planId)}
                disabled={!canManage}
              >
                {isCurrent ? "Renovar este plano" : "Escolher"} <ArrowRight size={12} />
              </Button>
            </article>
          );
        })}
      </div>

      {availablePromotions.length ? (
        <section className="panel mt-4 overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
            <Ticket size={14} className="text-[var(--accent)]" />
            <div>
              <p className="font-display text-[13px] font-semibold text-[var(--text)]">Promoções para você</p>
              <p className="mt-0.5 text-[9.5px] text-[var(--muted)]">{availablePromotions.length} oferta{availablePromotions.length === 1 ? "" : "s"} ativa{availablePromotions.length === 1 ? "" : "s"} no seu login</p>
            </div>
            <Badge tone="accent" className="ml-auto">{availablePromotions.length}</Badge>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
            {availablePromotions.slice(0, 4).map(({ promotion }) => (
              <div key={promotion.id} className="rounded-xl border p-3" style={{ borderColor: "var(--accent)", background: "var(--success-soft)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[10.5px] font-bold text-[var(--text)]">{promotion.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-[var(--text-soft)]">{promotion.message}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>−{promotion.discountPercent}%</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="chip font-mono !py-0.5 !text-[8.5px]">{promotion.code}</span>
                  <span className="text-[8px] text-[var(--muted)]">até {formatDate(promotion.expiresAtISO.slice(0, 10))}</span>
                </div>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => {
                    const planId = promotion.planIds[0] ?? selectedPlan;
                    setSelectedPlan(planId);
                    setMethod("card");
                    setCardNumber("");
                    setExpiry("");
                    setCvv("");
                    setErrors([]);
                    setPixGenerated(false);
                    setAppliedPromoId(promotion.id);
                    setPromoCode(promotion.code);
                    setCheckoutOpen(true);
                  }}
                >
                  Usar cupom
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-4 sm:p-5">
          <SectionHeader title="Quem está no Ninho" description={plan.shared ? "Até 2 logins neste plano" : "Plano individual: 1 login"} action={<Users size={15} className="text-[var(--muted)]" />} />
          <div className="space-y-2">
            {members.map((member) => member ? (
              <div key={member.id} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "var(--surface-3)", color: "var(--accent)" }}>
                  {member.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-[var(--text)]">{member.name}{member.id === owner?.id ? " · titular" : ""}</p>
                  <p className="truncate text-[9px] text-[var(--muted)]">{member.email}</p>
                </div>
                <Badge tone={member.id === account.id ? "accent" : "neutral"}>{member.id === account.id ? "você" : "convidado"}</Badge>
              </div>
            ) : null)}
          </div>
          {isOwner ? (
            <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => onNavigate("settings")}>
              <Users size={12} /> Convidar por e-mail
            </Button>
          ) : null}
        </section>

        <section className="panel p-4 sm:p-5">
          <SectionHeader title="Pagamentos" description="Recibos simulados deste login" action={<ReceiptText size={15} className="text-[var(--muted)]" />} />
          {account.payments.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: "var(--border-strong)" }}>
              <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">Nenhum pagamento registrado. Você está no período de teste.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {account.payments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold text-[var(--text)]">{PLANS[payment.planId].label}</p>
                    <p className="text-[8.5px] text-[var(--muted)]">{formatDate(payment.atISO.slice(0, 10))} · {payment.method === "card" ? "Cartão" : "Pix"} · {payment.reference}</p>
                  </div>
                  <span className="num shrink-0 text-[10px] font-semibold text-[var(--text)]">{formatBRL(payment.amountCents)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-[8.5px] leading-relaxed text-[var(--faint)]">
            <XCircle size={10} className="mt-0.5 shrink-0" />
            {pagePayments?.configured
              ? "Assinaturas processadas pelo Stripe em ambiente seguro. O Ninho não armazena dados do cartão."
              : "Ambiente de demonstração: nenhuma cobrança real é efetuada. Configure STRIPE_SECRET_KEY no Netlify para cobrar assinaturas."}
          </p>
        </section>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar assinatura?"
        message="Você mantém o acesso até o fim do período já pago. Depois disso, o Ninho fica somente leitura até uma nova assinatura. Seus dados continuam salvos."
        confirmText="Cancelar assinatura"
        cancelText="Manter plano"
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          cancelSubscription();
          setCancelOpen(false);
          toast.push("Assinatura cancelada. Acesso mantido até o fim do período.");
        }}
      />

      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Finalizar assinatura"
        subtitle={`${selected.label} · ${formatBRL(selected.priceCents)}/${selected.period === "year" ? "ano" : "mês"}`}
        icon={<CreditCard size={17} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>Voltar</Button>
            <Button onClick={confirmPayment} disabled={paymentBusy || provider === "checking"}>
              {paymentBusy
                ? "Abrindo pagamento..."
                : provider === "stripe"
                  ? `Continuar para pagamento · ${formatBRL(listPriceCents)}`
                  : method === "pix" && !pixGenerated
                    ? "Gerar Pix"
                    : `Confirmar ${formatBRL(finalPriceCents)}`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-[var(--text)]">{selected.label}</p>
                <p className="mt-0.5 text-[9px] text-[var(--muted)]">{selected.description}</p>
              </div>
              <div className="text-right">
                {appliedPromotion && provider !== "stripe" ? (
                  <p className="num text-[10px] text-[var(--muted)] line-through">{formatBRL(selected.priceCents)}</p>
                ) : null}
                <p className="num shrink-0 text-[16px] font-semibold" style={{ color: appliedPromotion ? "var(--success)" : "var(--text)" }}>{formatBRL(finalPriceCents)}</p>
              </div>
            </div>
            {selected.period === "year" && annualSavings(selected.id) ? (
              <p className="mt-2 text-[9px] font-semibold" style={{ color: "var(--success)" }}>
                Você economiza {formatBRL(annualSavings(selected.id)!.savingsCents)} ({annualSavings(selected.id)!.percent.toFixed(1).replace(".", ",")}%) em relação ao mensal.
              </p>
            ) : null}
          </div>

          {provider === "checking" ? (
            <div className="rounded-xl border p-4 text-center text-[10px] text-[var(--muted)]" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              Verificando a plataforma de pagamento…
            </div>
          ) : provider === "stripe" ? (
            <div className="space-y-3">
              <div className="rounded-xl border p-3" style={{ borderColor: "rgba(204,245,110,.25)", background: "var(--success-soft)" }}>
                <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-[var(--text)]"><ShieldCheck size={13} /> Pagamento seguro via Stripe</p>
                <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--text-soft)]">
                  Você será redirecionado ao checkout oficial do Stripe. O Ninho não recebe nem armazena os dados do cartão.
                </p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-[var(--muted)]">Plano</span>
                  <span className="font-bold text-[var(--text)]">{selected.label}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-[var(--muted)]">Cobrança</span>
                  <span className="num font-semibold text-[var(--text)]">{formatBRL(listPriceCents)}/{selected.period === "year" ? "ano" : "mês"}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-[var(--muted)]">Renovação</span>
                  <span className="text-[var(--text-soft)]">automática, cancele quando quiser</span>
                </div>
              </div>
              {availablePromotions.length ? (
                <p className="text-[9px] leading-relaxed text-[var(--muted)]">
                  Cupons internos de demonstração não se aplicam ao Stripe. Use um código promocional na tela segura do Stripe.
                </p>
              ) : null}
              <p className="flex items-start gap-2 text-[8.5px] leading-relaxed text-[var(--faint)]">
                <LockKeyhole size={10} className="mt-0.5 shrink-0" /> Ao continuar, você aceita a cobrança recorrente do plano selecionado. O recibo é enviado pelo Stripe.
              </p>
              {account.payments.some((payment) => payment.note?.startsWith("Stripe")) ? (
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
                    Você já tem uma assinatura Stripe. Para trocar o plano sem duplicar cobrança, use o portal de gerenciamento.
                  </p>
                  <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={manageStripeSubscription} disabled={portalBusy}>
                    <Wallet size={12} /> Abrir portal do Stripe
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
          <div className="rounded-xl border p-3" style={{ borderColor: "rgba(247,200,115,.25)", background: "rgba(247,200,115,.06)" }}>
            <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
              <strong className="text-[var(--text-soft)]">Modo demonstração:</strong> nenhum valor real é cobrado. Configure <code className="font-mono text-[8.5px]">STRIPE_SECRET_KEY</code> no Netlify para ativar o checkout real.
            </p>
          </div>

          {availablePromotions.length ? (
            <Field label="Cupom de desconto" hint={appliedPromotion ? `Cupom ${appliedPromotion.promotion.code} aplicado: ${appliedPromotion.promotion.discountPercent}% de desconto.` : "Tem uma promoção? Selecione um cupom recebido."}>
              <div className="flex gap-1.5">
                <select
                  className="input"
                  value={appliedPromoId ?? ""}
                  onChange={(event) => {
                    const id = event.target.value || null;
                    setAppliedPromoId(id);
                    const found = availablePromotions.find((entry) => entry.promotion.id === id);
                    setPromoCode(found?.promotion.code ?? "");
                  }}
                  aria-label="Selecionar cupom"
                >
                  <option value="">Sem cupom</option>
                  {availablePromotions.map(({ promotion }) => (
                    <option key={promotion.id} value={promotion.id}>{promotion.code} · −{promotion.discountPercent}%</option>
                  ))}
                </select>
                <Input value={promoCode} readOnly aria-label="Código do cupom" className="!w-[120px] font-mono" />
              </div>
            </Field>
          ) : null}

          <div className="segmented">
            <button type="button" data-active={method === "card"} onClick={() => setMethod("card")}><CreditCard size={12} className="mr-1 inline" /> Cartão</button>
            <button type="button" data-active={method === "pix"} onClick={() => { setMethod("pix"); setPixGenerated(false); }}><QrCode size={12} className="mr-1 inline" /> Pix</button>
          </div>

          {method === "card" ? (
            <div className="space-y-3">
              <Field label="Número do cartão" hint="Teste com 4242 4242 4242 4242.">
                <Input value={cardNumber} onChange={(event) => setCardNumber(formatCardNumber(event.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" />
              </Field>
              <Field label="Nome impresso no cartão">
                <Input value={cardName} onChange={(event) => setCardName(event.target.value)} placeholder="Como está no cartão" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Validade">
                  <Input value={expiry} onChange={(event) => setExpiry(formatExpiry(event.target.value))} placeholder="MM/AA" inputMode="numeric" />
                </Field>
                <Field label="CVV">
                  <Input value={cvv} onChange={(event) => setCvv(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" />
                </Field>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              {pixGenerated ? (
                <>
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}>
                    <QrCode size={72} style={{ color: "var(--text)" }} />
                  </div>
                  <p className="mt-2 text-[10px] font-bold text-[var(--text)]">Pix simulado gerado</p>
                  <p className="mt-1 break-all rounded-lg border px-2 py-1.5 text-[8px] text-[var(--muted)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    00020126360014BR.GOV.BCB.PIX0114ninho@pagamentos5204000053039865802BR5915NINHO FINANCAS6009SAO PAULO
                  </p>
                  <p className="mt-1.5 text-[8.5px] text-[var(--faint)]">Clique em confirmar para registrar o pagamento demonstrativo.</p>
                </>
              ) : (
                <>
                  <Landmark size={26} className="mx-auto text-[var(--muted)]" />
                  <p className="mt-2 text-[10.5px] font-bold text-[var(--text)]">Pague com Pix</p>
                  <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">Geramos um QR e um código copia e cola simulados para registrar sua assinatura.</p>
                </>
              )}
            </div>
          )}

          {errors.length ? (
            <ul className="space-y-1 rounded-xl border p-2.5" style={{ borderColor: "rgba(255,128,140,.3)", background: "var(--coral-soft)" }}>
              {errors.map((error) => (
                <li key={error} className="text-[9.5px] leading-relaxed text-[var(--danger)]">• {error}</li>
              ))}
            </ul>
          ) : null}

          <p className="flex items-start gap-2 text-[8.5px] leading-relaxed text-[var(--faint)]">
            <LockKeyhole size={10} className="mt-0.5 shrink-0" />
            Demonstração segura: os dados do cartão não são armazenados. Nenhuma cobrança real é processada. Em produção, use um gateway com tokenização PCI.
          </p>
            </>
          )}
          <div className="flex items-center gap-2">
            <BadgeCheck size={12} style={{ color: "var(--success)" }} />
            <span className="text-[9px] text-[var(--muted)]">Ativação imediata após confirmação</span>
            <CalendarDays size={12} className="ml-auto text-[var(--faint)]" />
            <span className="text-[9px] text-[var(--muted)]">Renovação automática simulada</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
