/**
 * Abre o Stripe Billing Portal para o cliente gerenciar/cancelar a assinatura.
 * Recebe o ID da Checkout Session já paga; o servidor consulta o Stripe para
 * obter o customer e nunca aceita um customerId vindo do navegador.
 */
function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(payload),
  };
}

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
  return process.env.URL?.replace(/\/$/, "") || origin || "http://localhost:8888";
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Método não permitido." });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) return json(503, { error: "Pagamentos reais não configurados." });

  const origin = (event.headers.origin || event.headers.Origin || "").replace(/\/$/, "");
  const allowed = allowedOrigins();
  if (allowed.size && origin && !allowed.has(origin)) return json(403, { error: "Origem não autorizada." });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Corpo inválido." });
  }
  const sessionId = String(payload.sessionId || "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return json(400, { error: "Sessão inválida." });

  try {
    const sessionResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    const session = await sessionResponse.json();
    if (!sessionResponse.ok || session.payment_status !== "paid") {
      return json(404, { error: "Pagamento não encontrado." });
    }
    const customer = typeof session.customer === "object" ? session.customer?.id : session.customer;
    if (!customer) return json(400, { error: "Assinatura sem cliente no Stripe." });

    const params = new URLSearchParams();
    params.set("customer", customer);
    params.set("return_url", `${publicBase(event)}/#billing`);
    const portalResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const portal = await portalResponse.json();
    if (!portalResponse.ok || !portal.url) {
      return json(502, {
        error: "Não foi possível abrir o portal de assinatura.",
        detail: portal?.error?.message || "Verifique a configuração do Billing Portal no Stripe.",
      });
    }
    return json(200, { url: portal.url });
  } catch {
    return json(502, { error: "Falha ao falar com o Stripe." });
  }
}
