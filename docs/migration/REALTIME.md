# Realtime Sync Design

How Firestore's `onSnapshot` model translates to Cloudflare. This is the doc that determines whether the migration is "translate the storage layer" (manageable) or "rewrite the UI" (not manageable). The answer is the former — *only* if the subscription API contract is preserved.

---

## The contract that must not change

Every `src/lib/storage/*.ts` module exports a `subscribeToX(callback) => unsubscribe` function. The 14 durable subscriptions plus 1 ephemeral are listed in `INVENTORY.md`. The contract is:

```ts
// What every subscribeToX must continue to look like, post-migration:
function subscribeToCanvas(
  callback: (blocks: CanvasBlock[]) => void
): () => void
```

- Calling subscribes; returns an unsubscribe function.
- Callback fires **immediately** with current snapshot.
- Callback fires again on **every change** (insert/update/delete on any matching row).
- Callback receives the **full current state**, not deltas (matches Firestore's snapshot semantics).
- Unsubscribe stops future callbacks and releases any underlying connection.

**If this contract holds, no React Context, no hook, no component changes.** The migration becomes a `src/lib/storage/*.ts` internals swap. That is the foundation everything else depends on.

---

## The architecture

```
┌─────────────────┐   WebSocket    ┌──────────────────────┐
│  Browser tab    │ ◄────────────► │ Durable Object       │
│  (subscribeToX) │                │ (one per collection)  │
└─────────────────┘                └──────────────────────┘
                                              │
                                              │ reads/writes
                                              ▼
                                   ┌──────────────────────┐
                                   │  D1 (SQLite)         │
                                   └──────────────────────┘
                                              ▲
                                              │ writes
                                              │
┌─────────────────┐    HTTPS       ┌──────────────────────┐
│  Browser tab    │ ──────────────►│ Worker (write API)   │
│  (mutate)       │                │ POST /api/blocks etc.│
└─────────────────┘                └──────────────────────┘
                                              │
                                              │ notify
                                              ▼
                                   ┌──────────────────────┐
                                   │ Durable Object       │
                                   │ (broadcasts to subs) │
                                   └──────────────────────┘
```

**Reads (subscription side):**
1. Client opens WebSocket to a Worker route like `wss://renodevspace.org/api/subscribe/canvas`.
2. Worker forwards to a named Durable Object (`env.CANVAS_DO.get(env.CANVAS_DO.idFromName("singleton"))`).
3. DO accepts the WS, reads current D1 state, sends a `snapshot` message to the new client.
4. DO holds the WS open. Adds it to its in-memory broadcast list.
5. On any write that affects this collection, the DO re-reads D1 and broadcasts the new snapshot to all subscribers.

**Writes (mutation side):**
1. Client POSTs to a normal Worker route like `POST /api/blocks/:id/vote`.
2. Worker validates auth (better-auth session), executes D1 transaction.
3. Worker tells the relevant DO "you changed" via `env.CANVAS_DO.get(...).fetch(internalNotifyURL)`.
4. DO re-reads D1, broadcasts new snapshot.

Writes do not go through DOs. DOs are read-side broadcast only. This separation matters because writes are durable and infrequent; subscriptions are long-lived and many.

---

## Topology: per-collection DOs

**Recommendation: one DO per Firestore collection.** 15 DOs total (one per subscription target). Each DO holds:
- The WebSocket list for that collection's subscribers
- Optionally: a cached snapshot to avoid re-querying D1 on every change

### Why per-collection (vs single global vs per-document)

| Topology | Pros | Cons |
|---|---|---|
| **Per-collection (15 DOs)** | Natural boundary; each DO owns one subscription type; writes only fan out within scope | 15 DO classes to maintain |
| Single global DO | Simplest code | All writes serialize through one object; throughput cliff under load |
| Per-document | Maximum parallelism | DOs are expensive to spin up per-block; tiny DOs make broadcasting "all blocks changed" awkward |

Per-collection is the Goldilocks zone. Coherent with how `INVENTORY.md` already groups things (one storage module per collection).

### Exception: presence is a special DO, not D1-backed

`subscribeToPresence` is the lone ephemeral subscription (30s TTL on cursor positions). Storing presence in D1 is wrong on two counts:
1. **D1 row reads burn quota** on data that's worthless after 30 seconds.
2. **Writes are high-frequency** — cursors move at 60 Hz; that's 60 writes/sec per active user.

Better: presence DO holds the entire presence map in **DO in-memory state**, never persists. New writes update memory + broadcast. Old entries time out via DO alarms. D1 doesn't see presence data at all.

This is the one place the schema (`SCHEMA.md`) and realtime design diverge — the `presence` table proposed there is included for completeness but should be dropped before implementation.

---

## Snapshot vs delta

Firestore's `onSnapshot` delivers the full set on every change. Our DO should too — keeps the client side identical to today.

**On client subscribe:**
```ts
ws.send({ type: 'subscribe', collection: 'canvas' });
// Server replies:
ws.recv({ type: 'snapshot', data: [...all blocks...] });
```

**On any write:**
```ts
// All connected clients receive:
ws.recv({ type: 'snapshot', data: [...new state of all blocks...] });
```

For collections with windows (e.g. `chatMessages` last 100), the snapshot is the window. For filtered subscriptions (`subscribeToBlockEdits(blockId)`), the DO route includes the filter param and the snapshot is filtered.

**Future optimization (not v1):** delta messages with `{ type: 'change', op: 'insert'|'update'|'delete', row }`. Keeps payloads small under high churn. v1 stays full-snapshot for simplicity — payloads are small in practice (15-collection, average a few hundred rows each).

---

## Per-subscription routing table

Maps the existing 15 subscriptions to DO + route. Used as the contract for `FUNCTIONS.md` (Worker routing).

| Subscription | DO class | Worker route | Filter params |
|---|---|---|---|
| `subscribeToCanvas` | `CanvasDO` | `/api/subscribe/canvas` | none |
| `subscribeToChat` | `ChatDO` | `/api/subscribe/chat` | none (windowed 100) |
| `subscribeToPresence` | `PresenceDO` | `/api/subscribe/presence` | `excludeUserId` |
| `subscribeToProperties` | `PropertyDO` | `/api/subscribe/properties` | none |
| `subscribeToGalleryPosition` | `SettingsDO` | `/api/subscribe/settings/propertyGallery` | `key=propertyGallery` |
| `subscribeToCampaignSettings` | `SettingsDO` | `/api/subscribe/settings/campaign` | `key=campaign` |
| `subscribeToPledges` | `PledgeDO` | `/api/subscribe/pledges` | none |
| `subscribeToContent` | `ContentDO` | `/api/subscribe/content` | none |
| `subscribeToUsers` | `UserDO` | `/api/subscribe/users` | none |
| `subscribeToAdmins` | `AdminDO` | `/api/subscribe/admins` | none |
| `subscribeToBannedEmails` | `BansDO` | `/api/subscribe/bannedEmails` | none |
| `subscribeToEmailTemplates` | `EmailTemplateDO` | `/api/subscribe/emailTemplates` | none |
| `subscribeToEmailHistory` | `EmailHistoryDO` | `/api/subscribe/emailHistory` | `limit` |
| `subscribeToDeletions` | `DeletionDO` | `/api/subscribe/deletions` | none |
| `subscribeToBlockEdits` | `EditHistoryDO` | `/api/subscribe/blockEdits/:blockId` | `blockId` |

`SettingsDO` and `EditHistoryDO` are reused with different filter params — same DO class, multiple DO instances. Cloudflare DOs are name-addressable; `env.SETTINGS_DO.get(env.SETTINGS_DO.idFromName("campaign"))` returns a different DO than `idFromName("propertyGallery")`. Cheap; doesn't multiply ops cost.

---

## Client-side: rewriting `src/lib/storage/canvasStorage.ts:subscribeToCanvas`

Worked example showing the swap stays purely internal:

```ts
// BEFORE (current — Firestore):
export function subscribeToCanvas(callback: (blocks: CanvasBlock[]) => void): () => void {
  const q = query(collection(db, 'canvasBlocks'), orderBy('zIndex', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CanvasBlock)));
  });
}

// AFTER (new — Worker + DO via WebSocket):
export function subscribeToCanvas(callback: (blocks: CanvasBlock[]) => void): () => void {
  const ws = openSubscriptionSocket('/api/subscribe/canvas');
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'snapshot') callback(msg.data);
  };
  return () => ws.close();
}
```

`openSubscriptionSocket()` is a shared helper that handles:
- WebSocket URL construction with auth cookie
- Auto-reconnect on disconnect (exponential backoff, max 30s)
- Heartbeat ping every 30s
- Resubscribe message on reconnect

That helper is the only new generic piece. The 15 subscribe functions become thin wrappers around it.

**No React, Context, hook, or component changes.** The contract holds.

---

## Failure modes & their handling

| Failure | Behavior |
|---|---|
| DO crashes mid-broadcast | DO restarts on next request; in-flight subscribers reconnect via auto-reconnect; receive fresh snapshot |
| Client disconnects (tab close) | DO drops dead WS from list on next broadcast attempt; subscriber list cleans up lazily |
| Client briefly offline | Auto-reconnect with exponential backoff; on reconnect, server sends fresh snapshot; UI catches up |
| D1 write succeeds but DO notify fails | **Eventual consistency hole.** Subscriber sees stale data until next write or page refresh. Mitigation: periodic snapshot refresh from each DO (every 60s, even with no writes). Acceptable for v1; documented limitation. |
| Two clients write at exactly the same instant | Both writes hit D1 in transaction order; both DO notifications fire; both broadcasts go out; both clients see the final state. No conflict — D1 serializes |
| Worker request limit hit | DOs continue serving existing WebSockets; new subscribers error; users see "reconnecting…" until quota resets. Hard fail visible to users. Cost: $5/mo Workers Paid raises ceiling 100×. |

---

## The hard parts (flagged, not solved)

These are decisions deferred to implementation, but called out so the user knows what's coming:

1. **Auth on WebSockets.** Cookies work on WS handshake. better-auth session cookie carries through; the Worker reads it on `wss` upgrade. But: WebSockets bypass CSRF protection (no preflight). Mitigation: read-only WebSockets (subscriptions); all writes go through normal HTTPS routes with CSRF tokens. The design above already does this — confirming the security model.
2. **Subscription scoping.** `subscribeToBlockEdits(blockId)` is per-block, which means one DO instance per block being viewed. Cheap (DOs hibernate when idle), but worth confirming we're OK with that DO multiplication.
3. **Backpressure.** If a DO accumulates many subscribers (100+) and a vote burst arrives (10/sec), each vote triggers a re-broadcast. That's 100 × 10 = 1000 messages/sec from one DO. Within DO capacity but worth measuring under load. Mitigation: rate-limit broadcasts to max 4 Hz; coalesce intermediate state.
4. **Initial-snapshot latency.** Firestore's `onSnapshot` is sub-100ms for the first delivery. Our pipeline is: WS connect → Worker → DO → D1 query → broadcast. Likely 100–300ms cold. Probably fine; benchmark before declaring victory.

---

## What this doc says to other docs

- **`SCHEMA.md`**: Drop the `presence` table — that data never hits D1.
- **`FUNCTIONS.md`**: Owns the Worker routes (`/api/subscribe/*`, `/api/blocks/*`, etc.) and DO bindings in `wrangler.jsonc`.
- **`AUTH.md`**: Session cookie must survive the WS upgrade — verify better-auth supports this (it does, but flag).
- **`CUTOVER.md`**: Plan for the dual-write window where both Firestore subscriptions and D1+DO subscriptions are live simultaneously, feature-flagged per page.
