/**
 * Verifica no Stripe se a Checkout Session foi realmente paga.
 * Chamado pelo app no retorno do checkout; nunca confia em parâmetros do cliente.
 */
function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(payload),
  };
}

export async function handler(event) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) {
    return json(503, { error: "Pagamentos reais não configurados.", code: "PAYMENTS_NOT_CONFIGURED" });
  }
  const sessionId = String(event.queryStringParameters?.session_id || "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return json(400, { error: "Sessão de checkout inválida." });
  }

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    const session = await response.json();
    if (!response.ok) return json(404, { error: "Sessão de checkout não encontrada." });

    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const planId = session.metadata?.planId;
    if (!paid || !planId) {
      return json(200, { ok: false, status: session.status, paymentStatus: session.payment_status, message: "Pagamento ainda não confirmado." });
    }

    return json(200, {
      ok: true,
      status: session.status,
      paymentStatus: session.payment_status,
      planId,
      amountCents: Number(session.amount_total) || 0,
      currency: session.currency,
      reference: session.id,
      customerEmail: session.customer_details?.email ?? null,
      subscriptionId: typeof session.subscription === "object" ? session.subscription?.id ?? null : session.subscription ?? null,
      customerId: typeof session.customer === "object" ? session.customer?.id ?? null : session.customer ?? null,
      paidAtISO: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      provider: "Stripe",
    });
  } catch {
    return json(502, { error: "Não foi possível verificar o pagamento no Stripe." });
  }
}
