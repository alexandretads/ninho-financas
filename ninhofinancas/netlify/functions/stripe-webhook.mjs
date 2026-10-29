import crypto from "node:crypto";

/**
 * Webhook do Stripe (opcional nesta versão sem banco remoto).
 * Valida a assinatura e confirma os eventos de assinatura. Para ativar o plano
 * de forma definitiva no servidor, conecte aqui o banco de contas (Supabase/Postgres).
 */
function verifySignature(rawBody, header, secret) {
  const parts = Object.fromEntries(
    String(header || "")
      .split(",")
      .map((part) => part.split("="))
      .filter((pair) => pair.length === 2)
  );
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const provided = Buffer.from(parts.v1);
  const computed = Buffer.from(expected);
  return provided.length === computed.length && crypto.timingSafeEqual(provided, computed);
}

export async function handler(event) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { statusCode: 503, body: "Webhook não configurado." };
  const signature = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  if (!verifySignature(event.body || "", signature, secret)) {
    return { statusCode: 400, body: "Assinatura inválida." };
  }
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Payload inválido." };
  }
  const type = payload.type;
  // Auditoria mínima. A liberação do plano é feita no cliente após verificação
  // server-side da sessão; para produção, gravar aqui em um banco remoto.
  console.log("[stripe]", type, payload.data?.object?.id ?? "", payload.data?.object?.metadata ?? {});
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
}
