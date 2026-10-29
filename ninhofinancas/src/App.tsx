import React from "react";
import { ArrowLeftRight, CalendarRange, Check, CreditCard, Loader2, ShieldCheck, Users, XCircle } from "lucide-react";
import Layout, { PAGE_META, type Page } from "./components/Layout";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./pages/Dashboard";
import Plan from "./pages/Plan";
import Goals from "./pages/Goals";
import Transactions from "./pages/Transactions";
import CardCredit from "./pages/CardCredit";
import Sales from "./pages/Sales";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import Billing from "./pages/Billing";
import Admin from "./pages/Admin";
import { Button, Logo, Modal } from "./components/ui";
import { useToast } from "./components/Toast";
import { StoreProvider, useStore } from "./state/store";
import { useAuth } from "./state/auth";
import { inviteSummary, readInviteFromLocation, clearInviteFromLocation } from "./lib/sharing";
import { formatDate } from "./lib/date";
import { cleanCheckoutQuery, verifyStripeSession } from "./lib/payments";
import type { AppData } from "./state/types";

const VALID_PAGES: Page[] = ["overview", "plan", "goals", "sales", "transactions", "card", "billing", "settings", "clients", "admin"];

function pageFromHash(): Page {
  const hash = window.location.hash.replace("#", "").trim();
  return (VALID_PAGES as string[]).includes(hash) ? (hash as Page) : "overview";
}

export default function App() {
  const { ready, account } = useAuth();

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center px-6" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <Logo />
          <Loader2 size={20} className="mx-auto mt-6 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="mt-3 text-[11px] text-[var(--muted)]">Abrindo seu Ninho…</p>
        </div>
      </div>
    );
  }

  if (!account) return <AuthScreen />;

  return (
    <StoreProvider key={account.householdId}>
      <AuthenticatedApp />
    </StoreProvider>
  );
}

function AuthenticatedApp() {
  const [page, setPage] = React.useState<Page>(pageFromHash);
  const [invite, setInvite] = React.useState<AppData | null>(() => readInviteFromLocation());
  const { data, dispatch } = useStore();
  const { hasAccess, isAdmin, incomingInvites, acceptInvite, declineInvite, db, account, activateExternalSubscription } = useAuth();
  const toast = useToast();
  const checkoutHandled = React.useRef(false);
  const [checkoutState, setCheckoutState] = React.useState<{
    status: "idle" | "checking" | "success" | "error";
    message?: string;
    planId?: string;
  }>({ status: "idle" });
  const [dismissedInvites, setDismissedInvites] = React.useState<string[]>([]);
  const inviteInbox = incomingInvites.filter((entry) => !dismissedInvites.includes(entry.household.id));

  React.useEffect(() => {
    if (checkoutHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    const sessionId = params.get("session_id");
    checkoutHandled.current = true;
    if (!sessionId) {
      setCheckoutState({ status: "error", message: "Sessão de pagamento ausente. Abra a assinatura para tentar novamente." });
      cleanCheckoutQuery();
      return;
    }
    setCheckoutState({ status: "checking" });
    verifyStripeSession(sessionId)
      .then((result) => {
        if (!result.ok || !result.planId) {
          setCheckoutState({
            status: "error",
            message: result.message ?? result.error ?? "O pagamento ainda não foi confirmado pelo Stripe.",
          });
          return;
        }
        const activation = activateExternalSubscription({
          planId: result.planId,
          amountCents: result.amountCents ?? 0,
          reference: result.reference ?? sessionId,
          paidAtISO: result.paidAtISO,
          provider: result.provider ?? "Stripe",
          customerId: result.customerId,
          subscriptionId: result.subscriptionId,
        });
        if (!activation.ok) {
          setCheckoutState({ status: "error", message: activation.message ?? "Não foi possível ativar o plano." });
          return;
        }
        setCheckoutState({ status: "success", planId: result.planId });
        toast.push("Pagamento confirmado e plano ativado.");
        setPage("billing");
        window.location.hash = "billing";
      })
      .catch(() => {
        setCheckoutState({ status: "error", message: "Falha ao confirmar o pagamento. Tente novamente em instantes." });
      })
      .finally(() => {
        cleanCheckoutQuery();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const handleHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", handleHash);
    if (!window.location.hash) window.history.replaceState(null, "", "#overview");
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const effectivePage: Page =
    (page === "admin" || page === "clients") && !isAdmin
      ? "overview"
      : !hasAccess && page !== "billing" && page !== "settings"
        ? "billing"
        : page;

  React.useEffect(() => {
    document.title = `${PAGE_META[effectivePage].label} — Ninho`;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [effectivePage]);

  function navigate(next: Page) {
    const guarded: Page = !hasAccess && next !== "billing" && next !== "settings" ? "billing" : next;
    setPage(guarded);
    if (window.location.hash !== `#${guarded}`) window.location.hash = guarded;
  }

  function closeInvite() {
    setInvite(null);
    clearInviteFromLocation();
  }

  return (
    <>
      <Layout page={effectivePage} onNavigate={navigate}>
        {effectivePage === "overview" ? <Dashboard onNavigate={navigate} /> : null}
        {effectivePage === "plan" ? <Plan onNavigate={navigate} /> : null}
        {effectivePage === "goals" ? <Goals /> : null}
        {effectivePage === "sales" ? <Sales /> : null}
        {effectivePage === "transactions" ? <Transactions /> : null}
        {effectivePage === "card" ? <CardCredit onNavigate={navigate} /> : null}
        {effectivePage === "billing" ? <Billing onNavigate={navigate} paywall={!hasAccess} /> : null}
        {effectivePage === "settings" ? <Settings onNavigate={navigate} /> : null}
        {effectivePage === "clients" && isAdmin ? <Clients /> : null}
        {effectivePage === "admin" && isAdmin ? <Admin /> : null}
      </Layout>

      <Modal
        open={checkoutState.status === "checking"}
        onClose={() => undefined}
        title="Confirmando pagamento"
        subtitle="Aguarde enquanto validamos a sessão com o Stripe."
        icon={<CreditCard size={17} />}
        size="sm"
        footer={null}
      >
        <div className="flex items-center gap-3 py-4">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            Não feche esta aba. A confirmação é feita diretamente no servidor de pagamentos.
          </p>
        </div>
      </Modal>

      <Modal
        open={checkoutState.status === "success"}
        onClose={() => setCheckoutState({ status: "idle" })}
        title="Pagamento confirmado"
        subtitle="Seu plano foi ativado neste login."
        icon={<Check size={17} />}
        size="sm"
        footer={
          <Button onClick={() => { setCheckoutState({ status: "idle" }); navigate("billing"); }}>
            Ver minha assinatura
          </Button>
        }
      >
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed text-[var(--text-soft)]">
            O Stripe confirmou o pagamento e o Ninho liberou os recursos do plano {String(checkoutState.planId ?? "")}.
          </p>
          <p className="flex items-start gap-2 text-[9px] leading-relaxed text-[var(--faint)]">
            <ShieldCheck size={11} className="mt-0.5 shrink-0" /> O comprovante é enviado pelo Stripe ao e-mail usado no checkout.
          </p>
        </div>
      </Modal>

      <Modal
        open={checkoutState.status === "error"}
        onClose={() => setCheckoutState({ status: "idle" })}
        title="Pagamento não confirmado"
        subtitle="Nenhuma cobrança foi ativada no Ninho."
        icon={<XCircle size={17} />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCheckoutState({ status: "idle" })}>Fechar</Button>
            <Button onClick={() => { setCheckoutState({ status: "idle" }); navigate("billing"); }}>
              Ir para a assinatura
            </Button>
          </>
        }
      >
        <p className="text-[11px] leading-relaxed text-[var(--text-soft)]">
          {checkoutState.message ?? "O pagamento não foi concluído. Você pode tentar novamente."}
        </p>
        <p className="mt-2 text-[9px] leading-relaxed text-[var(--faint)]">
          Se o valor já apareceu no seu cartão, fale com o suporte informando o e-mail usado no checkout.
        </p>
      </Modal>

      <Modal
        open={inviteInbox.length > 0}
        onClose={() => setDismissedInvites((current) => [...current, ...incomingInvites.map((entry) => entry.household.id)])}
        title="Convite para um Ninho compartilhado"
        subtitle={inviteInbox[0] ? `${inviteInbox[0].household.name} quer dividir as finanças com você.` : ""}
        icon={<Users size={17} />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              const entry = inviteInbox[0];
              if (!entry) return;
              const result = declineInvite(entry.household.id);
              setDismissedInvites((current) => [...current, entry.household.id]);
              toast.push(result.ok ? "Convite recusado." : result.message ?? "Falha", result.ok ? "success" : "warning");
            }}>Recusar</Button>
            <Button onClick={() => {
              const entry = inviteInbox[0];
              if (!entry) return;
              const result = acceptInvite(entry.household.id);
              setDismissedInvites((current) => [...current, entry.household.id]);
              toast.push(result.ok ? "Você entrou no Ninho compartilhado." : result.message ?? "Falha", result.ok ? "success" : "error");
            }}>Aceitar convite</Button>
          </>
        }
      >
        {inviteInbox[0] ? (
          <div className="space-y-3">
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.07em] text-[var(--muted)]">Casa</p>
              <p className="mt-1 text-[13px] font-bold text-[var(--text)]">{inviteInbox[0].household.name}</p>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                Titular: {db.accounts.find((item) => item.id === inviteInbox[0].household.ownerId)?.name ?? "—"} ·{" "}
                {inviteInbox[0].household.memberIds.length} pessoa(s)
              </p>
            </div>
            <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
              Ao aceitar, você passa a ver e editar os mesmos lançamentos, plano, metas e contas do crédito da casa, usando o seu login. Seu Ninho atual continua guardado como arquivo no banco, sem ser apagado.
            </p>
            <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-[var(--faint)]">
              <ShieldCheck size={10} className="mt-0.5 shrink-0" /> Convite destinado a {account?.email}.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!invite}
        onClose={closeInvite}
        title="Cópia de dados do Ninho"
        subtitle="Um backup compartilhado foi aberto neste navegador."
        icon={<Users size={17} />}
        footer={
          <>
            <Button variant="ghost" onClick={closeInvite}>Agora não</Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!invite) return;
                dispatch({ type: "IMPORT_MERGE_KEEP_EXISTING", backup: invite });
                toast.push("Dados do backup mesclados com os seus.");
                closeInvite();
              }}
            >
              Mesclar
            </Button>
            <Button
              onClick={() => {
                if (!invite) return;
                dispatch({ type: "IMPORT_REPLACE", backup: invite });
                toast.push("Dados restaurados neste Ninho.");
                closeInvite();
              }}
            >
              <Check size={14} /> Usar estes dados
            </Button>
          </>
        }
      >
        {invite ? <InviteDetails invite={invite} current={data} /> : null}
      </Modal>
    </>
  );
}

function InviteDetails({ invite, current }: { invite: AppData; current: AppData }) {
  const summary = inviteSummary(invite);
  return (
    <div>
      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <p className="overline">Backup de</p>
        <p className="font-display mt-1 text-[18px] font-semibold text-[var(--text)]">{summary.name}</p>
        <p className="mt-1 text-[10.5px] text-[var(--muted)]">Atualizado em {formatDate(summary.updatedAtISO.slice(0, 10), "long")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div><p className="num text-[15px] font-semibold text-[var(--text)]">{summary.transactions}</p><p className="text-[8.5px] uppercase tracking-[0.06em] text-[var(--faint)]">lançamentos</p></div>
          <div><p className="num text-[15px] font-semibold text-[var(--text)]">{summary.purchases}</p><p className="text-[8.5px] uppercase tracking-[0.06em] text-[var(--faint)]">compras</p></div>
          <div><p className="num text-[15px] font-semibold text-[var(--text)]">{summary.plannedItems}</p><p className="text-[8.5px] uppercase tracking-[0.06em] text-[var(--faint)]">itens no plano</p></div>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
        <ArrowLeftRight size={14} className="mt-0.5 shrink-0 text-[var(--muted)]" />
        <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
          Mesclar mantém seus {current.transactions.length} lançamentos e adiciona os que ainda não existem. Usar estes dados substitui tudo pela versão do backup.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="chip"><CalendarRange size={10} /> planejamento</span>
        <span className="chip"><CreditCard size={10} /> crédito</span>
        <span className="chip"><ShieldCheck size={10} /> salvo no login</span>
      </div>
    </div>
  );
}
