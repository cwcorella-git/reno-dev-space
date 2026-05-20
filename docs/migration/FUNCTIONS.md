# Cloud Functions Migration: Firebase Functions → Cloudflare Workers

Replaces the 7 Cloud Functions with a single Worker that hosts all server-side logic — auth, REST API, Stripe webhook, email sending, and the realtime broadcast endpoints from `REALTIME.md`.

---

## Current Cloud Functions inventory (from `INVENTORY.md`)

| Function | Trigger | New home |
|---|---|---|
| `createCheckoutSession` | HTTPS POST | Worker route `POST /api/donations/checkout` |
| `stripeWebhook` | HTTPS POST | Worker route `POST /api/webhooks/stripe` |
| `sendVerificationEmail` | Auth `onCreate` trigger | better-auth `emailVerification.sendVerificationEmail` hook (see `AUTH.md`) |
| `sendCampaignSuccessEmails` | HTTPS onCall (admin) | Worker route `POST /api/admin/email/campaign-success` |
| `sendCampaignEndedEmails` | HTTPS onCall (admin) | Worker route `POST /api/admin/email/campaign-ended` |
| `sendCampaignUpdate` | HTTPS onCall (admin) | Worker route `POST /api/admin/email/campaign-update` |
| `sendTestEmail` | HTTPS onCall (admin) | Worker route `POST /api/admin/email/test` |

**Net change: 7 functions → 1 Worker with route handlers.** Cheaper, faster cold starts, single deploy unit.

---

## Worker project layout

```
workers/
├── wrangler.jsonc                  # Bindings: D1, R2, DOs, env vars, secrets
├── src/
│   ├── index.ts                    # Router entrypoint
│   ├── auth.ts                     # better-auth setup (per AUTH.md)
│   ├── db.ts                       # Drizzle D1 client
│   ├── email.ts                    # Resend client + template loader (per EMAIL.md)
│   ├── do/
│   │   ├── CanvasDO.ts             # Subscription DOs (per REALTIME.md)
│   │   ├── ChatDO.ts
│   │   ├── PresenceDO.ts           # Special: in-memory only, no D1
│   │   └── ... (12 more)
│   ├── routes/
│   │   ├── canvas.ts               # POST/PUT/DELETE for canvas blocks
│   │   ├── properties.ts           # CRUD + upload-URL mint
│   │   ├── chat.ts                 # POST chat messages
│   │   ├── donations.ts            # Stripe checkout + webhook
│   │   ├── admin.ts                # Admin-only routes (email sending, user delete)
│   │   ├── presence.ts             # WS upgrade for presence
│   │   └── subscriptions.ts        # WS upgrade for all data subscriptions
│   └── middleware/
│       ├── auth.ts                 # requireSession / requireAdmin
│       └── rateLimit.ts            # Per-IP rate limiting (if needed)
└── migrations/                     # better-auth generated + hand-written D1 schema
    ├── 0001_initial.sql            # SCHEMA.md tables
    └── 0002_auth.sql               # AUTH.md tables
```

Single deploy: `npx wrangler deploy`. One Worker, one Routes config, one set of bindings.

---

## Router (`src/index.ts` shape)

Use **Hono** as the router. Lightweight, Worker-first, Express-shaped API, plays well with better-auth.

```ts
import { Hono } from 'hono';
import { auth } from './auth';
import canvasRoutes from './routes/canvas';
// ...

const app = new Hono<{ Bindings: Env }>();

// Auth — mount better-auth's handler at /api/auth/*
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// REST API
app.route('/api/canvas', canvasRoutes);
app.route('/api/properties', propertyRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/donations', donationRoutes);
app.route('/api/admin', adminRoutes);  // requireAdmin middleware

// Stripe webhook (raw body needed for signature verification)
app.post('/api/webhooks/stripe', stripeWebhookHandler);

// WebSocket subscriptions (per REALTIME.md)
app.get('/api/subscribe/:collection/*?', subscriptionWsHandler);

export default app;

// Export DO classes per Cloudflare convention
export { CanvasDO, ChatDO, PresenceDO, /* ... */ } from './do';
```

---

## `wrangler.jsonc` skeleton

```jsonc
{
  "name": "reno-dev-space-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-19",
  "compatibility_flags": ["nodejs_compat"],
  "routes": [
    { "pattern": "renodevspace.org/api/*", "zone_name": "renodevspace.org" }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "reno-dev-space",
      "database_id": "<created via wrangler d1 create>"
    }
  ],
  "r2_buckets": [
    { "binding": "ASSETS", "bucket_name": "renodevspace-assets" }
  ],
  "durable_objects": {
    "bindings": [
      { "name": "CANVAS_DO", "class_name": "CanvasDO" },
      { "name": "CHAT_DO", "class_name": "ChatDO" },
      { "name": "PRESENCE_DO", "class_name": "PresenceDO" },
      { "name": "PROPERTY_DO", "class_name": "PropertyDO" },
      { "name": "SETTINGS_DO", "class_name": "SettingsDO" },
      { "name": "PLEDGE_DO", "class_name": "PledgeDO" },
      { "name": "CONTENT_DO", "class_name": "ContentDO" },
      { "name": "USER_DO", "class_name": "UserDO" },
      { "name": "ADMIN_DO", "class_name": "AdminDO" },
      { "name": "BANS_DO", "class_name": "BansDO" },
      { "name": "EMAIL_TEMPLATE_DO", "class_name": "EmailTemplateDO" },
      { "name": "EMAIL_HISTORY_DO", "class_name": "EmailHistoryDO" },
      { "name": "DELETION_DO", "class_name": "DeletionDO" },
      { "name": "EDIT_HISTORY_DO", "class_name": "EditHistoryDO" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_classes": ["CanvasDO", "ChatDO", "PresenceDO", "PropertyDO",
      "SettingsDO", "PledgeDO", "ContentDO", "UserDO", "AdminDO", "BansDO",
      "EmailTemplateDO", "EmailHistoryDO", "DeletionDO", "EditHistoryDO"] }
  ],
  "vars": {
    "PUBLIC_SITE_URL": "https://renodevspace.org"
  }
}
```

Secrets (NOT in `wrangler.jsonc`; set via `wrangler secret put`):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `BETTER_AUTH_SECRET` (session signing)

---

## Stripe webhook port

The Cloud Function uses Express-shape `req.headers['stripe-signature']`. Worker equivalent:

```ts
async function stripeWebhookHandler(c: Context<{ Bindings: Env }>) {
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.text('Missing signature', 400);

  const body = await c.req.text();  // raw body for signature verification
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return c.text('Bad signature', 400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    await c.env.DB.prepare(
      `INSERT INTO donations (id, user_id, amount, stripe_session_id, stripe_payment_intent, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      session.metadata?.userId ?? null,
      session.amount_total ?? 0,
      session.id,
      session.payment_intent as string,
      'complete',
      Date.now(),
      Date.now()
    ).run();

    // If marked as pledge update, bump pledge amount
    if (session.metadata?.updatePledge === 'true' && session.metadata.userId) {
      // ... pledge update SQL
    }
  }

  return c.text('ok');
}
```

**Stripe webhook URL change** is the user-facing migration step: update the endpoint in the Stripe Dashboard from the old Cloud Function URL to `https://renodevspace.org/api/webhooks/stripe`. The webhook *secret* should also be rotated during cutover so old signatures from the Cloud Function URL are invalid.

---

## Admin email senders

Three of the four admin email functions are near-identical: pull pledger list, render template with template-specific data, send to all, log to `emailHistory`. Generalize:

```ts
async function adminEmailHandler(
  c: Context<{ Bindings: Env }>,
  config: {
    templateId: string;
    audience: 'pledgers' | 'verified' | 'all';
    buildVariables: (settings: CampaignSettings) => Record<string, string>;
  }
) {
  await requireAdmin(c);

  const recipients = await loadRecipients(c.env.DB, config.audience);
  const settings = await loadCampaignSettings(c.env.DB);
  const variables = config.buildVariables(settings);
  const result = await sendBulkEmail(c.env, config.templateId, recipients, variables);

  await c.env.DB.prepare(
    `INSERT INTO email_history (id, template_id, recipients, subject, sent_by, sent_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(/*...*/).run();

  return c.json(result);
}
```

Each of the 3 routes (`campaign-success`, `campaign-ended`, `campaign-update`) becomes a 5-line wrapper around `adminEmailHandler` with its own template + variable builder. `sendTestEmail` is a thin admin-only `POST` that takes a single recipient.

Email rendering and Resend transport are in `EMAIL.md`.

---

## Auth middleware

```ts
// middleware/auth.ts
export async function requireSession(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new HTTPException(401);
  c.set('session', session);
}

export async function requireAdmin(c: Context) {
  await requireSession(c);
  const { user } = c.get('session');
  if (user.email === SUPER_ADMIN_EMAIL) return;
  const isAdmin = await c.env.DB.prepare(
    'SELECT 1 FROM admins WHERE email = ?'
  ).bind(user.email).first();
  if (!isAdmin) throw new HTTPException(403);
}
```

Applied per route group:
```ts
adminRoutes.use('*', requireAdmin);
```

**Auth on WebSocket upgrades:** Hono can parse cookies before the upgrade; the WS handler in `routes/subscriptions.ts` reads the session, attaches the user to the connection, then forwards to the DO. DOs receive the user identity in the initial WS message, not by re-checking the cookie themselves.

---

## CSRF

Mostly handled by:
- Same-site cookies (SameSite=Lax) block cross-origin POSTs from carrying the session.
- better-auth's auth routes have built-in CSRF tokens.
- Stripe webhook validates by signature, not session — no CSRF concern.
- Mutating API routes (`POST /api/canvas`, etc.) require a session header check; an attacker page can issue a `fetch()` that omits cookies (won't match), but a misconfigured CORS allowing credentials from anywhere would be the actual risk.

**CORS policy: deny by default.** Only same-origin requests (`renodevspace.org`) are accepted on mutating routes. No `Access-Control-Allow-Credentials: true` from foreign origins. The Worker should set strict CORS headers explicitly:

```ts
app.use('*', cors({
  origin: 'https://renodevspace.org',
  credentials: true,
}));
```

---

## Rate limiting

Cloudflare's Rate Limiting Rules (free) cover the basics on edge before the Worker even runs:

| Path | Limit |
|---|---|
| `/api/auth/sign-in/*` | 5 requests / 10 min / IP |
| `/api/auth/sign-up` | 3 requests / hour / IP |
| `/api/donations/checkout` | 10 / hour / IP |
| `/api/admin/email/*` | 30 / day / IP (defensive even though admin-only) |

Configured in the Cloudflare dashboard, not in code. Documented here for the user to set up post-cutover.

---

## Local dev story

Cloud Functions emulator is replaced by `wrangler dev`. Runs Workers + D1 + R2 + DOs locally with hot reload.

```bash
# In workers/:
wrangler d1 create reno-dev-space            # one-time, capture the DB id
wrangler d1 execute reno-dev-space --local --file=./migrations/0001_initial.sql
wrangler d1 execute reno-dev-space --local --file=./migrations/0002_auth.sql
wrangler dev --persist-to=.wrangler/state    # local dev
```

`.wrangler/state` is gitignored; persists local D1 between runs.

For the frontend Next.js app to call the local Worker:
- `next dev` runs on `:3000`
- `wrangler dev` runs on `:8787`
- Frontend has `NEXT_PUBLIC_API_BASE = 'http://localhost:8787'` in `.env.local`, defaulting to same-origin in prod

---

## Files that change

- New repo subdirectory: `workers/` (everything above)
- `package.json` root — add `"workers"` to npm workspaces; new script `npm run dev:api`
- `next.config.js` — no change (the Worker is a separate deploy; Pages serves the Next.js static export untouched)
- All `functions/` source — deleted after cutover
- `firebase.json`, `.firebaserc` — deleted
- `firestore.indexes.json` (if present) — deleted

---

## Open questions

1. **Cron jobs.** None currently exist. If we want one to periodically reconcile pledge totals or clean orphan R2 images, Workers Cron Triggers handle it (`crons` field in `wrangler.jsonc`). Defer.
2. **Logging / observability.** Cloudflare Workers Logs (free, 100K events/day) covers it. Sentry has a Workers SDK if needed later. Not in scope for v1.
3. **Multi-region.** Workers run globally by default; D1 is single-region with read replicas. For Reno-based users this is fine. Defer.
