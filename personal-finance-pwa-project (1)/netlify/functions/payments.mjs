/**
 * Ninho · pagamentos
 * GET  -> informa se o Stripe está configurado e os planos do servidor.
 * POST -> cria uma Stripe Checkout Session de assinatura e devolve a URL.
 *
 * Variáveis de ambiente (Netlify):
 *   STRIPE_SECRET_KEY  chave secreta (sk_live_... ou sk_test_...)
 *   URL                URL pública do site (fornecida pela Netlify)
 *   VITE_PAYMENTS_MODE opcional: "stripe" para forçar modo real
 *
 * Nenhum preço vem do cliente: o servidor escolhe o valor do plano.
 */

const PLANS = {
  monthly_solo: { amount: 3490, interval: "month", name: "Ninho · Mensal individual", seats: 1 },
  monthly_shared: { amount: 4990, interval: "month", name: "Ninho · Mensal compartilhado", seats: 2 },
  annual_solo: { amount: 30000, interval: "year", name: "Ninho · Anual individual", seats: 1 },
  annual_shared: { amount: 50000, interval: "year", name: "Ninho · Anual compartilhado", seats: 2 },
};

function allowedOrigins() {
  const values = new Set();
  ["URL", "DEPLOY_PRIME_URL", "DEPLOY_URL"].forEach((key) => {
    if (process.env[key]) values.add(process.env[key].replace(/\/$/, ""));
  });
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(",").forEach((value) => {
      if (value.trim()) values.add(value.trim().replace(/\/$/, ""));
    });
  }
  return values;
}

function publicBase(event) {
  const origin = (event.headers.origin || event.headers.Origin || "").replace(/\/$/, "");
  const allowed = allowedOrigins();
  if (origin && (!allowed.size || allowed.has(origin))) return origin;
  return process.env.URL?.replace(/\/$/, "") || process.env.DEPLOY_PRIME_URL?.replace(/\/$/, "") || origin || "http://localhost:8888";
}

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

export async function handler(event) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const configured = Boolean(stripeKey && stripeKey.startsWith("sk_"));

  if (event.httpMethod === "GET") {
    return json(200, {
      configured,
      mode: configured ? "stripe" : "demo",
      currency: "brl",
      plans: Object.fromEntries(Object.entries(PLANS).map(([id, plan]) => [id, plan.amount])),
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método não permitido." }, { Allow: "GET, POST" });
  }

  if (!configured) {
    return json(503, {
      error: "Pagamentos reais não configurados neste deploy.",
      code: "PAYMENTS_NOT_CONFIGURED",
      hint: "Defina STRIPE_SECRET_KEY nas variáveis de ambiente do Netlify.",
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Corpo inválido." });
  }

  const origin = (event.headers.origin || event.headers.Origin || "").replace(/\/$/, "");
  const allowed = allowedOrigins();
  if (allowed.size && origin && !allowed.has(origin)) {
    return json(403, { error: "Origem não autorizada." });
  }

  const planId = String(payload.planId || "");
  const plan = PLANS[planId];
  if (!plan) return json(400, { error: "Plano inválido." });

  const email = typeof payload.email === "string" ? payload.email.trim().slice(0, 200) : "";
  const base = publicBase(event);
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("locale", "pt-BR");
  params.set("allow_promotion_codes", "true");
  params.set("billing_address_collection", "auto");
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "brl");
  params.set("line_items[0][price_data][unit_amount]", String(plan.amount));
  params.set("line_items[0][price_data][recurring][interval]", plan.interval);
  params.set("line_items[0][price_data][product_data][name]", plan.name);
  params.set("metadata[planId]", planId);
  params.set("metadata[source]", "ninho-web");
  params.set("subscription_data[metadata][planId]", planId);
  params.set("success_url", `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#billing`);
  params.set("cancel_url", `${base}/#billing`);
  if (email) params.set("customer_email", email);

  const body = params
    .toString()
    .replace(/%7BCHECKOUT_SESSION_ID%7D/gi, "{CHECKOUT_SESSION_ID}");

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `ninho-${planId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      body,
    });
    const session = await response.json();
    if (!response.ok) {
      return json(502, {
        error: "O Stripe recusou a criação do checkout.",
        detail: session?.error?.message || "Erro desconhecido.",
      });
    }
    return json(200, {
      url: session.url,
      sessionId: session.id,
      planId,
      amountCents: plan.amount,
    });
  } catch {
    return json(502, { error: "Não foi possível falar com o Stripe." });
  }
}
