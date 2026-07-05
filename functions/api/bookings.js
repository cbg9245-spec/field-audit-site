// GET /api/bookings  -> list of all bookings
// POST /api/bookings -> { slot, businessName, ownerName, email }
export async function onRequestGet({ env }) {
  const raw = await env.AUDIT_KV.get("bookings:list");
  return new Response(raw || "[]", { headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const raw = await env.AUDIT_KV.get("bookings:list");
  const list = raw ? JSON.parse(raw) : [];

  if (list.some((b) => b.slot === body.slot)) {
    return new Response(JSON.stringify({ ok: false, error: "That slot was just taken." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  list.push({ ...body, bookedAt: Date.now() });
  await env.AUDIT_KV.put("bookings:list", JSON.stringify(list));
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}
