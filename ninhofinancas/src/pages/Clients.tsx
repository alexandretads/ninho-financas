import React from "react";
import {
  BadgePercent,
  Check,
  Copy,
  Crown,
  Gift,
  LockKeyhole,
  Search,
  Send,
  Sparkles,
  Ticket,
  Unlock,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  SectionHeader,
  ProgressBar,
} from "../components/ui";
import { useToast } from "../components/Toast";
import {
  PLANS,
  PLAN_ORDER,
  accessLabel,
  accountHasAccess,
  MODULE_CATALOG,
  moduleOwnerFor,
  modulesForAccount,
  ownerPlanId,
  planForAccount,
  promotionPrice,
  useAuth,
  type NinhoAccount,
  type PlanId,
  type PromotionAudience,
  type PromotionInput,
} from "../state/auth";
import { formatBRL } from "../lib/money";
import { formatDate } from "../lib/date";
import { cn } from "../utils/cn";

type StatusFilter = "all" | "paying" | "trial" | "free" | "expired" | "blocked";
type PromoTarget = { kind: "bulk" } | { kind: "single"; account: NinhoAccount };

function accountStatus(account: NinhoAccount) {
  if (account.blocked) return { key: "blocked" as const, label: "Bloqueado", tone: "coral" as const };
  if (account.compAccess) return { key: "free" as const, label: "Cortesia", tone: "accent" as const };
  if (account.subscriptionStatus === "active" && accountHasAccess(account)) return { key: "paying" as const, label: "Assinante", tone: "accent" as const };
  if (account.subscriptionStatus === "trial" && accountHasAccess(account)) return { key: "trial" as const, label: "Em teste", tone: "sky" as const };
  if (account.subscriptionStatus === "canceled") return { key: "expired" as const, label: "Cancelado", tone: "amber" as const };
  return { key: "expired" as const, label: "Expirado", tone: "coral" as const };
}

const AUDIENCE_OPTIONS: Array<{ value: PromotionAudience; label: string }> = [
  { value: "all", label: "Todos os clientes" },
  { value: "paying", label: "Assinantes ativos" },
  { value: "trial", label: "Em período de teste" },
  { value: "expired", label: "Expirados / sem acesso" },
];

export default function Clients() {
  const { db, account, isAdmin, sendPromotion, promotions, deliveries, adminSetModule } = useAuth();
  const toast = useToast();
  const [query, setQuery] = React.useState("");
  const [planFilter, setPlanFilter] = React.useState<"all" | PlanId>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [promoTarget, setPromoTarget] = React.useState<PromoTarget | null>(null);
  const [detail, setDetail] = React.useState<NinhoAccount | null>(null);

  if (!isAdmin || !account) {
    return (
      <div className="page-enter panel p-6 text-center">
        <Crown size={26} className="mx-auto text-[var(--muted)]" />
        <p className="font-display mt-2 text-[16px] font-semibold text-[var(--text)]">Área restrita</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">Somente administradores podem ver os clientes.</p>
      </div>
    );
  }

  const clients = db.accounts.filter((item) => item.role !== "admin");
  const paying = clients.filter((item) => accountStatus(item).key === "paying");
  const free = clients.filter((item) => accountStatus(item).key === "free");
  const trial = clients.filter((item) => accountStatus(item).key === "trial");
  const blocked = clients.filter((item) => item.blocked);
  const mrr = paying.reduce((total, item) => {
    const plan = planForAccount(db, item);
    return total + (plan.period === "year" ? Math.round(plan.priceCents / 12) : plan.priceCents);
  }, 0);
  const salesHouses = new Set(
    clients.filter((client) => modulesForAccount(db, client).includes("sales")).map((client) => client.householdId)
  ).size;
  const expiring = clients.filter((client) => {
    if (!accountHasAccess(client)) return false;
    const raw = client.subscriptionStatus === "trial" ? client.trialEndsAtISO : client.currentPeriodEndISO;
    if (!raw) return false;
    const days = (new Date(raw).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 7;
  });

  const filtered = clients
    .filter((client) => (planFilter === "all" ? true : ownerPlanId(db, client) === planFilter))
    .filter((client) => (statusFilter === "all" ? true : accountStatus(client).key === statusFilter))
    .filter((client) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      const home = db.households.find((item) => item.id === client.householdId);
      return `${client.name} ${client.email} ${home?.name ?? ""}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));

  const activePromotions = promotions.filter((promo) => new Date(promo.expiresAtISO) > new Date());

  return (
    <div className="page-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">Carteira do Ninho</p>
          <h1 className="font-display mt-1.5 text-[25px] font-semibold leading-tight tracking-[-0.045em] text-[var(--text)] sm:text-[30px]">
            Clientes<span style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="mt-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
            Planos contratados, renovações e promoções enviadas por você.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="secondary" onClick={() => setPromoTarget({ kind: "bulk" })}>
            <Users size={14} /> Promoção em massa
          </Button>
          <Button onClick={() => setPromoTarget({ kind: "single", account: clients[0] })} disabled={!clients.length}>
            <Gift size={14} /> Enviar promoção
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Clientes" value={`${clients.length}`} hint={`${db.households.length} Ninhos`} icon={<Users size={14} />} />
        <Kpi label="Assinantes" value={`${paying.length}`} hint={`${formatBRL(mrr)} de MRR`} icon={<TrendingUp size={14} />} />
        <Kpi label="Em teste" value={`${trial.length}`} hint={`${expiring.length} vencem em 7 dias`} icon={<Sparkles size={14} />} />
        <Kpi label="Cortesias" value={`${free.length}`} hint="liberadas pelo admin" icon={<Gift size={14} />} />
        <Kpi label="Bloqueados" value={`${blocked.length}`} hint={`${activePromotions.length} promoções ativas`} icon={<Crown size={14} />} />
        <Kpi label="Vendas liberadas" value={`${salesHouses}`} hint={`${clients.length} clientes na base`} icon={<TrendingUp size={14} />} />
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, e-mail ou Ninho..."
            aria-label="Buscar clientes"
            className="!min-h-[38px] !pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-[320px]">
          <Select
            ariaLabel="Filtrar plano contratado"
            value={planFilter}
            onChange={(value) => setPlanFilter(value as "all" | PlanId)}
            options={[{ value: "all", label: "Todos os planos" }, ...PLAN_ORDER.map((planId) => ({ value: planId, label: PLANS[planId].label }))]}
            className="!min-h-[38px]"
          />
          <Select
            ariaLabel="Filtrar status do cliente"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={[
              { value: "all", label: "Todos os status" },
              { value: "paying", label: "Assinantes" },
              { value: "trial", label: "Em teste" },
              { value: "free", label: "Cortesia" },
              { value: "expired", label: "Expirados" },
              { value: "blocked", label: "Bloqueados" },
            ]}
            className="!min-h-[38px]"
          />
        </div>
      </div>

      <section className="panel mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border)" }}>
          <SectionHeader
            title="Base de clientes"
            description={`${filtered.length} de ${clients.length} clientes · plano contratado e renovação`}
            className="!mb-0"
          />
          <Button size="sm" variant="ghost" onClick={() => setPromoTarget({ kind: "bulk" })}>
            <Send size={12} /> Promoção em massa
          </Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="Nenhum cliente encontrado"
            description="Ajuste a busca ou os filtros. Clientes entram aqui ao criar login no Ninho."
          />
        ) : (
          <div>
            {filtered.map((client, index) => {
              const planId = ownerPlanId(db, client);
              const plan = PLANS[planId];
              const home = db.households.find((item) => item.id === client.householdId);
              const owner = db.accounts.find((item) => item.id === home?.ownerId);
              const status = accountStatus(client);
              const renew = client.subscriptionStatus === "trial" ? client.trialEndsAtISO : client.currentPeriodEndISO;
              const received = deliveries.filter((delivery) => delivery.accountId === client.id).length;
              const isOwner = owner?.id === client.id;
              return (
                <div
                  key={client.id}
                  className="flex flex-wrap items-center gap-2.5 px-4 py-3 transition hover:bg-[var(--surface-2)] sm:px-5"
                  style={index < filtered.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-display text-[10px] font-bold"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: status.tone === "accent" ? "var(--accent)" : status.tone === "coral" ? "var(--coral)" : "var(--sky)" }}
                  >
                    {client.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}
                  </span>
                  <button type="button" onClick={() => setDetail(client)} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[11.5px] font-bold text-[var(--text)]">{client.name}</p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {!isOwner ? <span className="chip !py-0.5 !text-[7.5px]">convidado</span> : null}
                    </div>
                    <p className="mt-0.5 truncate text-[9.5px] text-[var(--muted)]">{client.email} · {home?.name ?? "sem Ninho"}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 truncate text-[8.5px] text-[var(--faint)]">
                      {isOwner ? "titular" : `titular: ${owner?.name ?? "—"}`} · {home?.memberIds.length ?? 1} login(s) · {received} promoções recebidas
                      <span
                        className="rounded-full border px-1.5 py-0.5 text-[7.5px] font-bold"
                        style={
                          modulesForAccount(db, client).includes("sales")
                            ? { borderColor: "rgba(185,239,125,.25)", background: "var(--success-soft)", color: "var(--success)" }
                            : { borderColor: "var(--border)", background: "var(--surface-3)", color: "var(--muted)" }
                        }
                      >
                        {modulesForAccount(db, client).includes("sales") ? "vendas liberadas" : "vendas bloqueadas"}
                      </span>
                    </p>
                  </button>
                  <div className="hidden w-[150px] shrink-0 lg:block">
                    <p className="text-[8px] font-extrabold uppercase tracking-[0.05em] text-[var(--faint)]">Plano contratado</p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--text)]">{plan.shortLabel}</p>
                    <p className="num text-[9px] text-[var(--muted)]">{formatBRL(plan.priceCents)}/{plan.period === "year" ? "ano" : "mês"}</p>
                  </div>
                  <div className="hidden w-[105px] shrink-0 sm:block">
                    <p className="text-[8px] font-extrabold uppercase tracking-[0.05em] text-[var(--faint)]">
                      {client.subscriptionStatus === "trial" ? "Teste até" : "Renova em"}
                    </p>
                    <p className="mt-0.5 text-[9.5px] font-semibold text-[var(--text-soft)]">{renew ? formatDate(renew.slice(0, 10)) : "—"}</p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={modulesForAccount(db, client).includes("sales") ? `Revogar módulo de vendas de ${client.name}` : `Liberar módulo de vendas para ${client.name}`}
                      title={modulesForAccount(db, client).includes("sales") ? "Revogar módulo de vendas" : "Liberar módulo de vendas"}
                      onClick={() => {
                        const ownerTarget = moduleOwnerFor(db, client);
                        if (!ownerTarget) return;
                        const enabled = modulesForAccount(db, client).includes("sales");
                        const result = adminSetModule(ownerTarget.id, "sales", !enabled);
                        toast.push(result.message ?? (result.ok ? "Módulo atualizado." : "Não foi possível atualizar."), result.ok ? "success" : "error");
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-[var(--accent)]"
                      style={{
                        borderColor: "var(--border)",
                        background: modulesForAccount(db, client).includes("sales") ? "var(--success-soft)" : "var(--surface-2)",
                        color: modulesForAccount(db, client).includes("sales") ? "var(--success)" : "var(--muted)",
                      }}
                    >
                      {modulesForAccount(db, client).includes("sales") ? <Unlock size={13} /> : <LockKeyhole size={13} />}
                    </button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPromoTarget({ kind: "single", account: client })}
                    >
                      <Ticket size={12} /> Promoção
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-4 sm:p-5">
          <SectionHeader
            title="Receita por plano"
            description="Assinantes ativos (cortesias não entram no MRR)"
            action={<Wallet size={15} className="text-[var(--muted)]" />}
          />
          <div className="space-y-3">
            {PLAN_ORDER.map((planId) => {
              const count = paying.filter((client) => ownerPlanId(db, client) === planId).length;
              const plan = PLANS[planId];
              const value = count * (plan.period === "year" ? Math.round(plan.priceCents / 12) : plan.priceCents);
              return (
                <div key={planId}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-[var(--text)]">{plan.label}</span>
                    <span className="num text-[10px] font-semibold text-[var(--text-soft)]">{count} · {formatBRL(value)}/mês</span>
                  </div>
                  <ProgressBar className="mt-1.5" height={5} value={(count / Math.max(1, paying.length)) * 100} tone={plan.shared ? "sky" : "accent"} />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div>
              <p className="text-[8.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--faint)]">MRR simulado</p>
              <p className="num mt-0.5 text-[15px] font-semibold text-[var(--text)]">{formatBRL(mrr)}</p>
            </div>
            <div className="text-right">
              <p className="text-[8.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--faint)]">ARR equivalente</p>
              <p className="num mt-0.5 text-[12px] font-semibold text-[var(--text-soft)]">{formatBRL(mrr * 12)}</p>
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3.5" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="font-display text-[13px] font-semibold text-[var(--text)]">Promoções enviadas</p>
              <p className="mt-0.5 text-[9.5px] text-[var(--muted)]">{promotions.length} campanhas · {deliveries.length} entregas</p>
            </div>
            <BadgePercent size={15} className="text-[var(--accent)]" />
          </div>
          {promotions.length === 0 ? (
            <EmptyState
              icon={<Ticket size={19} />}
              title="Nenhuma promoção ainda"
              description="Crie um cupom individual ou envie para todos os clientes de uma vez."
              action={<Button size="sm" onClick={() => setPromoTarget({ kind: "bulk" })}><Gift size={12} /> Criar promoção</Button>}
              className="!py-6"
            />
          ) : (
            <div className="thin-scroll max-h-[330px] overflow-y-auto">
              {promotions.map((promotion, index) => {
                const promos = deliveries.filter((delivery) => delivery.promotionId === promotion.id);
                const read = promos.filter((delivery) => delivery.readAtISO).length;
                const redeemed = promos.filter((delivery) => delivery.redeemedAtISO).length;
                const expired = new Date(promotion.expiresAtISO) <= new Date();
                return (
                  <div
                    key={promotion.id}
                    className="px-4 py-2.5"
                    style={index < promotions.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10.5px] font-bold text-[var(--text)]">{promotion.title}</p>
                        <p className="mt-0.5 text-[8.5px] text-[var(--muted)]">
                          {promotion.discountPercent}% OFF · código <span className="font-mono">{promotion.code}</span> · {promos.length} envios
                        </p>
                      </div>
                      <Badge tone={expired ? "coral" : "accent"} dot>{expired ? "expirada" : "ativa"}</Badge>
                    </div>
                    <p className="mt-1 text-[8.5px] text-[var(--faint)]">
                      {read} lidas · {redeemed} resgatadas · expira {formatDate(promotion.expiresAtISO.slice(0, 10))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <PromotionModal
        target={promoTarget}
        clients={clients}
        onClose={() => setPromoTarget(null)}
        onSend={(input) => {
          const result = sendPromotion(input);
          toast.push(
            result.ok
              ? `Promoção enviada para ${result.recipients} ${result.recipients === 1 ? "cliente" : "clientes"}.`
              : result.message ?? "Não foi possível enviar.",
            result.ok ? "success" : "error"
          );
          if (result.ok) setPromoTarget(null);
        }}
      />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name ?? "Cliente"}
        subtitle={detail?.email}
        icon={<Users size={17} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>Fechar</Button>
            {detail ? (
              <Button onClick={() => { setPromoTarget({ kind: "single", account: detail }); setDetail(null); }}>
                <Ticket size={13} /> Enviar promoção
              </Button>
            ) : null}
          </>
        }
      >
        {detail ? <ClientDetails client={detail} /> : null}
      </Modal>
    </div>
  );
}

function Kpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--muted)]">{label}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "var(--success-soft)", color: "var(--accent)" }}>{icon}</span>
      </div>
      <p className="num mt-2 text-[17px] font-semibold leading-none text-[var(--text)]">{value}</p>
      <p className="mt-1 line-clamp-2 text-[8.5px] leading-snug text-[var(--faint)]">{hint}</p>
    </div>
  );
}

function ClientDetails({ client }: { client: NinhoAccount }) {
  const { db, adminSetModule } = useAuth();
  const toast = useToast();
  const home = db.households.find((item) => item.id === client.householdId);
  const owner = db.accounts.find((item) => item.id === home?.ownerId);
  const plan = planForAccount(db, client);
  const received = db.deliveries
    .filter((delivery) => delivery.accountId === client.id)
    .map((delivery) => ({ delivery, promotion: db.promotions.find((promo) => promo.id === delivery.promotionId) }))
    .filter((entry) => entry.promotion)
    .sort((a, b) => b.delivery.sentAtISO.localeCompare(a.delivery.sentAtISO));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="accent" dot>{accountStatus(client).label}</Badge>
        <Badge>{plan.label}</Badge>
        <Badge>{accessLabel(client)}</Badge>
        <Badge tone={modulesForAccount(db, client).includes("sales") ? "accent" : "neutral"} dot>
          {modulesForAccount(db, client).includes("sales") ? "Vendas liberadas" : "Vendas bloqueadas"}
        </Badge>
      </div>

      <div className="rounded-xl border p-3" style={{ borderColor: modulesForAccount(db, client).includes("sales") ? "var(--accent)" : "var(--border)", background: modulesForAccount(db, client).includes("sales") ? "var(--success-soft)" : "var(--surface-2)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[var(--text)]">Módulo {MODULE_CATALOG.sales.label}</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-[var(--muted)]">
              {MODULE_CATALOG.sales.description}
            </p>
            {owner?.id !== client.id ? (
              <p className="mt-1 text-[8.5px] text-[var(--faint)]">Convidado: herda a liberação do titular ({owner?.name}).</p>
            ) : null}
          </div>
          <Button
            size="sm"
            variant={modulesForAccount(db, client).includes("sales") ? "secondary" : "primary"}
            onClick={() => {
              const ownerTarget = moduleOwnerFor(db, client);
              if (!ownerTarget) return;
              const enabled = modulesForAccount(db, client).includes("sales");
              const result = adminSetModule(ownerTarget.id, "sales", !enabled);
              toast.push(result.message ?? (result.ok ? "Módulo atualizado." : "Não foi possível atualizar."), result.ok ? "success" : "error");
            }}
          >
            {modulesForAccount(db, client).includes("sales") ? <><LockKeyhole size={12} /> Bloquear</> : <><Unlock size={12} /> Liberar</>}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Info label="Plano contratado" value={`${plan.shortLabel} · ${formatBRL(plan.priceCents)}`} />
        <Info label="Titular" value={owner?.name ?? client.name} />
        <Info label="Ninho" value={home?.name ?? "—"} />
        <Info label="Logins" value={`${home?.memberIds.length ?? 1} de ${plan.seats}`} />
        <Info label="Entrou em" value={formatDate(client.createdAtISO.slice(0, 10))} />
        <Info label="Último acesso" value={client.lastLoginISO ? formatDate(client.lastLoginISO.slice(0, 10)) : "Nunca"} />
        <Info label="Teste até" value={formatDate(client.trialEndsAtISO.slice(0, 10))} />
        <Info label="Renovação" value={client.currentPeriodEndISO ? formatDate(client.currentPeriodEndISO.slice(0, 10)) : "—"} />
      </div>

      <div>
        <p className="text-[10px] font-bold text-[var(--text)]">Histórico de promoções</p>
        {received.length === 0 ? (
          <p className="mt-1 text-[9.5px] text-[var(--muted)]">Nenhuma promoção enviada para este cliente.</p>
        ) : (
          <div className="mt-1.5 space-y-1">
            {received.slice(0, 5).map(({ delivery, promotion }) => (
              <div key={delivery.id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <div className="min-w-0">
                  <p className="truncate text-[9.5px] font-semibold text-[var(--text)]">{promotion?.title}</p>
                  <p className="text-[8px] text-[var(--muted)]">
                    {delivery.redeemedAtISO ? "resgatada" : delivery.readAtISO ? "lida" : "não lida"} · {formatDate(delivery.sentAtISO.slice(0, 10))}
                  </p>
                </div>
                <span className="num shrink-0 text-[9px] font-semibold text-[var(--accent)]">−{promotion?.discountPercent}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-bold text-[var(--text)]">Pagamentos</p>
        {client.payments.length === 0 ? (
          <p className="mt-1 text-[9.5px] text-[var(--muted)]">Nenhum pagamento registrado.</p>
        ) : (
          <div className="mt-1.5 space-y-1">
            {client.payments.slice(0, 4).map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-2 text-[9px]">
                <span className="truncate text-[var(--muted)]">{formatDate(payment.atISO.slice(0, 10))} · {PLANS[payment.planId].label}</span>
                <span className="num font-semibold text-[var(--text)]">{formatBRL(payment.amountCents)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="text-[8px] font-extrabold uppercase tracking-[0.05em] text-[var(--faint)]">{label}</p>
      <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

function PromotionModal({
  target,
  clients,
  onClose,
  onSend,
}: {
  target: PromoTarget | null;
  clients: NinhoAccount[];
  onClose: () => void;
  onSend: (input: PromotionInput) => void;
}) {
  const [mode, setMode] = React.useState<"single" | "bulk">("bulk");
  const [accountId, setAccountId] = React.useState("");
  const [audience, setAudience] = React.useState<PromotionAudience>("all");
  const [title, setTitle] = React.useState("Um presente do Ninho");
  const [message, setMessage] = React.useState("Liberamos uma condição especial para você organizar suas finanças com a gente.");
  const [discount, setDiscount] = React.useState(20);
  const [planIds, setPlanIds] = React.useState<PlanId[]>(PLAN_ORDER);
  const [expiresInDays, setExpiresInDays] = React.useState(14);
  const [code, setCode] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!target) return;
    if (target.kind === "single") {
      setMode("single");
      setAccountId(target.account.id);
    } else {
      setMode("bulk");
      setAudience("all");
      setAccountId("");
    }
    setTitle("Um presente do Ninho");
    setMessage("Liberamos uma condição especial para você organizar suas finanças com a gente.");
    setDiscount(20);
    setPlanIds(PLAN_ORDER);
    setExpiresInDays(14);
    setCode(`NINHO${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
    setCopied(false);
  }, [target]);

  if (!target) return null;
  const effectiveAudience: PromotionAudience = mode === "single" ? "all" : audience;
  const estimated =
    mode === "single"
      ? clients.filter((client) => client.id === accountId).length
      : audience === "all"
        ? clients.length
        : audience === "paying"
          ? clients.filter((client) => accountStatus(client).key === "paying").length
          : audience === "trial"
            ? clients.filter((client) => accountStatus(client).key === "trial").length
            : clients.filter((client) => accountStatus(client).key === "expired" || accountStatus(client).key === "blocked").length;

  function togglePlan(planId: PlanId) {
    setPlanIds((current) => (current.includes(planId) ? current.filter((item) => item !== planId) : [...current, planId]));
  }

  function submit() {
    if (!planIds.length) return;
    onSend({
      title,
      message,
      discountPercent: discount,
      planIds,
      expiresInDays,
      code,
      audience: effectiveAudience,
      accountId: mode === "single" ? accountId : undefined,
    });
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={mode === "single" ? "Enviar promoção ao cliente" : "Promoção em massa"}
      subtitle={mode === "single" ? "O desconto aparece na caixa de entrada do cliente." : `Público estimado: ${estimated} clientes`}
      icon={<Ticket size={17} />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!planIds.length || estimated === 0}>
            <Send size={14} /> {mode === "single" ? "Enviar promoção" : `Enviar para ${estimated}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="segmented">
          <button type="button" data-active={mode === "single"} onClick={() => setMode("single")}>Um cliente</button>
          <button type="button" data-active={mode === "bulk"} onClick={() => setMode("bulk")}>Em massa</button>
        </div>

        {mode === "single" ? (
          <Field label="Cliente">
            <Select
              value={accountId}
              onChange={setAccountId}
              options={clients.map((client) => ({ value: client.id, label: `${client.name} · ${client.email}` }))}
            />
          </Field>
        ) : (
          <Field label="Público-alvo" hint="A promoção é entregue individualmente em cada login.">
            <Select value={audience} onChange={(value) => setAudience(value as PromotionAudience)} options={AUDIENCE_OPTIONS} />
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título da promoção">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: 20% no plano anual" />
          </Field>
          <Field label="Código do cupom">
            <div className="flex gap-1.5">
              <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="NINHO20" />
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(code);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </Button>
            </div>
          </Field>
        </div>

        <Field label="Mensagem">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="input resize-none"
            placeholder="Escreva a mensagem que o cliente vai ver..."
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Desconto (%)">
            <Input
              type="number"
              min={1}
              max={100}
              value={String(discount)}
              onChange={(event) => setDiscount(Math.max(1, Math.min(100, Number(event.target.value))))}
            />
          </Field>
          <Field label="Validade (dias)">
            <Input
              type="number"
              min={1}
              max={365}
              value={String(expiresInDays)}
              onChange={(event) => setExpiresInDays(Math.max(1, Math.min(365, Number(event.target.value))))}
            />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-bold text-[var(--text)]">Planos elegíveis</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PLAN_ORDER.map((planId) => {
              const selected = planIds.includes(planId);
              return (
                <button
                  key={planId}
                  type="button"
                  onClick={() => togglePlan(planId)}
                  className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition")}
                  style={{
                    borderColor: selected ? "var(--accent)" : "var(--border)",
                    background: selected ? "var(--success-soft)" : "var(--surface-2)",
                  }}
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border"
                    style={{
                      borderColor: selected ? "var(--accent)" : "var(--border-strong)",
                      background: selected ? "var(--accent)" : "transparent",
                      color: "var(--accent-ink)",
                    }}
                  >
                    {selected ? <Check size={10} strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[9.5px] font-bold text-[var(--text)]">{PLANS[planId].label}</span>
                    <span className="num block text-[8.5px] text-[var(--muted)]">
                      {formatBRL(promotionPrice(PLANS[planId].priceCents, discount))} com desconto
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-bold text-[var(--text-soft)]">
              {mode === "single" ? "Cliente selecionado" : "Público da campanha"}
            </span>
            <Badge tone="accent" dot>{estimated} {estimated === 1 ? "entrega" : "entregas"}</Badge>
          </div>
          <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
            A promoção ficará na caixa de entrada de cada cliente com o cupom <span className="font-mono text-[var(--text-soft)]">{code || "NINHO…"}</span>, validade de {expiresInDays} dias e desconto de {discount}% no checkout dos planos selecionados.
          </p>
        </div>
      </div>
    </Modal>
  );
}
