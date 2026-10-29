import React from "react";
import {
  ArrowLeftRight,
  CalendarRange,
  Check,
  CreditCard,
  Crown,
  Ticket,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  Sun,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useTheme } from "../state/theme";
import { useStore } from "../state/store";
import { PLANS, accessLabel, useAuth } from "../state/auth";
import { Avatar, Badge, Button, IconButton, Logo, Modal } from "./ui";
import { useToast } from "./Toast";
import { formatDate } from "../lib/date";

export type Page =
  | "overview"
  | "plan"
  | "goals"
  | "sales"
  | "transactions"
  | "card"
  | "billing"
  | "settings"
  | "clients"
  | "admin";

export const PAGE_META: Record<Page, { label: string; short: string }> = {
  overview: { label: "Visão geral", short: "Início" },
  plan: { label: "Plano do mês", short: "Plano" },
  goals: { label: "Metas", short: "Metas" },
  sales: { label: "Vendas & comissões", short: "Vendas" },
  transactions: { label: "Lançamentos", short: "Lançar" },
  card: { label: "Crédito do mês", short: "Crédito" },
  billing: { label: "Meu plano", short: "Plano" },
  settings: { label: "Ajustes", short: "Ajustes" },
  clients: { label: "Clientes", short: "Clientes" },
  admin: { label: "Administração", short: "Admin" },
};

type NavItem = { page: Page; label: string; icon: React.ElementType; adminOnly?: boolean };

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Finanças",
    items: [
      { page: "overview", label: "Visão geral", icon: LayoutDashboard },
      { page: "plan", label: "Plano do mês", icon: CalendarRange },
      { page: "goals", label: "Metas", icon: Target },
      { page: "card", label: "Crédito do mês", icon: CreditCard },
    ],
  },
  {
    title: "Trabalho",
    items: [
      { page: "sales", label: "Vendas & comissões", icon: TrendingUp },
      { page: "transactions", label: "Lançamentos", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Conta",
    items: [
      { page: "billing", label: "Assinatura", icon: Wallet },
      { page: "settings", label: "Ajustes", icon: Settings2 },
      { page: "clients", label: "Clientes", icon: Users, adminOnly: true },
      { page: "admin", label: "Administração", icon: Crown, adminOnly: true },
    ],
  },
];

const MOBILE_MAIN: NavItem[] = [
  { page: "overview", label: "Início", icon: LayoutDashboard },
  { page: "plan", label: "Plano", icon: CalendarRange },
  { page: "goals", label: "Metas", icon: Target },
  { page: "card", label: "Crédito", icon: CreditCard },
];

function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <IconButton label={next === "dark" ? "Ativar tema escuro" : "Ativar tema claro"} onClick={() => setTheme(next)}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </IconButton>
  );
}

export default function Layout({
  page,
  onNavigate,
  children,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}) {
  const { data } = useStore();
  const { account, household, hasAccess, isAdmin, signOut, pendingInvites, incomingInvites, acceptInvite, declineInvite, myPromotions, markPromotionRead, canUseModule } = useAuth();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [promosOpen, setPromosOpen] = React.useState(false);
  const unreadPromos = myPromotions.filter((item) => !item.delivery.readAtISO && !item.expired && !item.redeemed).length;
  const visibleGroupItems = (items: NavItem[]) =>
    items.filter((item) => (!item.adminOnly || isAdmin) && (item.page !== "sales" || canUseModule("sales")));
  const now = new Date();
  const savedTime = new Date(data.updatedAtISO).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const members = household?.memberIds.length ?? 1;
  const openInvites = incomingInvites.length;
  const toast = useToast();
  const planLabel = account ? accessLabel(account) : "—";

  function go(target: Page) {
    setMoreOpen(false);
    onNavigate(target);
  }

  return (
    <div className="min-h-dvh">
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[254px] flex-col border-r px-4 pb-5 pt-6 lg:flex"
        style={{ background: "var(--bg-deep)", borderColor: "var(--border)" }}
      >
        <div className="px-2"><Logo /></div>

        <div className="thin-scroll mt-7 flex-1 space-y-6 overflow-y-auto pb-2 pr-1">
          {NAV_GROUPS.map((group) => {
            const items = visibleGroupItems(group.items);
            if (!items.length) return null;
            return (
              <div key={group.title}>
                <p className="overline px-3">{group.title}</p>
                <nav className="mt-2 space-y-0.5" aria-label={group.title}>
                  {items.map((item) => {
                    const active = page === item.page;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.page}
                        type="button"
                        onClick={() => go(item.page)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-bold transition",
                          active
                            ? "text-[var(--accent-ink)]"
                            : "text-[var(--text-soft)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                        )}
                        style={active ? { background: "var(--accent)" } : undefined}
                      >
                        <Icon size={17} strokeWidth={active ? 2.2 : 1.9} />
                        <span className="flex-1">{item.label}</span>
                        {item.page === "settings" && pendingInvites.length ? (
                          <span className="rounded-full px-1.5 py-0.5 text-[8px] font-extrabold" style={{ background: "var(--coral)", color: "#2b0c08" }}>{pendingInvites.length}</span>
                        ) : null}
                        {active ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-ink)" }} /> : null}
                      </button>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <div className="rounded-2xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--accent)" }}>
                <ShieldCheck size={15} />
              </span>
              <span className="chip chip-accent !py-1 !text-[9px]"><Check size={9} /> {hasAccess ? "ativo" : "leitura"}</span>
            </div>
            <p className="mt-2.5 text-[11px] font-bold text-[var(--text)]">{household?.name ?? "Meu Ninho"}</p>
            <p className="mt-0.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
              {members} {members === 1 ? "pessoa" : "pessoas"} · {planLabel}
            </p>
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={() => go("settings")} className="flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[9px] font-extrabold text-[var(--text-soft)] transition hover:text-[var(--accent)]" style={{ borderColor: "var(--border)" }}>
                <Users size={10} /> Casa
              </button>
              <button type="button" onClick={() => go("billing")} className="flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[9px] font-extrabold text-[var(--text-soft)] transition hover:text-[var(--accent)]" style={{ borderColor: "var(--border)" }}>
                <Sparkles size={10} /> Plano
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between px-1">
            <span className="overline">Aparência</span>
            <ThemeButton />
          </div>

          <button
            type="button"
            onClick={() => go("settings")}
            className="mt-2 flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition hover:bg-[var(--surface)]"
            style={{ borderColor: "var(--border)" }}
          >
            <Avatar name={account?.name ?? data.profile.name} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-bold text-[var(--text)]">{account?.name ?? data.profile.name}</span>
              <span className="block truncate text-[9px] text-[var(--muted)]">{account?.email ?? data.profile.email}</span>
            </span>
            <Settings2 size={13} className="shrink-0 text-[var(--faint)]" />
          </button>
          <button type="button" onClick={signOut} className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9.5px] font-bold text-[var(--faint)] transition hover:text-[var(--coral)]">
            <LogOut size={11} /> Sair da conta
          </button>
        </div>
      </aside>

      <div className="lg:pl-[254px]">
        <header
          className="sticky top-0 z-30 border-b"
          style={{
            borderColor: "var(--border)",
            background: "color-mix(in srgb, var(--bg) 84%, transparent)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <div className="mx-auto flex h-[60px] w-full max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:h-[66px] lg:px-8">
            <div className="lg:hidden"><Logo /></div>
            <div className="hidden items-center gap-2.5 lg:flex">
              <span className="text-[11px] font-bold text-[var(--faint)]">Ninho</span>
              <span className="h-3 w-px" style={{ background: "var(--border-strong)" }} />
              <span className="font-display text-[13px] font-semibold text-[var(--text)]">{PAGE_META[page].label}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPromosOpen(true);
                  myPromotions.forEach((item) => {
                    if (!item.delivery.readAtISO) markPromotionRead(item.delivery.id);
                  });
                }}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-[var(--border-strong)]"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-soft)" }}
                aria-label="Abrir promoções"
                title="Promoções e cupons"
              >
                <Ticket size={16} />
                {unreadPromos ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-extrabold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
                    {unreadPromos}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => go(hasAccess ? "settings" : "billing")}
                className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-bold sm:flex"
                style={{
                  borderColor: hasAccess ? "var(--border)" : "rgba(255,144,121,.3)",
                  background: hasAccess ? "var(--surface)" : "var(--coral-soft)",
                  color: hasAccess ? "var(--muted)" : "var(--coral)",
                }}
                title={hasAccess ? "Sua assinatura está ativa" : "Ative um plano para voltar a editar"}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: hasAccess ? "var(--accent)" : "var(--coral)" }} />
                {planLabel}
              </button>
              <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-bold text-[var(--muted)] xl:flex" style={{ borderColor: "var(--border)", background: "var(--surface)" }} title="Salvo no seu login">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                salvo {savedTime}
              </span>
              <div className="lg:hidden"><ThemeButton /></div>
              <button type="button" onClick={() => setMoreOpen(true)} className="rounded-full transition hover:opacity-80" aria-label="Abrir conta e mais">
                <Avatar name={account?.name ?? data.profile.name} size={33} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12 lg:pt-7">
          {children}
          <footer className="mt-12 hidden items-center justify-between border-t pt-5 text-[10px] text-[var(--faint)] lg:flex" style={{ borderColor: "var(--border)" }}>
            <span className="font-semibold">Ninho — finanças na palma da mão.</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              {account ? `${account.name} · ${formatDate(new Date().toISOString().slice(0, 10))}` : `Ninho · ${now.getFullYear()}`}
            </span>
          </footer>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-5 lg:hidden"
        style={{ background: "linear-gradient(to top, var(--bg) 30%, transparent)" }}
        aria-label="Navegação principal"
      >
        <div className="mobile-nav mx-auto grid max-w-[430px] grid-cols-5 gap-0.5 rounded-[20px] p-1">
          {MOBILE_MAIN.map((item) => {
            const active = page === item.page;
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => go(item.page)}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex flex-col items-center justify-center gap-1 rounded-[14px] px-0 py-2 text-[9px] font-extrabold tracking-[-0.02em] transition", active ? "" : "text-[var(--muted)]")}
                style={active ? { background: "var(--surface-2)", color: "var(--text)" } : undefined}
              >
                <Icon size={18} strokeWidth={active ? 2.25 : 1.9} style={active ? { color: "var(--accent)" } : undefined} />
                <span>{item.label}</span>
                {active ? <span className="absolute -top-[1px] h-[2px] w-5 rounded-full" style={{ background: "var(--accent)" }} /> : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn("relative flex flex-col items-center justify-center gap-1 rounded-[14px] px-0 py-2 text-[9px] font-extrabold tracking-[-0.02em] transition", ["plan", "goals", "card"].includes(page) ? "text-[var(--muted)]" : "text-[var(--muted)]")}
          >
            <MoreHorizontal size={18} />
            <span>Mais</span>
            {pendingInvites.length ? <span className="absolute right-3 top-1 h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} /> : null}
          </button>
        </div>
      </nav>

      <Modal open={promosOpen} onClose={() => setPromosOpen(false)} title="Promoções e cupons" subtitle="Ofertas enviadas pelo administrador para o seu login" icon={<Ticket size={17} />}>
        {myPromotions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center" style={{ borderColor: "var(--border-strong)" }}>
            <Ticket size={22} className="mx-auto text-[var(--muted)]" />
            <p className="mt-2 text-[11px] font-semibold text-[var(--text)]">Nenhuma promoção no momento</p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">Quando o administrador enviar uma oferta, ela aparece aqui e pode ser aplicada no checkout.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myPromotions.map(({ delivery, promotion, expired, redeemed }) => (
              <div key={delivery.id} className="rounded-xl border p-3" style={{ borderColor: redeemed || expired ? "var(--border)" : "var(--accent)", background: redeemed || expired ? "var(--surface-2)" : "var(--success-soft)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[var(--text)]">{promotion.title}</p>
                    <p className="mt-0.5 text-[9px] leading-relaxed text-[var(--text-soft)]">{promotion.message}</p>
                  </div>
                  <Badge tone={redeemed ? "neutral" : expired ? "coral" : "accent"} dot>
                    {redeemed ? "usada" : expired ? "expirada" : `${promotion.discountPercent}% OFF`}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="chip font-mono !text-[9px]">{promotion.code}</span>
                  <span className="text-[8.5px] text-[var(--muted)]">válida até {formatDate(promotion.expiresAtISO.slice(0, 10))}</span>
                  {!redeemed && !expired ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ml-auto"
                      onClick={() => {
                        setPromosOpen(false);
                        go("billing");
                      }}
                    >
                      Usar no checkout
                    </Button>
                  ) : null}
                </div>
                {promotion.planIds.length ? (
                  <p className="mt-1.5 text-[8px] text-[var(--faint)]">
                    Planos elegíveis: {promotion.planIds.map((planId) => PLANS[planId].label).join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 flex items-start gap-1.5 text-[8.5px] leading-relaxed text-[var(--faint)]">
          Cada cupom é pessoal, pode ser usado uma única vez e não é acumulativo.
        </p>
      </Modal>

      {moreOpen ? (
        <div className="fixed inset-0 z-[75] lg:hidden">
          <div className="scrim absolute inset-0" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="modal-card modal-enter absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[26px] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar name={account?.name ?? data.profile.name} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold text-[var(--text)]">{account?.name ?? data.profile.name}</p>
                  <p className="truncate text-[9px] text-[var(--muted)]">{account?.email ?? data.profile.email}</p>
                </div>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Fechar menu" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-2)]"><X size={17} /></button>
            </div>

            {openInvites > 0 ? (
              <div className="mt-3 space-y-1.5">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-[var(--muted)]">Convites pendentes</p>
                {incomingInvites.map(({ household: invitedHouse, invite }) => (
                  <div key={`${invitedHouse.id}-${invite.email}`} className="rounded-xl border p-2.5" style={{ borderColor: "var(--accent)", background: "var(--success-soft)" }}>
                    <p className="text-[10.5px] font-bold text-[var(--text)]">{invitedHouse.name}</p>
                    <p className="mt-0.5 text-[8.5px] text-[var(--muted)]">convite para {invite.email}</p>
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" onClick={() => {
                        const result = acceptInvite(invitedHouse.id);
                        setMoreOpen(false);
                        toast.push(result.ok ? "Você entrou no Ninho compartilhado." : result.message ?? "Falha", result.ok ? "success" : "error");
                      }} className="btn btn-primary btn-sm flex-1">Aceitar</button>
                      <button type="button" onClick={() => {
                        const result = declineInvite(invitedHouse.id);
                        toast.push(result.ok ? "Convite recusado." : result.message ?? "Falha", result.ok ? "success" : "warning");
                      }} className="btn btn-secondary btn-sm">Recusar</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={hasAccess ? "accent" : "coral"} dot>{planLabel}</Badge>
              <Badge>{household?.name ?? "Meu Ninho"}</Badge>
              <Badge>{members} {members === 1 ? "pessoa" : "pessoas"}</Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-1.5">
              {NAV_GROUPS.flatMap((group) => visibleGroupItems(group.items))
                .filter((item) => !MOBILE_MAIN.some((main) => main.page === item.page))
                .map((item) => {
                  const Icon = item.icon;
                  const active = page === item.page;
                  return (
                    <button
                      key={item.page}
                      type="button"
                      onClick={() => go(item.page)}
                      className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:border-[var(--border-strong)]"
                      style={{
                        borderColor: active ? "var(--accent)" : "var(--border)",
                        background: active ? "var(--success-soft)" : "var(--surface-2)",
                      }}
                    >
                      <Icon size={15} style={{ color: active ? "var(--accent)" : "var(--muted)" }} />
                      <span className="flex-1 text-[10.5px] font-bold text-[var(--text)]">{item.label}</span>
                      {item.adminOnly ? <Crown size={10} className="text-[var(--amber)]" /> : null}
                    </button>
                  );
                })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => { setMoreOpen(false); onNavigate("settings"); }} className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[10px] font-bold text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                <Settings2 size={13} /> Ajustes da conta
              </button>
              <button type="button" onClick={() => { setMoreOpen(false); onNavigate("billing"); }} className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[10px] font-bold text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                <Wallet size={13} /> Meu plano
              </button>
            </div>

            <button type="button" onClick={signOut} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[10px] font-bold" style={{ borderColor: "rgba(255,144,121,.25)", background: "var(--coral-soft)", color: "var(--coral)" }}>
              <LogOut size={13} /> Sair da conta
            </button>

            <div className="mt-3 flex items-center justify-between text-[8.5px] text-[var(--faint)]">
              <span>Ninho · finanças na palma da mão</span>
              <span className="flex items-center gap-1"><Check size={9} /> salvo no seu login</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
