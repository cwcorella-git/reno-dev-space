# Voting System Architecture

## Overview

The voting system is a brightness-based reputation model. Every votable item has a `brightness` field (0–100, default 50). Each vote changes brightness by ±5. Items become invisible or are removed when brightness falls too low.

Two item types support voting:
- **Canvas text blocks** (`canvasBlocks` collection) — deleted at brightness 0
- **Rental properties** (`rentalProperties` collection) — archived (grayed out) at brightness ≤ 20

---

## Firestore Data Model

### Shared Fields (both canvas blocks and properties)

```typescript
brightness: number         // 0–100, default 50
voters: string[]           // Legacy: UIDs of voters (direction unknown)
votersUp: string[]         // UIDs who voted up (current system)
votersDown: string[]       // UIDs who voted down (current system)
```

### State Machine

| State | brightness | votersUp | votersDown |
|-------|-----------|----------|------------|
| Neutral | 50 | [] | [] |
| Upvoted | 55 | [uid] | [] |
| Downvoted | 45 | [] | [uid] |

Each vote: ±5 brightness. Votes do not stack — one vote per user per item.

---

## Vote Behavior

### Button States
- **Same-direction button is disabled** — if you've already voted up, the up button is grayed/inert.
- **Opposite-direction button removes existing vote** — clicking down when you voted up returns to neutral (no double penalty).
- **Legacy voters** (`voters[]` but not in `votersUp`/`votersDown`) — both buttons disabled; their vote direction is unknown.

### No-Op Detection
`CanvasContext.vote()` mirrors the server-side `voteBrightness` logic client-side before the Firestore write. If the vote is a no-op (same direction as existing vote), history is not recorded and no write is made.

---

## Storage Layer

### Canvas Blocks — `voteBrightness()` (`canvasStorage.ts`)

```typescript
voteBrightness(blockId: string, userId: string, direction: 'up' | 'down'): Promise<boolean>
// Returns true if block was deleted (brightness reached 0)
```

Read-then-write sequence:
1. `getDoc()` — read current block state
2. Detect vote direction (new vote, unvote, or direction change)
3. Compute brightness delta (±5, or ±10 for direction flip)
4. `updateDoc()` — write `brightness`, `votersUp`, `votersDown`
5. If brightness ≤ 0: `deleteDoc()` the block, return `true`

### Properties — `voteProperty()` (`propertyStorage.ts`)

Same read-then-write pattern, but:
- Archive threshold: brightness ≤ `ARCHIVE_THRESHOLD` (20), not deletion
- Archived properties remain in Firestore but are hidden in the gallery

---

## Client-Side Flow

### Canvas Block Votes (`CanvasContext.tsx`)

```
User clicks vote button
  → vote(id, direction) in CanvasContext
  → deriveVoterState() from local block snapshot
  → No-op check — skip history recording if no-op
  → recordHistory('vote', [id]) — only if not a no-op
  → voteBrightness(id, uid, direction) — Firestore write
  → If wasDeleted: logDeletion(block, 'vote', uid), clear selection
  → Return wasDeleted
```

**Undo behavior**: Vote history captures the full block before-state. Undoing a vote that deleted a block restores it via `restoreBlock()`.

### Property Votes (`PropertyVoteControls.tsx`)

```
User clicks vote button
  → handleVote(direction)
  → isVoting guard (prevents double-clicks)
  → voteProperty(id, uid, direction) — Firestore write
```

Properties do not participate in the undo/redo system.

---

## UI Components

### Canvas Block Votes (`CanvasBlock.tsx`)

Vote arrows appear on the right side of each block, visible on hover or when selected:

```
▲  (up arrow — green when voted up, disabled if already voted up)
50 (brightness number)
▼  (down arrow — red when voted down, disabled if already voted down)
```

- Keyboard: `Space` = vote up, `Alt` = vote down (while block is selected)
- `disabled` prop set for same-direction votes and legacy voters

### Property Votes (`PropertyVoteControls.tsx`)

Rendered as an overlay on each property card. Same up/down/number layout using `ChevronUpIcon`/`ChevronDownIcon`. Hidden when property is archived.

---

## Shared Voter State Utility

`src/lib/voteUtils.ts` exports `deriveVoterState()`, used by all three UI-layer files:

```typescript
deriveVoterState(votersUp, votersDown, voters, userId)
// → { votedUp, votedDown, isLegacyVoter, hasVoted }
```

**Why the storage layer has its own copy:** `voteBrightness()` and `voteProperty()` re-derive voter state from a freshly fetched Firestore snapshot inside the write path. Using the shared utility there would require a different call signature (the storage functions receive raw Firestore data, not typed block objects), and the derivation is 3 lines — not worth the coupling.

---

## Opacity Mapping

Both canvas blocks and property cards map `brightness` to CSS `opacity`:

```
brightness 0   → opacity 0.2  (nearly invisible, just before deletion/archive)
brightness 50  → opacity ~0.6  (neutral)
brightness 100 → opacity 1.0  (maximum)
```

Formula: `opacity = 0.2 + (brightness / 100) * 0.8`

---

## Vote History and Audit

### Undo/Redo (canvas blocks only)
- Covered by the session-based undo system in `CanvasContext`
- `recordHistory('vote', [blockId])` stores the full block snapshot before the vote
- If the vote deleted the block, `deletedBlocks` is included in the history entry for restore

### Deletion Log
When a downvote deletes a canvas block:
- `logDeletion(block, 'vote', uid)` writes to `deletedBlocks` collection
- Visible in the History panel (admin)
- Admin can restore the block from the History panel

---

## Key Constants

```typescript
VOTE_BRIGHTNESS_CHANGE = 5   // ±5 per vote (in canvas.ts)
ARCHIVE_THRESHOLD = 20       // Properties archived at ≤ 20 (in property.ts)
// Canvas blocks deleted at brightness ≤ 0 (checked in voteBrightness)
```

---

## Known Limitations

### Non-Transactional Storage Writes

`voteBrightness()` and `voteProperty()` use a `getDoc()` then `updateDoc()` sequence rather than a Firestore `runTransaction()`. Under concurrent votes from different users on the same item within milliseconds, the brightness delta could be applied twice from the same base value — most relevant when a block is near brightness 0 (two simultaneous downvotes could both read `brightness: 5`, both compute `newBrightness: 0`, and both attempt deletion).

`votersUp`/`votersDown` are updated with `arrayUnion`/`arrayRemove`, which are atomic — so the voter tracking is safe. Only the `brightness` number is at risk.

At the expected traffic scale of a small community site this race is not a practical concern. If concurrent voting becomes significant, wrapping the read-compute-write in `runTransaction()` would eliminate it.

### Client/Server State Divergence in No-Op Check

`CanvasContext.vote()` performs its no-op check against the local React state snapshot (from the Firestore `onSnapshot` feed). `voteBrightness()` then reads fresh state from Firestore. If another user votes between these two reads, the local no-op check and the Firestore result may disagree — typically resulting in a silently dropped history entry. The Firestore state is always authoritative; only the undo record is affected.

---

## Files Reference

| File | Role |
|------|------|
| `src/lib/voteUtils.ts` | `deriveVoterState()` — shared voter state derivation for UI layer |
| `src/lib/storage/canvasStorage.ts` | `voteBrightness()` — read-then-write vote path for canvas blocks |
| `src/lib/storage/propertyStorage.ts` | `voteProperty()` — read-then-write vote path for properties |
| `src/contexts/CanvasContext.tsx` | `vote()` — client orchestration, history, deletion logging |
| `src/components/canvas/CanvasBlock.tsx` | Canvas block vote UI (arrows, keyboard shortcuts) |
| `src/components/property/PropertyVoteControls.tsx` | Property vote UI |
| `src/types/canvas.ts` | `VOTE_BRIGHTNESS_CHANGE` constant |
| `src/types/property.ts` | `ARCHIVE_THRESHOLD` constant, `RentalProperty` type |
| `src/lib/storage/deletionStorage.ts` | `logDeletion()` — audit log writes |
