# Firebase → Cloudflare Migration Docs

Implementation blueprint for removing Firebase entirely and replacing it with a Cloudflare-centric stack. **Documentation phase only.** No code has been written for this migration as of 2026-05-20.

## Why this exists

The Pages migration (`/MIGRATION.md`, completed 2026-05-19) moved static hosting from GitHub Pages to Cloudflare Pages. The app still depends on Firebase for data, auth, storage, and functions. This documentation set scopes the next phase — fully eliminating Firebase to:

1. **Avoid metered-billing lock-in** to Google's pricing decisions (see `COSTS.md`).
2. **Preserve transferability** by keeping the entire stack on open standards (SQLite, S3-protocol, open-source auth) that can be re-hosted elsewhere if needed.
3. **Reduce vendor count from "Google + Stripe" to "Cloudflare + Stripe + Resend"** — slightly more vendors, but billing-account-transferable rather than codebase-coupled.

The high-level values reasoning lives in `/docs/POST_FIREBASE.md`. This `docs/migration/` tree is the actionable layer below it.

## Reading order

For a fresh reader who wants to understand the whole plan:

1. **`INVENTORY.md`** — what Firebase actually does in this codebase today. Concrete surface map.
2. **`COSTS.md`** — financial framing. Validates (or invalidates) the migration's motivation.
3. **`SCHEMA.md`** — target D1 (SQLite) schema with CREATE TABLE statements.
4. **`REALTIME.md`** — how `onSnapshot` translates to Durable Objects + WebSockets. The architectural core.
5. **`AUTH.md`** — Firebase Auth → better-auth on Workers.
6. **`STORAGE.md`** — Firebase Storage → R2.
7. **`FUNCTIONS.md`** — Cloud Functions → single Worker with Hono router.
8. **`EMAIL.md`** — Nodemailer/Gmail → Resend (outbound) + Cloudflare Email Routing (inbound).
9. **`CUTOVER.md`** — sequencing, hard-cutover plan, 24h soak window, rollback.
10. **`IMPLEMENTATION.md`** — process decisions (Drizzle, Zod, branch strategy, local dev, first session scope).

Docs 5–8 are independent of each other and can be read in any order.

## Status

| Doc | State | Last updated |
|---|---|---|
| `INVENTORY.md` | Draft, awaiting review | 2026-05-20 |
| `COSTS.md` | Draft, awaiting review | 2026-05-20 |
| `SCHEMA.md` | Draft, awaiting review | 2026-05-20 |
| `REALTIME.md` | Draft, awaiting review | 2026-05-20 |
| `AUTH.md` | Draft, awaiting review | 2026-05-20 |
| `STORAGE.md` | Draft, awaiting review | 2026-05-20 |
| `FUNCTIONS.md` | Draft, awaiting review | 2026-05-20 |
| `EMAIL.md` | Draft, awaiting review | 2026-05-20 |
| `CUTOVER.md` | Draft, awaiting review | 2026-05-20 |

All nine drafts landed in a single session. They cross-reference each other; review them as a system, not in isolation. Conflicts between docs (e.g. `SCHEMA.md` defines a `presence` table that `REALTIME.md` recommends dropping) are intentional — flagged in the source doc with a pointer to the resolving doc.

## Key cross-doc decisions

These show up in multiple docs and are worth seeing in one place:

| Decision | Where decided | Why |
|---|---|---|
| Per-collection Durable Objects (15 of them) | `REALTIME.md` | Natural boundary; matches `src/lib/storage/*.ts` granularity; avoids single-DO write serialization |
| Voting arrays become join tables (`block_votes`, `property_votes`) | `SCHEMA.md` | SQL-native; SQLite has no first-class array type; voter cardinality grows monotonically |
| Denormalized `brightness` column on parent rows | `SCHEMA.md` | Read-heavy load + simple write-side recompute in a transaction = right trade |
| Presence in DO memory, not D1 | `REALTIME.md` | High-frequency ephemeral data shouldn't burn D1 row quotas |
| better-auth replaces Firebase Auth | `AUTH.md` | Open source, D1-first, lifecycle hooks match Firebase Auth triggers |
| `auth_user` and `users` are separate tables sharing ID | `AUTH.md` | Lets better-auth schema stay un-customized for easy upgrades |
| R2 served via public custom domain `cdn.renodevspace.org` | `STORAGE.md` | Property images are public; no need for signed URLs; free egress |
| Single Worker, not many — Hono router | `FUNCTIONS.md` | Cheaper, faster cold start, single deploy unit |
| Resend for transactional outbound; Cloudflare Email Routing for inbound | `EMAIL.md` | Email is the one place Cloudflare lacks a native send capability; Resend is the cleanest gap-filler |
| Three-window cutover (Build → Dual-write → Cloudflare-only) | `CUTOVER.md` | Dual-write is the only safe recovery model; do not skip |
| Workers Paid plan ($5/mo) is the new floor | `COSTS.md` | Durable Objects require it; trades "free until cliff" for "$5 + much higher cliffs" |

## Resolved decisions (user, 2026-05-20)

These decisions came back from the first round of review and are now folded into the affected docs:

- **No existing users carry over.** Fresh start. The scrypt→bcrypt password-bridging design in `AUTH.md` is dropped; user identities start empty.
- **No data carry over except canvas blocks.** Single one-way import of `canvasBlocks` Firestore docs → D1 `canvas_blocks` rows. Everything else (chat, votes, pledges, properties, history, email logs) starts empty. This collapses `CUTOVER.md` from a three-window (Build / Dual-write / Decommission) plan into a two-phase (Build / Hard cutover) plan.
- **Hard FK cascade on user deletion.** No history to preserve → no reason for soft-delete posture. All content tables `ON DELETE CASCADE` from `users.id`.
- **Legacy `voters[]` field dropped.** No data to bridge; runtime drops the legacy concept entirely.
- **Upload validation: 5MB max, jpeg/png/webp only.** Per `STORAGE.md`.
- **Unsubscribe link is v1, not v1.5.** Per `EMAIL.md`. Adds an `unsubscribe_token` column on `pledges` and a `/api/unsubscribe?token=...` route, plus template footer changes.

## Resolved decisions, round 2 (2026-05-20)

- **Session cookie: apex only (`renodevspace.org`).** Does not carry to subdomains.
- **Reply-To: `admin@renodevspace.org`.** Forwarded via Cloudflare Email Routing to christopher@corella.com. The Reply-To header is set on every outgoing email by `sendEmail()` in `workers/src/email.ts`.

## Resolved decisions, round 3 — scope (2026-05-20)

Carry over from Firestore (in addition to canvas blocks):

- **`siteContent` CMS** — yes. 80+ UI text keys preserved; no lost customization.
- **`rentalProperties` + R2 images** — yes. Full property gallery transfer including image downloads from Firebase Storage and uploads to R2 at identical paths.
- **`emailTemplates`** — no. User confirms no edits made; bundled HTML files suffice.
- **`admins`** — no. Only super-admin exists; hardcoded.
- **`bannedEmails`** — no. Empty.

Archive before deleting Firebase (Phase 2.5):

- Full Firestore JSON backup (gpg-encrypted, offline).
- Firebase Storage images (original-source backup; R2 holds the live copies).
- Not archived: Auth user list (no users worth notifying), Cloud Functions code (in git).

## Resolved decisions, round 4 — implementation process (2026-05-20)

See `IMPLEMENTATION.md` for full details:

- **Query layer:** Drizzle ORM with D1 adapter.
- **Validation:** Zod on every Worker route.
- **Branch strategy:** single long-lived `feat/cloudflare-migration` branch with incremental sub-PRs; single merge to `main` is the cutover commit.
- **Local dev:** `wrangler dev` + local D1 (`.wrangler/state`).
- **First session scope:** Worker skeleton + D1 schema + better-auth + Resend; end-state is super-admin can sign up and receive verification email.
- **Implementation kickoff:** next session.

## Verification items (not user decisions; flagged for implementation)

- **`REALTIME.md`:** WebSocket auth via session cookie on the upgrade handshake — confirm better-auth supports it cleanly when implementation begins.
- **`AUTH.md`:** CSRF on better-auth routes through the Cloudflare Pages → Worker path — verify during implementation.
- **`FUNCTIONS.md`:** Cloudflare Rate Limiting Rules — set up in the dashboard once the Worker is deployed.

**All user-facing design decisions are now resolved.** Documentation phase complete.

## What this set does NOT include

- Implementation code. Zero `.ts` files have been written for the Worker, DOs, schema migrations, or the data import script.
- A timeline. The implementation phase will produce its own plan with sequencing once these docs are approved.
- Commitment to Path A from `/docs/POST_FIREBASE.md`. If `COSTS.md` reveals Cloudflare is unviable at projected scale, Path B (self-hosted) gets revisited; these docs are sized so the work isn't wasted in that case (SCHEMA.md applies to Postgres almost unchanged; CUTOVER.md is platform-agnostic).
- A formal threat model. Security considerations are scattered across `AUTH.md`, `FUNCTIONS.md`, and `EMAIL.md`; if the user wants a unified `SECURITY.md`, that's a follow-on doc.

## How to give feedback

Read each doc end-to-end. Push back on any decision marked **"Recommendation:"** that doesn't fit. Flag any cross-doc inconsistency. Anything that's unclear in a doc is a doc bug — these need to be useful to a future implementer who wasn't in the room when they were written.

The single end-to-end success criterion: **a competent engineer (or future-Claude) could implement the migration from these docs alone, without needing to re-discover the surface area.**
