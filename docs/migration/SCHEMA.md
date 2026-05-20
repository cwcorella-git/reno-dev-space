# D1 Schema Design

Target SQL schema for Cloudflare D1 (SQLite). This doc maps every Firestore collection from `INVENTORY.md` to a concrete table definition, with explicit handling of the array-mutation voting redesign that's the migration's single architectural change.

**Verification standard for this doc:** every `CREATE TABLE` statement here must execute cleanly against `wrangler d1 execute --local`. If it doesn't, the doc is wrong.

---

## Design choices made up-front

These choices apply globally. Flagged here so the rest of the doc reads consistently and so the user can push back on any one without re-reading every table.

1. **IDs are TEXT, not INTEGER.** Matches Firestore's auto-generated string IDs (`abc123XYZ...`). Enables dual-write during cutover (a row created in Firestore can land in D1 with the *same* ID, no remapping). Once cutover is complete we could migrate to ULIDs for new rows, but the existing IDs stay forever.
2. **Timestamps are INTEGER milliseconds.** Matches the existing `Date.now()` convention across `createdAt` / `updatedAt`. D1 has no native timestamp type; INTEGER is the idiomatic SQLite choice.
3. **Voting is denormalized.** `brightness` lives on the parent row (`canvas_blocks.brightness`, `rental_properties.brightness`). Vote inserts/deletes update brightness in the same transaction. Trade-off: writes do more work, reads are O(1). The alternative — compute `brightness` from `SUM(votes.direction) * 5 + 50` at read time — was rejected because read load dominates (every subscription includes brightness) and adding a JOIN to every read is bad.
4. **Votes use separate tables per target** (`block_votes`, `property_votes`), not a polymorphic single table. Reason: blocks and properties have different lifecycles (delete at 0 vs archive at ≤20), different FK targets, and SQLite has no real polymorphic relations. Two clean FK tables > one polymorphic table with disabled FKs.
5. **Vote direction is INTEGER ±1.** Makes brightness math trivial (`SUM(direction) * 5 + 50`). Readable enough.
6. **Block style is a JSON column.** TextStyle (`fontSize`, `fontWeight`, etc.) is never queried by — only read with the block. JSON column keeps it cohesive; expanding to columns would create 7 fields that always move together.
7. **Reports & dismissed-reporters use join tables** (`block_reports`, `block_dismissed_reporters`, plus property variants). Same reasoning as votes — array fields become join tables.
8. **Legacy `voters[]` field is NOT migrated.** It exists on current data for backward compat with users who voted before the split into `votersUp[]` / `votersDown[]`. During cutover, the import script flattens any legacy `voters[]` entry into `direction=+1` (assumed upvote, matching the original semantic). Documented in `CUTOVER.md`.
9. **Hard FK cascade from content tables to `users.id`.** Per user decision 2026-05-20, no existing data is preserved, so we don't need the soft-delete posture that originally argued against FKs. Add `FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE` to `canvas_blocks`, `rental_properties`, `chat_messages`, `block_votes`, `property_votes`, `block_reports`, `property_reports`. Deleting a user cleans up their content automatically. Stronger right-to-be-forgotten posture, simpler cleanup code (the existing `Promise.all()` cascade loops in `userStorage.ts` collapse to a single `DELETE FROM users WHERE id = ?`).

---

## Tables

Grouped by domain. Each `CREATE TABLE` is paste-ready.

### Users

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,           -- Firebase Auth UID
  email       TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio         TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0, -- 0/1 boolean
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_users_email ON users(email);
```

`email_verified` is denormalized from Auth (in Firebase it lives on the auth user, not the profile). With better-auth replacing Firebase Auth, this becomes a single source of truth.

### Admins & bans (replaces `admins`, `bannedEmails` collections)

```sql
CREATE TABLE admins (
  email      TEXT PRIMARY KEY,           -- doc ID in Firestore = email
  added_by   TEXT,                       -- user_id of promoting admin
  added_at   INTEGER NOT NULL
);

CREATE TABLE banned_emails (
  email      TEXT PRIMARY KEY,
  banned_by  TEXT,
  banned_at  INTEGER NOT NULL,
  reason     TEXT
);
```

Email-as-PK matches current Firestore doc-ID convention. Allows pre-banning addresses that haven't signed up yet — exact current behavior.

### Canvas blocks

```sql
CREATE TABLE canvas_blocks (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL DEFAULT 'text',
  x           REAL NOT NULL,             -- 0-100 percentage
  y           REAL NOT NULL,             -- 0-100+, unbounded for scroll
  width       REAL NOT NULL,
  height      REAL NOT NULL,             -- 0 = auto
  z_index     INTEGER NOT NULL,
  content     TEXT NOT NULL,
  style       TEXT NOT NULL,             -- JSON: TextStyle
  brightness  INTEGER NOT NULL DEFAULT 50, -- 0-100
  created_by  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_blocks_z ON canvas_blocks(z_index);
CREATE INDEX idx_blocks_created_by ON canvas_blocks(created_by);
```

`subscribeToCanvas` does `orderBy('zIndex', 'asc')` — the index supports that.

### Block votes / reports

```sql
CREATE TABLE block_votes (
  block_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  direction  INTEGER NOT NULL,           -- +1 up, -1 down
  voted_at   INTEGER NOT NULL,
  PRIMARY KEY (block_id, user_id),
  FOREIGN KEY (block_id) REFERENCES canvas_blocks(id) ON DELETE CASCADE
);
CREATE INDEX idx_block_votes_user ON block_votes(user_id);

CREATE TABLE block_reports (
  block_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  reported_at INTEGER NOT NULL,
  PRIMARY KEY (block_id, user_id),
  FOREIGN KEY (block_id) REFERENCES canvas_blocks(id) ON DELETE CASCADE
);

CREATE TABLE block_dismissed_reporters (
  block_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  dismissed_at INTEGER NOT NULL,
  PRIMARY KEY (block_id, user_id),
  FOREIGN KEY (block_id) REFERENCES canvas_blocks(id) ON DELETE CASCADE
);
```

Composite PK = one vote per user per block. Same pattern for reports + dismissals.

`ON DELETE CASCADE` removes votes/reports automatically when the block is deleted (replaces explicit cleanup in `userStorage.ts`'s cascade-delete loops).

### Rental properties

```sql
CREATE TABLE rental_properties (
  id                    TEXT PRIMARY KEY,
  image_url             TEXT NOT NULL,
  image_storage_path    TEXT NOT NULL,   -- R2 path: 'properties/{id}/main.jpg'
  address               TEXT NOT NULL,
  cost                  INTEGER,         -- monthly rent in dollars, NULL = "???"
  description           TEXT NOT NULL,
  phone                 TEXT,
  company_name          TEXT,
  brightness            INTEGER NOT NULL DEFAULT 50,
  created_by            TEXT NOT NULL,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
CREATE INDEX idx_properties_created ON rental_properties(created_at DESC);
```

Archived state (brightness ≤ 20) is computed at read/render time — no separate column needed. Matches current behavior.

### Property votes / reports (mirror of block tables)

```sql
CREATE TABLE property_votes (
  property_id TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  direction   INTEGER NOT NULL,
  voted_at    INTEGER NOT NULL,
  PRIMARY KEY (property_id, user_id),
  FOREIGN KEY (property_id) REFERENCES rental_properties(id) ON DELETE CASCADE
);
CREATE INDEX idx_property_votes_user ON property_votes(user_id);

CREATE TABLE property_reports (
  property_id TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  reported_at INTEGER NOT NULL,
  PRIMARY KEY (property_id, user_id),
  FOREIGN KEY (property_id) REFERENCES rental_properties(id) ON DELETE CASCADE
);

CREATE TABLE property_dismissed_reporters (
  property_id  TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  dismissed_at INTEGER NOT NULL,
  PRIMARY KEY (property_id, user_id),
  FOREIGN KEY (property_id) REFERENCES rental_properties(id) ON DELETE CASCADE
);
```

### Chat

```sql
CREATE TABLE chat_messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL,             -- denormalized for display when user is deleted
  content     TEXT NOT NULL,
  timestamp   INTEGER NOT NULL
);
CREATE INDEX idx_chat_timestamp ON chat_messages(timestamp DESC);
```

`subscribeToChat` does `orderBy('timestamp', 'desc') limit(100)`. The index supports this.

The current code retains the last 100; a periodic cleanup job (or trigger) is needed to enforce that. SQLite trigger:

```sql
CREATE TRIGGER chat_window_cap AFTER INSERT ON chat_messages
BEGIN
  DELETE FROM chat_messages
  WHERE id IN (
    SELECT id FROM chat_messages
    ORDER BY timestamp DESC
    LIMIT -1 OFFSET 100
  );
END;
```

### Presence

```sql
CREATE TABLE presence (
  user_id     TEXT PRIMARY KEY,          -- one row per user
  cursor_x    REAL,
  cursor_y    REAL,
  user_name   TEXT,
  user_color  TEXT,
  last_seen   INTEGER NOT NULL
);
CREATE INDEX idx_presence_seen ON presence(last_seen);
```

⚠ **This table may not exist in D1 at all.** Presence is ephemeral, high-frequency, and best held in a Durable Object's in-memory state — not persisted to disk. See `REALTIME.md` for the recommendation to drop the table entirely and use DO state. Included here for completeness in case the realtime design lands differently.

### Pledges & donations

```sql
CREATE TABLE pledges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  amount      INTEGER NOT NULL,          -- dollars
  pledged_at  INTEGER NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_pledges_user ON pledges(user_id);
CREATE INDEX idx_pledges_active ON pledges(is_active);

CREATE TABLE donations (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT,            -- nullable for anonymous donations
  amount                INTEGER NOT NULL,
  stripe_session_id     TEXT NOT NULL UNIQUE,
  stripe_payment_intent TEXT,
  status                TEXT NOT NULL,   -- 'complete' | 'pending' | 'failed'
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
CREATE INDEX idx_donations_user ON donations(user_id);
CREATE INDEX idx_donations_stripe ON donations(stripe_session_id);
```

`donations` is written by the Stripe webhook only — no client writes.

### Site content (CMS)

```sql
CREATE TABLE site_content (
  key         TEXT PRIMARY KEY,          -- e.g. 'intro.hint.title'
  value       TEXT NOT NULL,
  category    TEXT,                      -- e.g. 'intro'
  updated_by  TEXT,
  updated_at  INTEGER NOT NULL
);
```

80+ keys per `CLAUDE.md`. PK is the key; trivial migration.

### Email templates & history

```sql
CREATE TABLE email_templates (
  id          TEXT PRIMARY KEY,          -- e.g. 'verify-email'
  html        TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE email_history (
  id          TEXT PRIMARY KEY,
  template_id TEXT,
  recipients  INTEGER NOT NULL,          -- count, not list
  subject     TEXT NOT NULL,
  sent_by     TEXT NOT NULL,
  sent_at     INTEGER NOT NULL,
  status      TEXT NOT NULL              -- 'success' | 'partial' | 'failed'
);
CREATE INDEX idx_email_history_sent ON email_history(sent_at DESC);
```

### Audit logs (block edits & deletions)

```sql
CREATE TABLE block_edits (
  id          TEXT PRIMARY KEY,
  block_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  old_content TEXT,
  new_content TEXT,
  edited_at   INTEGER NOT NULL
);
CREATE INDEX idx_block_edits_block ON block_edits(block_id, edited_at DESC);

CREATE TABLE deleted_blocks (
  id          TEXT PRIMARY KEY,
  original_id TEXT NOT NULL,             -- the canvas_blocks.id that was deleted
  snapshot    TEXT NOT NULL,             -- JSON: full block state at deletion
  deleted_by  TEXT NOT NULL,
  deleted_at  INTEGER NOT NULL,
  reason      TEXT                       -- 'vote' | 'admin' | 'user' | etc
);
CREATE INDEX idx_deletions_at ON deleted_blocks(deleted_at DESC);
CREATE INDEX idx_deletions_original ON deleted_blocks(original_id);
```

Note `deleted_blocks` does NOT have an FK to `canvas_blocks` — the whole point is that the parent row is gone. The audit log outlives the data.

### Settings (single-doc collections)

```sql
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,          -- 'campaign', 'propertyGallery', etc.
  value       TEXT NOT NULL,             -- JSON
  updated_at  INTEGER NOT NULL
);
```

Both `subscribeToCampaignSettings` and `subscribeToGalleryPosition` read single docs from the `settings` collection. Modeling them as keyed JSON rows in one table preserves that pattern and avoids 1-row tables. New settings doc = new row, not new schema.

---

## Vote write logic (worked example)

The most-changed write path is `voteBrightness` (canvas) and `voteProperty` (rental). Worked example to validate the schema:

```sql
-- User casts +1 vote on block X
BEGIN;

-- Idempotent: remove any prior vote from this user on this block
DELETE FROM block_votes WHERE block_id = ?block_id AND user_id = ?user_id;

-- Insert new vote
INSERT INTO block_votes (block_id, user_id, direction, voted_at)
VALUES (?block_id, ?user_id, +1, ?now);

-- Recompute brightness atomically: 50 + sum(directions) * 5, clamped 0-100
UPDATE canvas_blocks
SET brightness = MAX(0, MIN(100,
  50 + COALESCE((SELECT SUM(direction) FROM block_votes WHERE block_id = ?block_id), 0) * 5
)),
updated_at = ?now
WHERE id = ?block_id;

-- If brightness fell to 0, snapshot + delete (in app code; not a SQL trigger)
COMMIT;
```

The "delete at brightness 0" logic stays in application code, not a trigger, because the deletion also writes a snapshot to `deleted_blocks` and that's better expressed in app code.

---

## What this doc deliberately leaves to other docs

- **Migration script** (Firestore export → D1 import, including legacy `voters[]` flattening): `CUTOVER.md`
- **Realtime broadcast** (who tells subscribers about D1 writes): `REALTIME.md`
- **Application code changes** (rewriting `src/lib/storage/*.ts`): per-subsystem docs
- **Backup strategy** (D1 has built-in backups, but we want our own): `CUTOVER.md`
- **Migration tool choice** (drizzle-kit migrations vs raw `.sql` files): `FUNCTIONS.md` (Worker-side)

---

## Resolved decisions

1. **Cascade on user deletion: hard FK cascade.** Per user decision 2026-05-20, no data is preserved across the migration; the soft-delete rationale is moot. All content tables have `FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE`. Deleting a user deletes their contributions.
2. **Legacy `voters[]` field: dropped.** No existing data to bridge; the new `block_votes` / `property_votes` tables are the only voter representation. `src/lib/voteUtils.ts:deriveVoterState()` simplifies — no legacy branch.
3. **`chat_messages` FK to `users`: yes, with CASCADE.** Same reasoning as content tables. `user_name` still denormalized for display before the cascade fires (Worker reads the row before deleting the user).
