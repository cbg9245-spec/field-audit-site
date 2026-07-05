// GET /api/verify-payment?email=someone@example.com
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").toLowerCase().trim();
  if (!email) {
    return new Response(JSON.stringify({ paid: false }), { headers: { "Content-Type": "application/json" } });
  }
  const rec = await env.AUDIT_KV.get(`paid:${email}`);
  return new Response(JSON.stringify({ paid: !!rec }), { headers: { "Content-Type": "application/json" } });
}
