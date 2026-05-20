# Scoping: Life After Firebase

Two scoped paths for migrating off Firebase, evaluated against the values in the [Reno Dev Space Reading Syllabus](../Reno%20Dev%20Space%20Reading%20Syllabus_%20Governance%2C%20Funding%2C%20and%20Community%20for%20a%20Horizontal%20Game%20Co-op.pdf). Status: **scoping only — no commitment**. The [Cloudflare Pages migration](../MIGRATION.md) ships first regardless of which path is chosen here; this work begins after `renodevspace.org` is live.

## Why this is even a question

The current stack rents data, identity, and serverless compute from Google (Firebase). That's vendor lock-in to a megacorp with documented willingness to deprecate. Moving the *static site* to Cloudflare Pages (already in flight) does not change that — Firebase still holds the data. Replacing Firebase is a separate, much larger project.

## Framing from the syllabus

Three texts directly inform this decision:

- **Doctorow, "Library Socialism"** — the *practice* is what's owned in common, not the *infrastructure*. A library doesn't own the building's HVAC; it rents the conditions under which the practice happens. This *permits* renting infrastructure as long as the practice on top is co-op-governed.
- **Ostrom, design principle #8 (nested, polycentric governance)** — a single vendor is a single point of governance failure. Pulls against any single-vendor architecture.
- **Freeman, "The Tyranny of Structurelessness"** — "whoever did it last" becomes invisible hierarchy. Pulls against self-hosting, where sysadmin labor concentrates power in whoever holds the keys.

The honest read: **both paths have a single point of failure**, just located differently. Path A's SPOF is *Cloudflare's continued willingness to host you*. Path B's SPOF is *the co-op member who knows the server*.

## What Firebase actually does for us today

| Feature | Where used | Migration difficulty |
|---|---|---|
| Firestore + `onSnapshot` realtime | Every collection — chat, presence, canvas, voting all push live to every browser | **Hardest** — no drop-in for live sync, must be rebuilt |
| Firebase Auth (email/password + verify emails) | `AuthContext`, `admin.ts` | Medium — unglamorous, easy to get wrong |
| Firebase Storage | Rental property images only | Easy — S3-compatible swap |
| Cloud Functions | Stripe checkout + webhook, email send | Medium — small surface, runtime differences |
| Email send (Nodemailer SMTP) | `email.ts`, `emailFunctions.ts`, 4 HTML templates | Medium — relays exist; deliverability is the cost |
| Email **receive** (currently unused) | Future: info@renodevspace.org, mailing list intake | Hard if self-hosted, easy if delegated |

---

## Path A — Cloudflare-centric

**Premise:** rent everything from Cloudflare; reach for a third party only where Cloudflare genuinely has no product. Ownership transfer is a billing-account handoff, takes an hour.

| Concern | Service | Notes |
|---|---|---|
| Static + dynamic hosting | **Cloudflare Pages + Workers** | Already scoped in MIGRATION.md |
| Persistent data | **D1** (serverless SQLite) | SQL, not document. Schema rewrite required — but no Firestore index drift to chase |
| Realtime sync | **Durable Objects + WebSockets** | You write the sync layer. Well-documented ~500 LOC pattern. Or **PartyKit**, which is built on top of DO — same infra, less code |
| File storage | **R2** | S3-compatible, no egress fees |
| Auth | ⚠ **Cloudflare has no first-party end-user auth** | (a) **better-auth** library on Workers — open source, ~1 week wire-up; (b) **Clerk** — third-party, fastest, adds a vendor |
| Email — outbound | ⚠ **Email Workers cannot send**, only route inbound | **Resend** is the dev-grade pick (~$20/mo for our volume, great DX, handles DKIM/SPF). One third-party dependency |
| Email — inbound | **Email Routing** (free forwards); **Email Workers** (beta) for programmatic processing | Actually *better* than Firebase — a Worker can post mailing-list mail straight to the site |
| Payments | **Stripe** | No change; Stripe has no peer |

**Total vendors:** Cloudflare + Stripe + Resend + (optionally Clerk). Three to four, vs. Google + Stripe today (two).

**Effort:** 4–8 focused weeks. Bulk is Firestore → D1 + custom-realtime rewrite. Auth, storage, email are multi-day each.

**Governance fit:** Aligns with Doctorow's library-socialism framing. The dues page can transparently list "$N/mo Cloudflare, $20/mo Resend, $0 Stripe (per-txn)" the way Noisebridge's Finances page lists rent and utilities.

**Portability hedge:** D1 is SQLite (exportable anywhere). R2 is S3-compatible (rsync to anywhere). better-auth is open source. If Cloudflare ever becomes hostile, the Path A stack re-hosts as Path B without a paradigm rewrite — just operational labor.

---

## Path B — Self-hosted (veritablegames.com architecture)

**Premise:** the co-op owns the hardware and the data. Mirrors the existing veritablegames stack — Coolify on a workstation, Cloudflare Tunnel used only for CDN/tunneling, never for data.

| Concern | Service | Notes |
|---|---|---|
| Hosting | **Coolify** (Docker PaaS) behind `cloudflared` | reno-dev-space becomes a second Coolify app on the existing workstation |
| App runtime | **Next.js with API routes** (drop `output: 'export'`) or separate Fastify API | Structural change — static-export simplicity goes away |
| Persistent data | **Postgres** in Docker | Mature, owned, `pg_dump` cron for backups |
| Realtime sync | **Postgres LISTEN/NOTIFY + WebSockets** (`ws` or Socket.io) | Or **self-hosted Supabase** for bundled realtime+DB+auth in one container |
| File storage | **MinIO** (self-hosted, S3-compatible) | Or local disk + nginx static |
| Auth | **Lucia** or **better-auth** + bcrypt | Same library either path; here it runs on Node |
| Email — outbound | **Postfix** container *or* external SMTP relay | Pure self-hosted SMTP is *very* hard for deliverability — PTR, DKIM, SPF, DMARC, dedicated IP, warming. Realistic answer: still use a relay |
| Email — inbound | **Mailcow** or **Postfix + Dovecot** | Real undertaking. ~2–3 days to stand up, ongoing spam/security maintenance |
| Payments | **Stripe** | No change |

**Total vendors:** Stripe + (likely) SMTP relay. Technically the same count as today, but the operational surface area is much larger.

**Effort:** 8–16 focused weeks. The Firestore → Postgres rewrite is comparable to Path A's D1 work, *plus* standing up Postfix, Postgres backups, MinIO, the Coolify app, monitoring, the deploy pipeline. Much of this exists for veritablegames but isn't free to set up again.

**Governance fit:** Maximum sovereignty in theory. In practice, Freeman's warning applies — whoever holds SSH keys to the box holds informal veto power. Mitigations exist (rotating sysadmin role, runbooks, two-person key custody), but they're real governance work the co-op has to actually do. Without that work, you've recreated a hierarchy with a sysadmin at the top.

---

## Side-by-side decision matrix

| Dimension | Path A (Cloudflare) | Path B (Self-hosted) |
|---|---|---|
| Migration effort | 4–8 weeks | 8–16 weeks |
| Ongoing ops labor | Low (rent) | High (own) |
| Monthly cost | ~$30–60 + email | Hardware + power + relay; near-zero marginal |
| Vendor count | 3–4 | 2 |
| SPOF | Cloudflare's terms of service | Whoever holds SSH keys |
| Ownership-transfer in 5 years | Billing handoff (~1 hour) | Physical/replicated server migration, re-key, re-cert, runbook handoff (~weeks) |
| Deplatform risk | Real but rare; mitigated by data portability | None |
| Email deliverability | Resend handles it | Months-long fight if self-SMTP, or just use a relay anyway |
| Aligns with syllabus framing | "Library socialism" (Doctorow) | "Own the means" (Kropotkin/Bookchin) |
| Tyranny-of-Structurelessness exposure | Low — labor stays bounded | High — sysadmin role concentrates power unless actively rotated |

---

## Recommendation

**Path A**, for three reasons grounded in the syllabus:

1. **Library socialism, not landlordism.** The syllabus is explicit that the practice is what's owned in common, not the infrastructure. Renting Cloudflare is no more compromising than renting the building — and no one would argue RDS has to *own* the building to be a co-op.
2. **Transferability is a governance asset.** A horizontal co-op that depends on one member's sysadmin labor has built a hierarchy. Path A's "billing handoff in an hour" is more horizontal *in practice* than Path B's "whoever knows the server."
3. **Email is the actual hard line.** Inbound/outbound email is the one Firebase replacement worth doing regardless of path. The relay choice (Resend, Postmark, SES) is the same in both paths. Self-hosting SMTP is a months-long deliverability project almost no one wins.

**Caveat:** the recommendation depends on keeping Path A's data layer portable so it can become Path B under duress. That means: stick to SQLite-compatible queries on D1, keep R2 buckets rsync-able, prefer open-source auth (better-auth) over closed-source (Clerk). The hedge is what makes the recommendation honest.

---

## What this does *not* answer

- **Whether to do this at all.** The Firebase status quo works. Migrating is a values-driven choice, not a technical necessity.
- **Whether to do it now.** Path A is 4–8 weeks of focused work. That work competes with everything else the co-op wants to build.
- **Whether veritablegames.com should move too.** Out of scope for this doc; the architectures could diverge cleanly.
- **The specific D1 schema.** That's a follow-on design doc once the path is chosen — Firestore's document model has to be deliberately translated to SQL, and some patterns (deeply nested fields, array-contains queries) require schema work, not direct translation.
- **The realtime sync protocol details.** Durable Objects + WebSockets pattern is well-documented but app-specific; the existing `subscribeToX` API in `src/lib/storage/` should stay stable so callers don't change, but the implementation underneath is a real design exercise.

## Sequencing

1. **Now:** finish [MIGRATION.md](../MIGRATION.md) — Cloudflare Pages cutover. Same first step regardless of which post-Firebase path is eventually chosen.
2. **After cutover, decide:** Path A, Path B, or status quo. Not urgent.
3. **If chosen:** spin out a per-domain implementation doc (`docs/POST_FIREBASE_AUTH.md`, `docs/POST_FIREBASE_REALTIME.md`, etc.) before touching code. The realtime layer in particular needs a written design before implementation.
