// GET  /api/admin-config -> current public display settings
// POST /api/admin-config -> { passcode, price, serviceName, stripeLink } to update them
export async function onRequestGet({ env }) {
  const raw = await env.AUDIT_KV.get("config:public");
  const cfg = raw ? JSON.parse(raw) : { price: "$149", serviceName: "Operations Audit", stripeLink: "" };
  return new Response(JSON.stringify(cfg), { headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  if (body.passcode !== env.ADMIN_PASSCODE) {
    return new Response(JSON.stringify({ ok: false, error: "Wrong passcode" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const cfg = { price: body.price, serviceName: body.serviceName, stripeLink: body.stripeLink };
  await env.AUDIT_KV.put("config:public", JSON.stringify(cfg));
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}
