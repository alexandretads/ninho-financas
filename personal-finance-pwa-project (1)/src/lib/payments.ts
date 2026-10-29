import type { PlanId } from "../state/auth";

export type PaymentsConfig = {
  configured: boolean;
  mode: "stripe" | "demo";
  currency: string;
  plans?: Partial<Record<PlanId, number>>;
};

export type StripeStartResult = {
  ok: boolean;
  url?: string;
  sessionId?: string;
  planId?: PlanId;
  amountCents?: number;
  error?: string;
  code?: string;
};

export type StripeVerifyResult = {
  ok: boolean;
  planId?: PlanId;
  amountCents?: number;
  reference?: string;
  paidAtISO?: string;
  customerEmail?: string | null;
  provider?: string;
  subscriptionId?: string | null;
  customerId?: string | null;
  message?: string;
  error?: string;
};

const CONFIG_TIMEOUT_MS = 6000;

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Lê a configuração do servidor. Sem função/Netlify, cai no modo demonstração. */
export async function loadPaymentsConfig(): Promise<PaymentsConfig> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
  try {
    const response = await fetch("/.netlify/functions/payments", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { configured: false, mode: "demo", currency: "brl" };
    const data = await safeJson<PaymentsConfig>(response);
    if (!data) return { configured: false, mode: "demo", currency: "brl" };
    return { ...data, mode: data.configured ? "stripe" : "demo" };
  } catch {
    return { configured: false, mode: "demo", currency: "brl" };
  } finally {
    clearTimeout(timer);
  }
}

export async function startStripeCheckout(args: {
  planId: PlanId;
  email?: string;
}): Promise<StripeStartResult> {
  try {
    const response = await fetch("/.netlify/functions/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ planId: args.planId, email: args.email }),
    });
    const data = await safeJson<StripeStartResult & { error?: string; code?: string }>(response);
    if (!response.ok || !data?.url) {
      return {
        ok: false,
        error: data?.error ?? "Não foi possível iniciar o pagamento.",
        code: data?.code,
      };
    }
    return { ...data, ok: true };
  } catch {
    return { ok: false, error: "Falha de conexão com o checkout." };
  }
}

export async function verifyStripeSession(sessionId: string): Promise<StripeVerifyResult> {
  try {
    const response = await fetch(
      `/.netlify/functions/verify-payment?session_id=${encodeURIComponent(sessionId)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    const data = await safeJson<StripeVerifyResult>(response);
    if (!response.ok || !data) {
      return { ok: false, error: data?.error ?? "Não foi possível verificar o pagamento." };
    }
    return data;
  } catch {
    return { ok: false, error: "Falha ao confirmar o pagamento com o servidor." };
  }
}

export async function openStripeBillingPortal(args: {
  sessionId: string;
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch("/.netlify/functions/billing-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sessionId: args.sessionId }),
    });
    const data = await safeJson<{ url?: string; error?: string }>(response);
    if (!response.ok || !data?.url) {
      return { ok: false, error: data?.error ?? "Não foi possível abrir o portal do Stripe." };
    }
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: "Falha de conexão com o portal de assinatura." };
  }
}

export function cleanCheckoutQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete("checkout");
  url.searchParams.delete("session_id");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash || "#billing"}`);
}
