async function callChat(request, env) {
  const { system, prompt, max_tokens } = await request.json();
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: max_tokens || 800,
      system: system || "",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await resp.json();
  const text = (data.content || []).map((b) => b.text || "").join("\n").trim();
  return json({ text });
}

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
  const computed = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === v1;
}

async function stripeWebhook(request, env) {
  const sig = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  const valid = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 400 });
  const event = JSON.parse(rawBody);
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = (session.customer_details?.email || session.customer_email || "").toLowerCase().trim();
    if (email) {
      await env.AUDIT_KV.put(`paid:${email}`, JSON.stringify({ paidAt: Date.now(), amount: session.amount_total, sessionId: session.id }));
    }
  }
  return new Response("ok");
}

async function verifyPayment(request, env) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").toLowerCase().trim();
  if (!email) return json({ paid: false });
  const rec = await env.AUDIT_KV.get(`paid:${email}`);
  return json({ paid: !!rec });
}

async function bookingsGet(env) {
  const raw = await env.AUDIT_KV.get("bookings:list");
  return json(raw ? JSON.parse(raw) : []);
}

async function bookingsPost(request, env) {
  const body = await request.json();
  const raw = await env.AUDIT_KV.get("bookings:list");
  const list = raw ? JSON.parse(raw) : [];
  if (list.some((b) => b.slot === body.slot)) {
    return json({ ok: false, error: "That slot was just taken." }, 409);
  }
  list.push({ ...body, bookedAt: Date.now() });
  await env.AUDIT_KV.put("bookings:list", JSON.stringify(list));
  return json({ ok: true });
}

async function sendEmail(request, env) {
  const { toEmail, subject, message } = await request.json();
  const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: env.EMAILJS_SERVICE_ID,
      template_id: env.EMAILJS_TEMPLATE_ID,
      user_id: env.EMAILJS_PUBLIC_KEY,
      template_params: { to_email: toEmail, subject, message },
    }),
  });
  return json({ ok: resp.ok }, resp.ok ? 200 : 500);
}

async function notifyOwner(request, env) {
  if (!env.OWNER_NOTIFY_EMAIL) return json({ ok: false, error: "OWNER_NOTIFY_EMAIL not set" });
  const { subject, message } = await request.json();
  const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: env.EMAILJS_SERVICE_ID,
      template_id: env.EMAILJS_TEMPLATE_ID,
      user_id: env.EMAILJS_PUBLIC_KEY,
      template_params: { to_email: env.OWNER_NOTIFY_EMAIL, subject, message },
    }),
  });
  return json({ ok: resp.ok });
}

async function adminConfigGet(env) {
  const raw = await env.AUDIT_KV.get("config:public");
  const cfg = raw ? JSON.parse(raw) : { price: "$149", serviceName: "Operations Audit", stripeLink: "" };
  return json(cfg);
}

async function adminConfigPost(request, env) {
  const body = await request.json();
  if (body.passcode !== env.ADMIN_PASSCODE) return json({ ok: false, error: "Wrong passcode" }, 401);
  const cfg = { price: body.price, serviceName: body.serviceName, stripeLink: body.stripeLink };
  await env.AUDIT_KV.put("config:public", JSON.stringify(cfg));
  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      if (path === "/api/chat" && method === "POST") return await callChat(request, env);
      if (path === "/api/stripe-webhook" && method === "POST") return await stripeWebhook(request, env);
      if (path === "/api/verify-payment" && method === "GET") return await verifyPayment(request, env);
      if (path === "/api/bookings" && method === "GET") return await bookingsGet(env);
      if (path === "/api/bookings" && method === "POST") return await bookingsPost(request, env);
      if (path === "/api/send-email" && method === "POST") return await sendEmail(request, env);
      if (path === "/api/notify-owner" && method === "POST") return await notifyOwner(request, env);
      if (path === "/api/admin-config" && method === "GET") return await adminConfigGet(env);
      if (path === "/api/admin-config" && method === "POST") return await adminConfigPost(request, env);

      return env.ASSETS.fetch(request);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};
