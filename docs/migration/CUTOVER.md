# Cutover: Sequencing & Rollback

How we get from "live on Firebase" to "live on Cloudflare." Per user decision 2026-05-20, **no existing data is preserved except canvas blocks**. No users, no chat history, no email logs, no pledges — fresh start everywhere else. This collapses what was originally a three-window plan (Build / Dual-write / Decommission) into a hard cutover with one tiny data move.

**Verification standard for this doc:** the rollback section must get the site back to live Firebase within 1 hour if migration fails after cutover. With the fresh-start model this is feasible because the only loss-bearing change is canvas-block content, which has a small export.

---

## Two-phase model

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│   PHASE 1: Build                     │   PHASE 2: Hard cutover              │
│   (Firebase still authoritative)     │   (Cloudflare authoritative)         │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ - Worker deployed, idle              │ - Pages env points at new API        │
│ - D1 schema created                  │ - Canvas blocks imported one-way     │
│ - Templates ported                   │ - Firebase env vars deleted          │
│ - Canvas-block export staged         │ - Old Firestore made read-only       │
│ - DNS unchanged                      │ - 24h soak                           │
│ - Reversible: just delete W.         │ - Then Firebase deprovisioned         │
└──────────────────────────────────────┴──────────────────────────────────────┘
       Days 1–N                                Single push, then 24h watch
```

The original Window B (dual-write) is gone. We can do without it because:
1. **No production users to break.** A "wrong" cutover affects only the development team's test accounts.
2. **No history to reconcile.** Chat, votes, pledges, presence — all start empty. No drift between systems possible.
3. **The only data move (canvas blocks) is one-way at a single moment.** No ongoing sync needed.

If user numbers grow before cutover happens, this model needs revisiting — but at zero users today, fresh-start is the right call.

---

## Phase 1: Build (no user-visible change)

Everything here runs in parallel with the existing Firebase deploy. Site continues running on Firebase.

### 1.1 — Provision Cloudflare infrastructure (user-driven, no code)

- `wrangler d1 create reno-dev-space` — capture the ID for `wrangler.jsonc`.
- `wrangler r2 bucket create renodevspace-assets`.
- Attach `cdn.renodevspace.org` custom domain to the R2 bucket (dashboard).
- Resend: verify `renodevspace.org` as a sending domain; copy DKIM/SPF records into the Cloudflare zone.
- **Upgrade to Workers Paid plan** ($5/mo) — required for Durable Objects, per `COSTS.md`.

### 1.2 — Land the schema

```bash
wrangler d1 execute reno-dev-space --remote --file=./workers/migrations/0001_initial.sql  # SCHEMA.md tables
wrangler d1 execute reno-dev-space --remote --file=./workers/migrations/0002_auth.sql     # AUTH.md tables
```

Sanity check:
```bash
wrangler d1 execute reno-dev-space --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```
Must list every table defined in `SCHEMA.md` and `AUTH.md`.

### 1.3 — Deploy the Worker (idle)

The Worker is deployed but receives no production traffic. Its routes (`/api/*`) exist on the `.workers.dev` URL but `renodevspace.org` doesn't route to it yet.

```bash
cd workers && wrangler deploy
```

Integration tests against `.workers.dev`:
- `POST /api/auth/sign-up` with the super-admin email → verify D1 `auth_user` row appears + Resend delivers verification email.
- Click the verification link → confirm `email_verified=1` on the auth_user row.
- Log in → confirm a session cookie is set.
- `POST /api/canvas` with the session → confirm a row in `canvas_blocks`.
- WebSocket to `/api/subscribe/canvas` → confirm initial snapshot + live update on the next write.

These are the end-to-end gates. All must pass before Phase 2.

### 1.4 — Export Firestore data to D1 (one-way)

Three collections carry over, per user decisions 2026-05-20. Everything else starts empty. The script is still small (~150 LOC):

```bash
node scripts/export-to-d1.mjs --remote
```

What it does:

**Canvas blocks (`canvasBlocks` → `canvas_blocks`):**
1. Read all docs from Firestore.
2. Transform: flatten `style` object to JSON column, drop voter arrays, reset `brightness` to 50.
3. `INSERT INTO canvas_blocks`. `created_by` gets the placeholder UID `'imported-pre-migration'` (no FK enforced until super-admin signs up, then we can reassign or leave).

**Site content (`siteContent` → `site_content`):**
1. Read all 80+ CMS keys from Firestore.
2. Straight insert into `site_content` (PK is the key). No transformation needed.
3. Preserves every Ctrl+click UI edit you've made.

**Rental properties (`rentalProperties` → `rental_properties` + R2):**
1. Read all property docs from Firestore.
2. For each property, download the image from Firebase Storage via the existing `imageUrl`.
3. Upload to R2 at the same path: `properties/{propertyId}/main.jpg`.
4. `INSERT INTO rental_properties` with the new `image_url` pointing at `https://cdn.renodevspace.org/properties/{id}/main.jpg`.
5. Reset `brightness` to 50; drop voter/report arrays.

**Skipped (per user decision):**
- `users`, `pledges`, `donations`, `chatMessages`, `presence`, `deletedBlocks`, `blockEdits` — fresh start.
- `admins`, `bannedEmails`, `emailTemplates` — confirmed empty/unmodified; nothing to carry.
- `settings/campaign`, `settings/propertyGallery` — empty defaults are fine.
- `emailHistory` — audit log of past sends; not load-bearing.

After import: every canvas note + every UI string + every property listing (with image) is in the new stack. Vote/edit/report history is gone; new contributors start the engagement counter fresh.

### 1.5 — Rollback baseline

Take a final Firestore backup via `scripts/backup-firestore.js`. Store offsite. This is the "if cutover goes sideways, restore from this" snapshot. Probably never used, but it's cheap insurance.

---

## Phase 2: Hard cutover

Single push, then watch.

### 2.1 — Pre-flight (the day before)

- Confirm the Worker passes all 1.3 integration tests against fresh D1.
- Re-run 1.4 to refresh the canvas-block import (in case anyone added blocks during build).
- Verify Resend test send to the super-admin email lands in inbox (not spam).
- Verify `cdn.renodevspace.org` serves a test R2 object.
- Tag the current Firebase-using commit on `main` as `v1.x.x-final-firebase` so it's easy to revert.

### 2.2 — Switch frontend to new API

In the Cloudflare Pages project → Settings → Environment variables:
- Add `NEXT_PUBLIC_API_BASE=https://renodevspace.org` (or leave unset since the Worker is on the same domain — see `FUNCTIONS.md` routing).
- **Remove** all `NEXT_PUBLIC_FIREBASE_*` env vars.

Push the cutover commit (the one where `src/lib/storage/*.ts` modules use the Worker WebSocket subscriptions instead of Firestore, `src/contexts/AuthContext.tsx` uses better-auth, etc.). Pages rebuilds and deploys.

Within ~2 minutes, `renodevspace.org` is serving the new build that talks to the new Worker. **This is the cutover moment.**

### 2.3 — Make Firestore read-only (safety net, 24h)

Don't delete Firebase yet — make it inert. In Firebase Console → Firestore → Rules, replace all rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if false;
      allow write: if false;
    }
  }
}
```

If anything in the new build still tries to read or write Firestore (regression we missed in testing), it fails loudly instead of silently writing data nobody will see again. Watch the Firebase Console error rates for 24 hours.

### 2.4 — Soak (24 hours)

Use the site as normal. Sign up. Create canvas blocks. Vote. Add a property listing. Send a test campaign email. Watch:
- Worker logs (`wrangler tail`) for unhandled errors.
- D1 query metrics in the Cloudflare dashboard.
- R2 ops count (uploads/downloads should track usage).
- Resend dashboard for email send/delivery rates.
- Browser console for any 4xx/5xx from `/api/*`.

If anything is broken, follow the **Rollback during Phase 2** section below.

### 2.5 — Decommission Firebase

After 24h of clean operation:

**Archive first (offline, gpg-encrypted, stored outside Google's reach):**
- Full Firestore JSON backup via `scripts/backup-firestore.js`. Insurance against "who voted on what" questions later.
- Firebase Storage images — `gsutil -m cp -r gs://<project>.appspot.com/properties/* ./archive/storage/properties/`. The R2 copies are the live ones; this is the original-source backup.
- *Skipped (per user decision 2026-05-20):* Auth user list (no users worth notifying), Cloud Functions code (already in git).

**Then deprovision:**
- Delete the Firebase project (or downgrade to free + leave dormant 30 days if you want a longer paranoia buffer).
- Remove all Firebase secrets from the Worker (none should exist) and any leftover env vars from Pages.
- Delete the `functions/` directory from the repo.
- Update `CLAUDE.md`'s tech stack section.
- Update `~/.claude/projects/-home-user-Projects-reno-dev-space/memory/MEMORY.md`.
- Tag the release: `v2.0.0-cloudflare-only`.

---

## Rollback procedures

### Rollback during Phase 1

Trivial. Nothing in production has changed.

```bash
wrangler d1 delete reno-dev-space
wrangler r2 bucket delete renodevspace-assets
wrangler delete reno-dev-space-api
```

**Time to recover: 5 minutes.**

### Rollback during Phase 2 (within the 24h soak)

Firebase isn't deleted yet — just read-only. Recovery path:

1. **Re-enable Firestore rules** by reverting the read-only ruleset in Firebase Console (paste back the original rules from the pre-cutover backup or from version control if they were ever committed).
2. **Revert the cutover commit** in the Pages deploy:
   ```bash
   git revert <cutover-commit>
   git push
   ```
3. **Restore the Firebase env vars** in the Pages Settings → Environment variables panel (the values are in the `v1.x.x-final-firebase` git tag's deploy.yml secrets list).
4. Wait ~2 minutes for Pages to rebuild.
5. **Verify** the site loads, you can sign in with the old Firebase Auth (was untouched), and Firestore subscriptions are live again.

**Time to recover: 30 minutes.** Well under the 1-hour bar.

The new canvas blocks created during the failed cutover window are stranded in D1 — they don't appear in restored Firestore. Acceptable loss given the rollback model: the soak window is short, content created during it is small.

### Rollback after Phase 2.5 (Firebase deleted)

**Catastrophic case.** Recovery requires recreating Firebase from the offsite backup.

1. Recreate the Firebase project (try to preserve project ID for Storage URL continuity, but not load-bearing since no users have email links).
2. Re-enable Firebase Auth, Firestore, Storage, Functions.
3. Restore Firestore from the 2.5 final backup with `scripts/restore-firestore.js`.
4. Restore Firebase Storage (re-upload property images from R2 to Firebase Storage at identical paths).
5. Re-deploy Cloud Functions (`git checkout v1.x.x-final-firebase -- functions/ && cd functions && npm run deploy`).
6. Restore `NEXT_PUBLIC_FIREBASE_*` env vars in Pages.
7. Revert the cutover commit on `main`.
8. Deploy.

**Time to recover: 4–8 hours.** Blows the 1-hour bar.

**Implication:** the 24h soak is the line. After Phase 2.5 (delete Firebase), there's no fast recovery. The user explicitly green-lights Phase 2.5 — it's not a routine step.

---

## Cross-doc validation: what each migration phase touches

| Phase | Affected docs |
|---|---|
| 1.1 — Provisioning | `COSTS.md` (Workers Paid plan), `STORAGE.md` (R2 bucket), `EMAIL.md` (Resend domain) |
| 1.2 — Schema | `SCHEMA.md`, `AUTH.md` (better-auth tables) |
| 1.3 — Worker deploy | `FUNCTIONS.md` (entire surface), `REALTIME.md` (DO classes) |
| 1.4 — Canvas import | This doc |
| 2.2 — Cutover commit | All `src/lib/storage/*.ts`, `src/contexts/AuthContext.tsx`, `src/components/panel/EmailsPanel.tsx`, etc. — the actual code swap |
| 2.5 — Decommission | `CLAUDE.md`, `~/.claude/projects/.../MEMORY.md`, `functions/` directory |

If any doc above changes shape after this is written, this doc updates.

---

## Out of scope here

- The canvas-block export script (`scripts/export-canvas-to-d1.mjs`) — to be written during implementation, following the design above.
- D1 backup automation — Cloudflare has built-in point-in-time recovery on D1; supplement with a weekly `wrangler d1 export` to R2 via cron Worker.
- A monitoring stack — Cloudflare Workers Logs covers it for v1. Sentry can be added later.

---

## The single most important thing in this doc

**The 24-hour soak between cutover and Firebase decommission is non-negotiable.** Skipping it changes a 30-minute rollback into a 4–8 hour recovery. The cost of waiting a day is zero; the cost of moving fast is catastrophic if anything's wrong.
