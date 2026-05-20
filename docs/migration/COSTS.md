# Cost & Limits Analysis

Honest comparison of Firebase free-tier cliffs vs Cloudflare equivalents. Validates (or invalidates) the migration's stated motivation: *"don't want to rely on a limited service that would charge you after a time."*

**TL;DR:** Cloudflare's free-tier cliffs are *higher* than Firebase's for the storage/data dimensions, but Cloudflare has one new floor Firebase doesn't: **Durable Objects require the Workers Paid plan ($5/mo)**. If we use DOs for realtime (the recommended approach in `REALTIME.md`), the migration converts "free until you hit a Firestore cliff" into "$5/mo flat, then much higher cliffs." That is the trade — not "free forever," but "predictable floor + much more headroom before the next cliff."

**Sources:** all figures from public pricing pages, dated 2026-05-20.
- Firebase Spark plan: <https://firebase.google.com/pricing>
- Cloudflare Workers/Pages: <https://developers.cloudflare.com/workers/platform/pricing/>
- Cloudflare D1: <https://developers.cloudflare.com/d1/platform/pricing/>
- Cloudflare R2: <https://developers.cloudflare.com/r2/pricing/>
- Resend: <https://resend.com/pricing>

If any figure here drifts from the linked source, the source wins; this doc updates.

---

## Current usage (observed)

The site is freshly migrated to `renodevspace.org` and pre-launch. Real metrics are nearly zero — most of this section is projection. The honest numbers are still useful because the migration question isn't "what do we use today" but "where are the cliffs we'd hit *first* under success."

Best available observation points:
- Firebase Console → Firestore → Usage tab (reads/writes/deletes per day)
- Firebase Console → Functions → Usage tab (invocations, GB-seconds)
- Firebase Console → Storage → Usage tab (bytes stored, bandwidth)
- Cloudflare Pages dashboard → Analytics (requests, bandwidth)

The user should pull a snapshot of these before migration so we have a real baseline. Until then: this doc reasons from "low single-digit hundreds of MAU and a few hundred canvas blocks" as the working assumption.

---

## Firebase free tier ("Spark plan")

Cliffs are **per-day** for most usage — a single bad day pushes you to billing.

| Resource | Free quota | Cliff trigger |
|---|---|---|
| **Firestore reads** | 50,000 / day | Realistic: every visitor hits ~15 subscriptions on page load. 100 visitors × 30 docs/page = 3,000 reads. Live subscription updates add more. 50K/day = ~1,500 daily visitors before forced upgrade. |
| **Firestore writes** | 20,000 / day | Vote-heavy day, chat-active community, canvas edits during a workshop: easy to hit. Each vote = 1 write. |
| **Firestore deletes** | 20,000 / day | Rare; mostly cascade-delete on user removal. |
| **Firestore storage** | 1 GiB | Hundreds of thousands of canvas blocks before this matters. |
| **Auth users** | Unlimited | No cliff. |
| **Storage stored** | 5 GB | Property images at ~1 MB each = 5,000 images. Many years of headroom. |
| **Storage downloads** | 1 GB / day | At 200 KB/image average, 5,000 image-views per day. Plausible to hit during a campaign push. |
| **Storage uploads** | 20,000 / day | Not a concern. |
| **Functions invocations** | 125,000 / month | `sendVerificationEmail` fires once per signup, Stripe webhook ~once per donation, admin email sends ~once per campaign event. Comfortably under cap unless something runs in a loop. |
| **Functions GB-seconds** | 40,000 / month | Email functions are short-lived; cap is fine. |
| **Functions egress** | 5 GB / month | Email payloads + Stripe API calls; fine. |
| **Hosting transfer** | 360 MB / day | **Not used** — GitHub Pages → Cloudflare Pages handle this now. |

### First cliff under organic growth

Almost certainly **Firestore reads at 50K/day** — because every page load fans out across 14 durable subscriptions, each of which delivers initial snapshot + every incremental update. Rough math:

- Each pageview ≈ 30–50 initial reads (1 per doc across active collections)
- Each minute of presence on page ≈ 5–10 update events from other users
- A community-active day ≈ 50–200 simultaneous viewers ≈ 50K reads/hour during peak

A 100-MAU site running an open canvas with 10–20 visible at once can plausibly hit the daily cap on a high-engagement day. **This is the cliff that motivates the migration.**

### Beyond the cliff: Blaze plan (pay-as-you-go)

- Firestore reads: $0.06 per 100K beyond free tier
- Storage: $0.026/GB/month + $0.12/GB downloaded
- Functions: $0.40 per million invocations + compute time
- No fixed monthly cost — purely metered. Realistic monthly bill at 5–10× current scale: **$5–30/mo**, mostly Firestore reads.

That's not catastrophic. The migration concern is less "the bill" and more **lock-in to a metered Google product whose pricing they can change unilaterally**, plus the implicit data-portability cost (Firestore's export format is Google-specific protobuf, not standard SQL).

---

## Cloudflare free tiers

Cliffs are mostly **per-day** or **per-month**, with different shapes:

| Resource | Free quota | Cliff trigger |
|---|---|---|
| **Pages requests** | Unlimited | No cliff. |
| **Pages builds** | 500 / month | At one push-to-deploy per commit, 500 commits/mo would be active development. Fine. |
| **Pages bandwidth** | Unlimited | No cliff (huge advantage over Firebase Hosting's 360 MB/day). |
| **Workers requests** | 100,000 / day | Each subscribed connection counts as recurring requests if polled. WebSocket connections to DOs aren't "requests" — see DO line. |
| **Workers CPU time** | 10 ms / request | Most app logic fits; complex queries might exceed. Worker can fan out to DOs/D1 cheaply. |
| **D1 storage** | 5 GB total | Same shape as Firestore's 1 GiB but 5× headroom. |
| **D1 rows read** | 5,000,000 / day | **100× Firebase's read cliff.** Effectively a non-issue at current+10× scale. |
| **D1 rows written** | 100,000 / day | 5× Firebase's write cliff. Plenty. |
| **R2 storage** | 10 GB-month | 2× Firebase's 5 GB. |
| **R2 Class A ops (writes)** | 1,000,000 / month | Property image uploads use these. Effectively unlimited at current scale. |
| **R2 Class B ops (reads)** | 10,000,000 / month | Image downloads. Effectively unlimited. |
| **R2 egress** | **Free, always** | **Major advantage over Firebase Storage's 1 GB/day.** |
| **Durable Objects** | ⚠ **Not available on free tier** | Requires Workers Paid plan. |
| **Email Routing rules** | Unlimited | Inbound email forwarding free. |
| **Email Workers** | (counts as Workers requests) | Programmatic inbound handling. |

### The Durable Objects cliff is a floor, not a ceiling

DOs are what holds WebSocket connections for realtime sync (see `REALTIME.md`). They're the **only** Cloudflare primitive that's not on the free tier — using them forces you to **Workers Paid: $5/month**. That plan also bumps Workers requests to 10M/month and includes 30M CPU-ms.

This is the meaningful trade: **migrating to Cloudflare with realtime means starting at $5/month flat**, not free. In exchange, the next cliff is *much* further away (10M Worker requests/mo, 5M D1 reads/day, free R2 egress).

### Alternatives that stay on free tier

If $5/mo is unacceptable, two options exist but with real trade-offs:

1. **Skip Durable Objects.** Use polling instead of WebSockets. Each tab polls every N seconds. This is what early-2010s realtime apps did. It works but feels worse — typical latency goes from <100ms to several seconds, and Worker requests rise sharply (a 100-visitor site polling every 5s = 1.7M requests/day, blowing through the 100K/day free Worker quota by 17×).
2. **Skip Cloudflare for realtime, use a third-party.** PartyKit (built on DOs, hosts them for you, has its own free tier of 5K connections), Supabase (Postgres + realtime built-in), Liveblocks (purpose-built for collab). Each adds a vendor — back to the lock-in argument.

**Recommended:** accept the $5/mo Workers Paid floor. It's an order of magnitude less than Firebase Blaze would be at the same scale, predictable, and removes the cognitive overhead of "are we about to spike past free tier."

---

## Resend (transactional email)

Cloudflare has Email Routing for *inbound* but cannot *send* email. Resend is the recommended outbound provider per `POST_FIREBASE.md`.

| Resource | Free tier | Cliff |
|---|---|---|
| Emails/day | 100 | A campaign-update blast to 200 backers hits this in one send. |
| Emails/month | 3,000 | 30 sends of 100 backers each, or one send of 3,000. |
| Custom domain | 1 | Fine. |

**Realistic projection:** signup verifications + campaign updates are the volume. At 50 signups/month + 1 campaign-update send/month to ~200 pledgers = ~250 emails. Well under cap.

**Beyond cap:** Pro plan $20/mo gives 50,000/mo. Compares favorably to running your own SMTP and fighting deliverability (DKIM/SPF/dedicated IP/warming would take weeks and still risk gmail-folder hell). Resend was the right call for the deliverability reason; the cost is a side effect.

---

## Side-by-side: first cliff under projected 10× growth

Assumption: site grows to ~1,000 MAU, ~200 daily-active users, 20 canvas blocks added/week, 3 property listings, ~500 chat messages/day, ~50 votes/day, 1 admin email send/month, 50 signups/month.

| Subsystem | Firebase free cliff hit at projected scale? | Cloudflare free cliff hit? |
|---|---|---|
| Database reads | **Yes** — 200 DAU × ~50 reads/visit + live updates ≈ 50K–150K/day | No — 5M/day cap is 30–100× the actual load |
| Database writes | Borderline — ~50–500 writes/day, cap is 20K | No — cap is 100K/day |
| Storage stored | No (3 property images) | No |
| Storage bandwidth | Possibly — 200 DAU × 3 images × 200 KB = 120 MB/day, cap is 1 GB/day, fine | No — egress is free on R2 |
| Auth | No | N/A (using better-auth on Workers) |
| Functions | No | No (Worker requests bump to 10M/mo on Paid) |
| Realtime (WebSockets) | N/A — Firestore handles | **Yes — requires Paid plan ($5/mo)** |
| Email | Bordering on Resend cap if campaigns ramp up | (Same — Resend's cap, not Cloudflare's) |

**Conclusion:** at projected scale, Firebase forces a Blaze upgrade for database reads. Cloudflare forces a Workers Paid upgrade for Durable Objects. Both cost money; the Cloudflare floor is **lower, fixed, and predictable** ($5/mo vs metered Blaze that grows with usage).

---

## The honest summary

| Dimension | Firebase | Cloudflare |
|---|---|---|
| Floor under success | Forced into Blaze metered billing at ~1,500 DAU | $5/mo Workers Paid the day you use DOs |
| Realtime/WebSocket cost | "Free" under Spark cap, then metered | $5/mo fixed |
| Bandwidth cost | $0.12/GB | Free (R2 egress) |
| Database read cost beyond free | $0.06/100K | $0.001/1M (on Paid plan) — 60× cheaper per read |
| Data portability | Firestore-specific export format | SQLite (D1) and S3 protocol (R2) — open standards |
| Vendor count after migration | Google + Stripe (current) | Cloudflare + Stripe + Resend (3 vs 2) |
| Predictability of monthly bill | Variable — depends on traffic | Predictable — `$5 + Resend ($0–20)` for years |

**The migration doesn't make costs zero.** It replaces "free → cliff → metered billing" with "$5/mo floor → much higher ceiling." For a non-profit that needs predictable financials and resistance to vendor pricing changes, that trade favors Cloudflare. For a project that's genuinely staying under Firebase's free tier indefinitely, this migration adds cost without benefit.

The user's stated motivation — *"don't want to rely on a limited service that would charge you after a time"* — is validated, with one nuance: **Cloudflare also charges, just predictably and starting earlier**. The migration buys *predictability and portability*, not *free*.

---

## Decision implications for the rest of the migration

1. **`REALTIME.md` should assume Workers Paid ($5/mo) is acceptable.** Designing around polling-only to stay on free tier degrades UX badly and is not worth the savings.
2. **`SCHEMA.md` should optimize for read efficiency** anyway — D1 reads are very cheap but the Worker CPU time to process them is the bound. Reduce N+1 query patterns.
3. **`STORAGE.md` can freely use R2 egress** without rate concerns. No CDN-cost optimization needed.
4. **`EMAIL.md` should size Resend usage** — if campaign emails will routinely exceed 100/day, plan for Resend Pro ($20/mo). Otherwise free tier is fine for years.
5. **Treat the $5/mo Workers Paid as a fixed line item** in the co-op's finances doc (per syllabus governance norm: list infrastructure costs openly).
