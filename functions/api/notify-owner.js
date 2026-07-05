// POST /api/notify-owner
// Body: { subject, message }
export async function onRequestPost({ request, env }) {
  if (!env.OWNER_NOTIFY_EMAIL) {
    return new Response(JSON.stringify({ ok: false, error: "OWNER_NOTIFY_EMAIL not set" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
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
    return new Response(JSON.stringify({ ok: resp.ok }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
