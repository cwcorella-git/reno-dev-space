# Resume — Session 1 (Worker Skeleton Deploy)

**Where we stopped:** `feat/cloudflare-migration` branch at commit `79ecaf3` — Worker code is scaffolded, TypeScript compiles, migration SQL is generated, but nothing is provisioned on Cloudflare or Resend yet. No live deploy.

**Status of tasks #1–10:** done in earlier sessions.
**Status of session 1 tasks:**
- ✅ #11 branch created
- ✅ #12 workers/ scaffolded
- ✅ #13 Drizzle schema written + SQL generated
- ✅ #14 Resend transport written
- ✅ #15 better-auth setup written
- ✅ #16 Hono router written
- ✅ #17 root .gitignore updated
- ⏸ #18 provision D1 + secrets + deploy — **waiting on you**
- ⏸ #19 end-to-end verification — depends on #18

---

## Your side (do these in order, can do in any order amongst yourselves, just before resuming)

### 1. Install Wrangler globally (5 min)

```bash
npm install -g wrangler@latest
wrangler --version          # confirm it prints 3.x or 4.x
```

There's no separate "Cloudflare CLI" — **Wrangler is the Cloudflare CLI**. (The older `flarectl` is for legacy DNS/zone work only, irrelevant here.) Wrangler is already in `workers/devDependencies`, so `cd workers && npx wrangler ...` also works without a global install — but global is more convenient for ad-hoc commands.

### 2. Authenticate Wrangler (2 min, interactive)

```bash
wrangler login
```

Opens a browser, you log into Cloudflare, click "Allow." Tokens land in `~/.config/.wrangler/config/default.toml`. After this, every `wrangler` command uses your account automatically.

Confirm it worked:
```bash
wrangler whoami
# should print: christopher@corella.com (or whichever account you logged in as)
```

### 3. Upgrade to Workers Paid plan ($5/mo) (3 min, dashboard)

- Cloudflare dashboard → Workers & Pages → Plans → Workers Paid → Upgrade.
- Even though Session 1 doesn't use Durable Objects, the upgrade is a prereq for Session 2+ and is cheaper to do once now. See [docs/migration/COSTS.md](COSTS.md) for the financial rationale.

### 4. Set up Resend (10–35 min including DNS propagation)

- **Sign up** at [resend.com](https://resend.com) (free tier). Capture the API key.
- **Resend dashboard → Domains → Add domain → `renodevspace.org`**. Resend gives you DKIM CNAMEs (×3) and an SPF TXT record.
- **Cloudflare dashboard → renodevspace.org → DNS → Records → Add record** for each line Resend gave you. Important: set DKIM records to **DNS only (gray cloud)**, not proxied — Cloudflare's proxy strips DKIM signatures.
- Wait 5–30 min for DNS propagation.
- **Resend dashboard → Domains → click Verify** on `renodevspace.org`. Should go green.

### 5. Confirm you're done by leaving the Resend API key handy

You'll paste it when I run `wrangler secret put RESEND_API_KEY` — Wrangler prompts for the value, doesn't accept it via CLI arg.

---

## When you come back, just say:

> "wrangler is set up, resend is verified, ready to deploy"

I'll handle the rest (in this order, ~15 min):

1. `cd workers && wrangler d1 create reno-dev-space` — get the database_id.
2. Paste the id into `workers/wrangler.jsonc` (replacing `PLACEHOLDER_FILLED_BY_WRANGLER_D1_CREATE`).
3. Generate a 32-byte BETTER_AUTH_SECRET and run `wrangler secret put BETTER_AUTH_SECRET`.
4. `wrangler secret put RESEND_API_KEY` (you paste the value when prompted).
5. `wrangler d1 migrations apply reno-dev-space --remote` — applies `0000_initial.sql`.
6. `wrangler deploy` — gets us a `*.workers.dev` URL.
7. Walk through the 7-step verification (`/api/health`, signup, email click, D1 inspection).

---

## Acceptance criteria (the bar for declaring Session 1 done)

End-state: Worker deployed at `https://reno-dev-space-api.<account>.workers.dev`. The super-admin (`christopher@corella.com`) can:

1. Hit `/api/health` and get `{"ok":true}`
2. POST to `/api/auth/sign-up/email` and get 200
3. Receive a verification email From `noreply@renodevspace.org`, Reply-To `admin@renodevspace.org`, within ~1 minute
4. Click the verification link → see better-auth's confirmation page
5. `wrangler d1 execute reno-dev-space --remote --command="SELECT email, email_verified FROM auth_user"` shows `email_verified=1`
6. `wrangler d1 execute reno-dev-space --remote --command="SELECT email FROM users"` shows the profile row

If any of those fail, the per-step failure-mode map is in the plan file at `~/.claude/plans/spicy-juggling-treehouse.md`.

---

## What this session does NOT do (kept narrow on purpose)

No Durable Objects, no WebSocket subscriptions, no canvas/property/chat/Stripe routes, no frontend changes, no Firestore data export. All deferred to sessions 2–13. See [docs/migration/IMPLEMENTATION.md](IMPLEMENTATION.md) for the full session sequence.

---

## Background reading (if you want it, while DNS propagates)

- The full design set lives in `docs/migration/` — start with [README.md](README.md) for the navigation index and the cumulative resolved-decisions log.
- The plan file `~/.claude/plans/spicy-juggling-treehouse.md` is the implementation plan for this session specifically; auto-overwritten next session.

---

## Files this session changed

| File | What |
|---|---|
| `.gitignore` | Added `/workers/node_modules`, `/workers/.wrangler`, `/workers/.dev.vars` |
| `workers/` | Entire new directory; see commit `79ecaf3` for the manifest |
| `src/lib/siteConfig.ts` | (earlier in session) Defined `SITE_URL = 'https://renodevspace.org'` |
| `functions/src/emailFunctions.ts` | (earlier) Sample VERIFICATION_LINK now uses renodevspace.org |
