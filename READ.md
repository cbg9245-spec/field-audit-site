# Field Audit — deployment notes

Files:
- `index.html` — the whole site (customer-facing frontend)
- `functions/api/*.js` — the backend (Cloudflare Pages Functions), each file is one API route

## Environment variables to set in Cloudflare (Settings → Environment variables → Production)
| Name | Where you get it |
|---|---|
| ANTHROPIC_API_KEY | console.anthropic.com → API Keys |
| STRIPE_SECRET_KEY | dashboard.stripe.com → Developers → API keys (not used directly by these functions today, but keep on hand) |
| STRIPE_WEBHOOK_SECRET | dashboard.stripe.com → Developers → Webhooks → your endpoint → Signing secret |
| EMAILJS_SERVICE_ID | emailjs.com → Email Services |
| EMAILJS_TEMPLATE_ID | emailjs.com → Email Templates |
| EMAILJS_PUBLIC_KEY | emailjs.com → Account → General |
| OWNER_NOTIFY_EMAIL | your own email, where booking/completion alerts go |
| ADMIN_PASSCODE | any password you choose, used to edit site settings |

## KV namespace
Create one KV namespace (any name, e.g. `AUDIT_KV`) and bind it to the Pages project as **AUDIT_KV** under Settings → Functions → KV namespace bindings.

## Stripe webhook
Point it at: `https://YOUR-SITE.pages.dev/api/stripe-webhook`
Event to send: `checkout.session.completed`
