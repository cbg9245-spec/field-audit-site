// POST /api/stripe-webhook
// Configure this exact URL in your Stripe Dashboard -> Developers -> Webhooks.
// Listens for checkout.session.completed and records the paying customer's email in KV.
export async function onRequestPost({ request, env }) {
  const sig = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  const valid = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = (session.customer_details?.email || session.customer_email || "").toLowerCase().trim();
    if (email) {
      await env.AUDIT_KV.put(
        `paid:${email}`,
        JSON.stringify({ paidAt: Date.now(), amount: session.amount_total, sessionId: session.id })
      );
    }
  }

  return new Response("ok");
}

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
  const computed = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === v1;
}
