# Email Migration: Nodemailer/Gmail SMTP → Resend (outbound) + Cloudflare Email Routing (inbound)

Replaces the Gmail-SMTP-via-Nodemailer outbound path with Resend, and adds an inbound path via Cloudflare Email Routing (currently nothing inbound exists; this gives `info@renodevspace.org` and similar addresses a home).

---

## Current outbound

- **Provider:** Gmail SMTP (`smtp.gmail.com:587`) via Nodemailer in `functions/src/email.ts`
- **Auth:** Gmail app password (`email.user`, `email.pass` secrets)
- **From address:** `"Reno Dev Space" <noreply@renodevspace.org>`
- **Templates:** 4 HTML files in `email-templates/` (also editable live in Firestore `emailTemplates` collection, which overrides the static files)
- **Volume:** verification emails (per signup) + admin-triggered campaign blasts (occasional)

### Problems with the current setup

1. **Gmail is not a transactional email provider.** Limits are vague (~500/day for personal accounts, more for Workspace), and Google can suspend the account for "spammy" behavior with no warning. Campaign blasts of 200+ recipients risk this.
2. **Deliverability is a coin flip.** Mail from a Gmail-authenticated address with a `renodevspace.org` From header sends mixed DKIM/SPF signals. Inboxes route it inconsistently.
3. **App passwords are deprecated in some Google workflows.** Future-proofing weak.

---

## Target outbound: Resend

| Property | Detail |
|---|---|
| Provider | [Resend](https://resend.com) |
| API | HTTP `POST https://api.resend.com/emails` (no SMTP, no Nodemailer) |
| Auth | API key (env secret `RESEND_API_KEY`) |
| From address | `"Reno Dev Space" <noreply@renodevspace.org>` (unchanged) |
| DKIM/SPF/DMARC | Resend provides the DNS records; user adds them to the Cloudflare zone (5 min) |
| Free tier | 100/day, 3,000/month, 1 verified domain |
| Pro tier | $20/mo for 50K/mo (only if campaign scale demands it) |

**Why not Postmark / SendGrid / SES:**
- Postmark is fine but more expensive at low volume.
- SendGrid's brand is dented by years of compromised reputation; deliverability has suffered.
- SES is the cheapest but the deliverability + setup pain (sandbox mode, IP warming) negates the savings at this scale.
- Resend has the best developer experience and is run by people from React Email — clean integration story for the HTML templates.

### Sending function (Worker-side)

```ts
// workers/src/email.ts
export async function sendEmail(
  env: Env,
  opts: { to: string | string[]; subject: string; html: string }
): Promise<{ id: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Reno Dev Space <noreply@renodevspace.org>',
      reply_to: 'admin@renodevspace.org',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${await res.text()}`);
  return res.json();
}
```

That's the whole transport. Nodemailer's ~200 LOC of SMTP handling disappears.

### Bulk sends

Resend supports batch: `POST /emails/batch` with up to 100 emails per call. For campaign blasts:

```ts
// Chunk recipients into 100-item batches and POST each batch
for (const chunk of chunks(recipients, 100)) {
  await fetch('https://api.resend.com/emails/batch', {
    /* ... */
    body: JSON.stringify(chunk.map(r => ({
      from: '...',
      to: r.email,
      subject,
      html: renderTemplate(template, { ...vars, USER_NAME: r.name }),
    }))),
  });
}
```

---

## Template handling

The current system has dual sources for templates: static files in `email-templates/` and the live-editable `emailTemplates` Firestore collection (latter wins if present). This pattern stays — only the storage layer changes.

### New template flow

1. **Static defaults:** the 4 HTML files (`verify-email.html`, `campaign-success.html`, `campaign-ended.html`, `campaign-update.html`) move from `functions/templates/` to `workers/templates/`. Bundled with the Worker at deploy time.
2. **Live overrides:** D1 `email_templates` table (per `SCHEMA.md`). Admin edits via the existing EmailsPanel UI, which now POSTs to `/api/admin/templates/:id` instead of writing to Firestore.
3. **Loader:**

```ts
async function loadTemplate(env: Env, id: string): Promise<string> {
  // Try D1 override first
  const row = await env.DB.prepare('SELECT html FROM email_templates WHERE id = ?').bind(id).first<{html: string}>();
  if (row) return row.html;
  // Fall back to bundled file
  return BUNDLED_TEMPLATES[id];
}
```

`BUNDLED_TEMPLATES` is a build-time import of the 4 files (Wrangler supports `import html from './templates/foo.html'` via the text plugin).

### Variable substitution

Current code uses simple `{{VAR}}` token replacement. Keep it — adding a templating engine like Handlebars is overkill for 4 templates with 10–15 variables each.

```ts
function renderTemplate(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
    html
  );
}
```

### EmailsPanel rewrite

`src/components/panel/EmailsPanel.tsx` currently fetches templates from Firestore via `subscribeToEmailTemplates`. After migration:
- The fetch becomes a WS subscription to `EmailTemplateDO` (per `REALTIME.md`).
- The save call (currently `setDoc`) becomes `POST /api/admin/templates/:id`.
- The "send test email" button POSTs to `/api/admin/email/test`.
- The "send campaign update" button POSTs to `/api/admin/email/campaign-update`.

UI shape, props, state — all unchanged.

---

## Inbound email (new capability)

Currently the app has **no inbound email**. `info@renodevspace.org`, `support@renodevspace.org`, etc. don't resolve. Cloudflare Email Routing fills this gap on the free tier.

### Two-tier approach

| Tier | Tool | Use |
|---|---|---|
| **Tier 1: Forwarding** | Email Routing rules | Forward `info@renodevspace.org`, `admin@renodevspace.org` to christopher@corella.com. Zero code. |
| **Tier 2: Programmatic** | Email Workers (beta) | A Worker receives the raw email and decides what to do. Use cases: mailing-list submissions, support ticket creation, automated bounces. |

### Setup (Tier 1) — user-driven

1. Cloudflare Dashboard → renodevspace.org zone → Email → Email Routing → Enable.
2. Add destination address: `christopher@corella.com`. Cloudflare sends a verification email.
3. Add routing rules:
   - `info@renodevspace.org` → christopher@corella.com
   - `support@renodevspace.org` → christopher@corella.com
   - `admin@renodevspace.org` → christopher@corella.com (catches replies to campaign emails, per Reply-To decision)
   - `noreply@renodevspace.org` → bounce (so verification email bounces are visible)
4. Cloudflare auto-adds the necessary MX records (orange-cloud immune; required for inbound mail).

That's the entire inbound setup at v1. No code, no Worker.

### Tier 2 (deferred)

When the co-op wants a mailing list signup or automated processing, add an Email Worker:

```ts
export default {
  async email(message, env, ctx) {
    if (message.to === 'subscribe@renodevspace.org') {
      // parse sender, add to newsletter, send confirmation
    }
  },
};
```

Not in scope for the migration. Documented here so it's known the capability exists.

---

## Deliverability checklist

Before flipping outbound from Gmail to Resend, the user adds DNS records that Resend provides. These prove the domain authorizes Resend to send on its behalf.

| Record | Purpose | Source |
|---|---|---|
| SPF (TXT) | Lists Resend's IPs as authorized senders | Resend dashboard |
| DKIM (CNAME × 3) | Cryptographic signing | Resend dashboard |
| DMARC (TXT) | Policy for mail that fails SPF/DKIM | Recommend: `v=DMARC1; p=none; rua=mailto:dmarc@renodevspace.org` initially |

All three live as DNS records in the renodevspace.org Cloudflare zone. User adds them via the Cloudflare DNS panel — Resend's dashboard generates the exact strings to paste.

**Verify before cutover:** [mail-tester.com](https://www.mail-tester.com/) — send a test email to their address, get a score. Aim for 10/10. If it's lower, the report tells you what's missing.

---

## Migration steps

1. **Pre-cutover:** create Resend account, add `renodevspace.org` as verified domain, get DKIM/SPF records.
2. **DNS:** user adds the records to Cloudflare zone (5 min, no code change).
3. **Code:** new `workers/src/email.ts` replaces `functions/src/email.ts`. `sendEmail()` is the new transport.
4. **Templates:** copy the 4 HTML files from `functions/templates/` to `workers/templates/`.
5. **Live overrides:** export `emailTemplates` Firestore collection, import into `email_templates` D1 table (covered in `CUTOVER.md`).
6. **Cutover:** flip the Worker deploy; old Cloud Functions stop receiving traffic; new Worker handles signup verification + admin sends.
7. **Old footer audit:** any saved HTML templates in the `emailTemplates` collection still contain the old `cwcorella-github.io/reno-dev-space/` URL (per `MIGRATION.md` line 43). Fix during data export.

---

## Files that change

- `functions/src/email.ts` — deleted (replaced by `workers/src/email.ts`)
- `functions/src/emailFunctions.ts` — deleted (handlers move to `workers/src/routes/admin.ts`)
- `functions/templates/*.html` → `workers/templates/*.html` (moved)
- `src/components/panel/EmailsPanel.tsx` — replace Firestore reads with WS subscription + fetch POSTs
- `src/components/panel/EmailHtmlEditor.tsx` — replace `setDoc` with `POST /api/admin/templates/:id`
- `src/components/panel/EmailVariableEditor.tsx` — replace `subscribeToPledges` etc. with WS subscriptions

---

## Unsubscribe links (v1, per user decision 2026-05-20)

Every campaign email (`campaign-success`, `campaign-ended`, `campaign-update`) ships with a working unsubscribe link in v1. Verification emails (transactional, not campaign) are exempt — there's nothing to unsubscribe *from* once verified.

### Schema additions (also referenced in `SCHEMA.md`)

```sql
ALTER TABLE pledges ADD COLUMN unsubscribe_token TEXT UNIQUE;
ALTER TABLE pledges ADD COLUMN unsubscribed_at INTEGER;  -- NULL = subscribed

CREATE INDEX idx_pledges_unsubscribe ON pledges(unsubscribe_token);
```

`unsubscribe_token` is generated per pledger at row creation (`nanoid(32)` is fine — 32 chars of URL-safe entropy, ~190 bits). Stored permanently; never rotated (rotation would invalidate links in old emails sitting in inboxes).

### Route

```ts
// GET /api/unsubscribe?token=...
app.get('/api/unsubscribe', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.text('Missing token', 400);

  const result = await c.env.DB.prepare(
    `UPDATE pledges SET unsubscribed_at = ? WHERE unsubscribe_token = ? AND unsubscribed_at IS NULL`
  ).bind(Date.now(), token).run();

  if (result.meta.changes === 0) {
    return c.text('Already unsubscribed or invalid link', 404);
  }
  return c.html(unsubscribeConfirmedHTML);  // simple "you're unsubscribed" page
});
```

GET (not POST) so a click in an email client works without JavaScript. The token is the only auth — anyone with the link can unsubscribe that pledger, which is the right behavior (a pledger forwarding to a friend wanting to unsubscribe them on their behalf works).

### Template addition

Append to all three campaign templates' footer HTML:

```html
<p style="font-size: 12px; color: #888; margin-top: 32px;">
  You're receiving this because you pledged to support Reno Dev Space.
  <a href="https://renodevspace.org/api/unsubscribe?token={{UNSUBSCRIBE_TOKEN}}" style="color: #888;">
    Unsubscribe
  </a>
</p>
```

`{{UNSUBSCRIBE_TOKEN}}` joins the template variable list. The bulk-send batching code in `adminEmailHandler` (see `FUNCTIONS.md`) reads each recipient's token from their pledge row when building the per-recipient `vars` object.

### Send-time filtering

The recipient-loading helper excludes unsubscribed pledgers:

```ts
// loadRecipients() — pledgers audience
SELECT email, name, unsubscribe_token
FROM pledges
JOIN users ON users.id = pledges.user_id
WHERE pledges.is_active = 1
  AND pledges.unsubscribed_at IS NULL
```

Plain SQL filter. No cron job needed.

### List-Unsubscribe header (bonus)

Resend automatically sets the `List-Unsubscribe` and `List-Unsubscribe-Post` headers when the unsubscribe link is included as a known pattern. This enables one-click unsubscribe in Gmail/Apple Mail without leaving the inbox — significant deliverability + reputation benefit. No extra code; the link inclusion is enough.

---

## Open questions

1. **Reply-to address.** `noreply@renodevspace.org` is the From, but a Reply-To pointing at a real inbox would be friendlier ("reply to admin@renodevspace.org"). Decide during EMAIL_SETUP follow-up.
2. **Email previews in EmailsPanel.** Currently rendered client-side from the template + sample data. Keep the same; no server round-trip needed for preview.
3. **Bounce handling.** Resend has webhooks for delivered/bounced/complained. We could write a `/api/webhooks/resend` route to log these in `email_history`. Defer — current code doesn't track delivery either.
