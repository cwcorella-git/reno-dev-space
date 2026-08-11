# Federation Research Brief

**Status:** Research only. Nothing here is committed to or scheduled.
**Date:** 2026-08-11
**Question that prompted it:** Can Reno Dev Space federate, using only GitHub + Cloudflare?

**Short answer:** Yes. The Cloudflare migration already scaffolds the one thing federation
requires and GitHub Pages cannot provide — an origin that accepts authenticated inbound
POSTs. Federation is additive to that work, not a competing direction.

---

## 1. What prompted this: federated.works

[federated.works](https://federated.works/page/collaboration/home) is **a Hubzilla instance**,
not a guide. The page we looked at is a Hubzilla "webpage" object inside a channel named
`collaboration`. Nav (`/directory`, `/channel/…`, `/siteinfo`, `/rmagic`), bug tracker
(`framagit.org/hubzilla/core`), and sister sites `federatedhub.org` (docs) + `neuhub.org`
(themes/addons) are all stock.

Its stated mission — *"build your own website, community, and audience without giving up
control,"* federated tools for communications, privacy, and e-commerce — is close to our own
framing. Useful as a **reference implementation to study**, not as a dependency to adopt.

---

## 2. The protocol landscape

| Protocol | Who speaks it | Why we'd care |
|---|---|---|
| **ActivityPub** (W3C, 2018) | Mastodon, Lemmy, PeerTube, Ghost, WordPress, Misskey, Pixelfed | The only one with a real network. Anything else is talking to an empty room. |
| **Zot / Nomad** | Hubzilla, Streams | Nomadic identity (see below). Tiny network. |
| **ATProto** | Bluesky | Bigger single audience, but effectively one company's infrastructure — cuts against "stop relying on third parties." |
| **Nostr** | Nostr clients | Relay-based, key-centric. Different social model; no group/community primitive that fits us. |

### Nomadic identity — the idea worth stealing

Hubzilla's genuine innovation. A channel lives on **multiple hubs simultaneously** as live
bidirectional clones, not a forwarding address. If a hub dies, the identity, posts, and
followers survive on the others.

ActivityPub's equivalent (the `Move` activity) is weaker: it migrates *followers* but not
*posts*, and leaves a dead account behind. Mike Macgirvin has since implemented nomadic
identity **over** ActivityPub with extensions (Forte), so the two aren't permanently
exclusive — but nothing mainstream supports it yet.

**Takeaway:** don't adopt Zot. Do let nomadic identity inform the data model — if member
identity is portable *in our schema*, we keep the option open.

---

## 3. How federation actually works

Five moving parts. Genuinely smaller than the ecosystem makes it look.

### 3.1 WebFinger — discovery

Maps a handle to an actor URL. Mastodon requires it; not optional in practice.

```
GET /.well-known/webfinger?resource=acct:renodevspace@renodevspace.org
→ { "subject": "acct:...", "links": [
     { "rel": "self", "type": "application/activity+json",
       "href": "https://renodevspace.org/ap/actor" } ] }
```

### 3.2 Actor — identity document

JSON-LD served as `application/activity+json`. Required fields: `id`, `inbox`, `outbox`,
`type`. Should have: `followers`, `following`, `publicKey`.

Types that matter to us: `Service` or `Group` (the space itself), `Person` (a member).

### 3.3 Inbox — inbound

`POST /ap/inbox`, from remote servers only. Minimum activity handling:

| Activity | Must do |
|---|---|
| `Follow` | Record follower **and reply with `Accept`** — skip this and nobody ever receives our posts |
| `Undo` | Reverse a prior Follow/Like/Announce |
| `Create` | Inbound post (only if we accept inbound content) |
| `Delete` | Remove or replace with a `Tombstone` |
| `Update` | Full replacement; must originate from the object's own server |
| `Announce` | Boost |

Reject unauthorized senders with `403`. Deduplicate by activity `id`.

### 3.4 Outbox / delivery — outbound

On publish: resolve each follower's inbox URL, POST the activity to each.
**Must be async with retry + backoff** — one slow remote server must not block a request.

Addressing: `to` / `cc`, with the magic value
`https://www.w3.org/ns/activitystreams#Public` for public posts, plus the followers
collection URL. Strip `bto`/`bcc` before delivery.

### 3.5 HTTP Signatures — trust

`rsa-sha256`, draft-cavage. Sign every outbound request; verify every inbound one.
Non-negotiable — Mastodon drops unsigned traffic. Requires a **durable RSA keypair per
actor**, persisted across deploys.

---

## 4. Mapping onto our stack

The workable pattern for a mostly-static site is **hybrid**: keep pages prerendered, put
`/ap/*` and `/.well-known/*` on a server.

```
GitHub Pages / CF Pages   →  static site (unchanged)
Cloudflare Worker         →  /.well-known/webfinger, /ap/actor, /ap/inbox, /ap/outbox
Cloudflare D1             →  actor keypairs, followers, activity log
Cloudflare Queues         →  delivery fan-out with retry
```

This is exactly the shape of `workers/` on `feat/cloudflare-migration`.

### Prior art

- **[Fedify](https://fedify.dev/manual/deploy)** — the mature library. `@fedify/cfworkers`
  ships `WorkersKvStore` + `WorkersMessageQueue`.
- **[minidon](https://github.com/yusukebe/minidon)** — single-actor ActivityPub on
  Workers + D1. Small enough to read end to end.
- **[Wildebeest](https://github.com/cloudflare/wildebeest)** — Cloudflare's full
  Mastodon-compatible server on their own stack. **Archived — do not deploy.** Valuable
  only as a worked example of modeling all of this in Workers + D1.
- **[Hong Minhee's fedified static blog](https://writings.hongminhee.org/2026/07/fedified-blog/index.en.html)**
  — static generator + serverless functions, keys and followers in a DB, queue for
  delivery, deploy-time diff emitting `Create`/`Update`/`Delete`. Closest analogue to us.

### Cloudflare-specific gotchas

1. **`nodejs_compat` flag required** — Fedify needs Node crypto/DNS APIs.
2. **Cannot build `Federation` at module load** — bindings only exist per-request; use
   `createFederationBuilder()` and build inside `fetch()`.
3. **Keypairs go in D1, not KV** — must survive deploys durably.
4. **WAF will eat federation traffic.** Cloudflare's default Bot Protection flags
   fediverse user agents. Add a skip rule for `application/activity+json`. This is the
   single most likely silent-failure mode on our stack.
5. **Worker CPU/request limits** — never deliver synchronously; queue it.

---

## 5. Three different products, not one decision

"Federate the site" means at least three separable things with very different costs:

### Tier 1 — Broadcast only
One `Service` actor for `renodevspace.org`. Campaign updates and accepted canvas blocks
become followable from Mastodon. No inbound content.
Needs: webfinger + actor + inbox handling only `Follow`/`Undo` + signed delivery.
Moderation burden: near zero. **Smallest viable federation.**

### Tier 2 — Members as actors
Every member gets `@name@renodevspace.org` — followable, portable, theirs.
Needs: per-user keypairs, per-user inboxes/outboxes, profile→actor mapping.
Moderation burden: real. We become responsible for what our users send outward.

### Tier 3 — Federated commons
Canvas/chat as a `Group` remote users can post *into*.
Moderation burden: high — inbound spam is a solved problem for nobody.
Least certain payoff for a small local co-op.

---

## 6. The only decision that's actually urgent

Federation needs two things our **Firestore → D1 schema** decides:

1. **Stable, permanent content URIs.** A federated object's `id` can never change. If
   canvas block IDs are regenerated during migration, previously federated content breaks
   permanently.
2. **Durable actor keys.** A place to put an RSA keypair per federating entity.

`workers/src/db/schema.ts` is **written but not yet applied to a live D1**. Adding
`actor_id`, `public_key`, `private_key`, and a `followers` table now costs almost nothing.
Adding them to a live, populated D1 later costs a migration and a data backfill.

**Recommendation:** even under "no commitment," reserve that schema space during the
migration. It's cheap insurance on an option we may never exercise.

---

## 7. Open questions

- Is there an actual audience? Federation is only worth it if Reno-area devs (or the
  broader indie scene) are reachable on the fediverse. Worth asking before building.
- Does federating dilute the canvas? The site's value is a *shared local space*.
  Broadcasting out (Tier 1) reinforces that; opening it up (Tier 3) might not.
- Moderation capacity. Tier 2+ makes us an instance admin. That's an ongoing volunteer
  commitment, not a one-time build.
- Interaction with the voting system. Do remote `Like`s count as upvotes? If yes, the
  brightness mechanic becomes brigadable by strangers.

---

## References

- [ActivityPub — W3C Recommendation](https://www.w3.org/TR/activitypub/)
- [WebFinger — Mastodon docs](https://docs.joinmastodon.org/spec/webfinger/)
- [Fedify — deployment manual](https://fedify.dev/manual/deploy)
- [Nomadic identity — Join the Fediverse](https://joinfediverse.wiki/Nomadic_identity)
- [Zot, Nomad, and Nomadic Identity](https://opennomad.net/)
- [Hubzilla](https://joinfediverse.wiki/Hubzilla)
- [Welcome to Wildebeest — Cloudflare blog](https://blog.cloudflare.com/welcome-to-wildebeest-the-fediverse-on-cloudflare/)
