# Firebase Surface Inventory

Snapshot of every Firebase touchpoint in the codebase as of 2026-05-20. This is the source-of-truth reference that every other doc in `docs/migration/` builds on. If the codebase changes, this doc updates.

**Why this matters:** the migration's complexity is bounded by what's actually here, not by what Firebase *could* be doing. The exploration revealed a smaller surface than the original `docs/POST_FIREBASE.md` implied — three findings that change everything downstream:

- **Zero `runTransaction()` or `writeBatch()` calls.** The app never relied on Firestore's atomic multi-doc primitives. Cascading deletes use `Promise.all()`, which already accepts partial-failure states. We don't have to preserve atomicity we never had.
- **14 of 15 realtime subscriptions are durable data.** Only `subscribeToPresence` is high-frequency ephemeral. The rest are "data that happens to push live" — any SQL + broadcast layer covers this.
- **Array-mutation voting (`votersUp[]` / `votersDown[]`) is the single architectural redesign.** Arrays → join tables in SQL. Every other write pattern is a mechanical translation.

---

## 1. Firestore: Realtime Subscriptions (15)

All exports live in `src/lib/storage/`. Each follows the contract `(callback) => unsubscribe` — this shape MUST be preserved across the migration so UI consumers don't change.

| # | Function | File | Collection | Filters/Order/Limit | Returns | Class |
|---|---|---|---|---|---|---|
| 1 | `subscribeToCanvas` | `canvasStorage.ts` | `canvasBlocks` | `orderBy('zIndex', 'asc')` | `CanvasBlock[]` | Durable |
| 2 | `subscribeToChat` | `chatStorage.ts` | `chatMessages` | `orderBy('timestamp', 'desc')`, `limit(100)` | `ChatMessage[]` | Durable (windowed) |
| 3 | `subscribeToPresence` | `presenceStorage.ts` | `presence` | `where('userId', '!=', currentUserId)` | `PresenceData[]` | **Ephemeral (30s TTL)** |
| 4 | `subscribeToProperties` | `propertyStorage.ts` | `rentalProperties` | `orderBy('createdAt', 'desc')` | `RentalProperty[]` | Durable |
| 5 | `subscribeToGalleryPosition` | `propertyGalleryStorage.ts` | `settings/propertyGallery` | Single doc | `PropertyGalleryPosition` | Durable |
| 6 | `subscribeToCampaignSettings` | `campaignStorage.ts` | `settings/campaign` | Single doc | `CampaignSettings` | Durable |
| 7 | `subscribeToPledges` | `pledgeStorage.ts` | `pledges` | None | `Pledge[]` | Durable |
| 8 | `subscribeToContent` | `contentStorage.ts` | `siteContent` | None | `Map<string, ContentEntry>` | Durable |
| 9 | `subscribeToUsers` | `userStorage.ts` | `users` | None | `UserProfile[]` | Durable |
| 10 | `subscribeToAdmins` | `adminStorage.ts` | `admins` | None | `Set<string>` | Durable |
| 11 | `subscribeToBannedEmails` | `bannedEmailsStorage.ts` | `bannedEmails` | None | `Set<string>` | Durable |
| 12 | `subscribeToEmailTemplates` | `emailTemplateStorage.ts` | `emailTemplates` | None | `Map<EmailTemplateId, EmailTemplate>` | Durable |
| 13 | `subscribeToEmailHistory` | `emailHistoryStorage.ts` | `emailHistory` | `orderBy('sentAt', 'desc')`, `limit(maxEntries)` | `EmailHistoryEntry[]` | Durable (audit) |
| 14 | `subscribeToDeletions` | `deletionStorage.ts` | `deletedBlocks` | `orderBy('deletedAt', 'desc')` | `DeletionEntry[]` | Durable (audit) |
| 15 | `subscribeToBlockEdits` | `editHistoryStorage.ts` | `blockEdits` | `where('blockId', '==', blockId)`, `orderBy('editedAt', 'desc')` | `EditHistoryEntry[]` | Durable (audit) |

### Subscription consumers (where they're called from)

| Consumer | Subscriptions used |
|---|---|
| `src/contexts/AuthContext.tsx` | `subscribeToAdmins`, `subscribeToBannedEmails`, `subscribeToUsers` (also wraps `onAuthStateChanged`) |
| `src/contexts/CanvasContext.tsx` | `subscribeToCanvas`, `subscribeToPledges` |
| `src/contexts/ContentContext.tsx` | `subscribeToContent` |
| `src/contexts/PresenceContext.tsx` | `subscribeToPresence` |
| `src/hooks/useFirestoreChat.ts` | `subscribeToChat` |
| `src/components/property/PropertyGallery.tsx` | `subscribeToProperties`, `subscribeToGalleryPosition` |
| `src/components/CampaignBanner.tsx` | `subscribeToCampaignSettings` |
| `src/components/panel/CampaignPanel.tsx` | `subscribeToCampaignSettings` |
| `src/components/panel/MembersTab.tsx` | `subscribeToUsers` (via AuthContext) |
| `src/components/panel/HistoryTab.tsx` | `subscribeToDeletions`, `subscribeToBlockEdits` |
| `src/components/panel/EmailVariableEditor.tsx` | `subscribeToPledges`, `subscribeToCampaignSettings`, `subscribeToEmailTemplates`, `subscribeToEmailHistory` |
| `src/components/panel/ProfilePanel.tsx` | `subscribeToEmailHistory` |
| `src/components/panel/UnifiedPanel.tsx` | `subscribeToAdmins`, `subscribeToEmailTemplates` |

Three Contexts + one Hook hold most subscription weight. **API stability is the migration's UI-side contract:** if `subscribeToX(callback)` keeps returning `() => void` and keeps emitting the same shape, the React tree doesn't change.

---

## 2. Firestore: One-Time Reads (`getDoc` / `getDocs`)

Roughly 20+ point reads scattered across storage modules. These are easier to port than subscriptions (no broadcast layer needed), but they exist and must be enumerated:

- `userStorage.ts`: `getUserStats()`, `clearUserVotes()`, `deleteUserBlocks()`, `deleteUserMessages()`
- `propertyStorage.ts`: `voteProperty()`, `deleteProperty()`, `reportProperty()`, `unreportProperty()`, `dismissPropertyReports()`, `clearUserPropertyVotes()`
- `propertyGalleryStorage.ts`: `migrateGalleryPositionIfNeeded()`
- `bannedEmailsStorage.ts`: `isEmailBanned()`
- `emailHistoryStorage.ts`: `getRecentEmailHistory()`
- `emailTemplateStorage.ts`: `getEmailTemplate()`
- `deletionStorage.ts`: `removeReportEntry()`, `removeAllReportEntries()`
- `canvasStorage.ts`: read-then-write inside `voteBrightness()`, `reportBlock()`, `dismissReports()`

In SQL these become plain `SELECT` queries — no architectural concern.

---

## 3. Firestore: Write Patterns

### Transactions
**Count: 0.** `runTransaction()` is not imported anywhere. This is the single most important finding for migration scope — it means the app's current concurrency model is "last write wins" with array-merge semantics for voting. SQL must match this, not exceed it.

### Batched writes
**Count: 0.** `writeBatch()` is not imported anywhere. Multi-doc operations use `Promise.all()`:

- `userStorage.ts` — `deleteUserAccount()` / `adminDeleteUser()` cascade-delete across 6 collections
- `canvasStorage.ts` — `resetAllBrightness()` loops over all blocks
- `propertyStorage.ts` — `deleteUserProperties()`, `clearUserPropertyVotes()`

These tolerate partial failure today. SQL `BEGIN/COMMIT` would actually *improve* on the current behavior — but it's not a regression risk.

### Array mutations (the hard one)
`arrayUnion()` / `arrayRemove()` usage:

| File | Function | Array fields |
|---|---|---|
| `canvasStorage.ts:135-156` | `voteBrightness()` | `votersUp[]`, `votersDown[]` |
| `canvasStorage.ts` | `reportBlock()`, `unreportBlock()` | `reportedBy[]` |
| `canvasStorage.ts` | `dismissReports()` | `dismissedReporters[]` (uses spread + `arrayUnion`) |
| `propertyStorage.ts:166-181` | `voteProperty()` | `votersUp[]`, `votersDown[]` |
| `propertyStorage.ts:224-235` | `reportProperty()`, `unreportProperty()` | `reportedBy[]` |
| `propertyStorage.ts:248-250` | `dismissPropertyReports()` | `dismissedReporters[]` |
| `propertyStorage.ts:289-298` | `clearUserPropertyVotes()` | removes user from all three |

**Migration consequence:** arrays embedded in documents become junction tables in SQL. Designed in `SCHEMA.md`. Affects how `deriveVoterState()` (`src/lib/voteUtils.ts`) computes vote state — that file is the seam.

### Server timestamps & atomic increments

| Pattern | Where | Purpose |
|---|---|---|
| `serverTimestamp()` | `presenceStorage.ts:32` | `lastSeen` for cursor presence; clock-skew safety |
| `increment()` | `campaignStorage.ts:114` | Increment `pageViews` counter |
| `increment()` | `propertyStorage.ts:295, 299` | Brightness ±5 on vote reversal |
| `increment()` | `userStorage.ts:134` | Brightness reset when clearing votes |

SQL alternative: wrap read-modify-write in a transaction. Cheap.

### Plain CRUD
**Count: ~88** across all storage files. `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`. 1:1 translation to SQL INSERT/UPDATE/DELETE.

---

## 4. Firebase Auth Surface

Subscribed via `onAuthStateChanged` in `src/contexts/AuthContext.tsx:65`. Also subscribes to a real-time listener on `users/{uid}` doc to sync Firestore profile with auth state.

**User properties actually used:** `uid`, `email`, `displayName`, `emailVerified`. Firestore-side profile adds `bio`, `createdAt`.

**Flows (all in `AuthContext.tsx`):**

| Flow | Line | Firebase call |
|---|---|---|
| Signup | ~128 | `createUserWithEmailAndPassword` + `updateProfile` + `sendEmailVerification` + Firestore profile create + initial pledge record |
| Login | ~156 | `signInWithEmailAndPassword` |
| Logout | ~161 | `signOut` |
| Resend verification | ~181 | `sendEmailVerification` |

**Auth trigger:** `sendVerificationEmail` in `functions/src/emailFunctions.ts:24` fires on user creation via Auth `onCreate`. Uses Admin SDK to generate a verification link, loads template, sends via Nodemailer. This is the **only** non-Firestore trigger in the codebase.

**No** custom claims, OAuth, phone auth, password reset (resend-verification is used instead), or link signing on the client.

**Admin detection** (`src/lib/admin.ts`):
- Hardcoded `SUPER_ADMIN_EMAIL = 'christopher@corella.com'`
- Plus the dynamic `admins` collection (subscribed live via `subscribeToAdmins`)

---

## 5. Firebase Storage Surface

**Single bucket path:** `properties/{propertyId}/main.jpg`. That's the entire storage surface.

| Operation | Where | Notes |
|---|---|---|
| Upload | `propertyStorage.ts:74` (`uploadPropertyImage()`) | `uploadBytes` → returns download URL |
| Delete | `propertyStorage.ts:206` (inside `deleteProperty()`) | `deleteObject` before Firestore deletion |

No file-size / MIME-type validation in code — relies on Firebase Storage defaults (5GB limit). Called from `AuthModal.tsx` and the property creation flow.

---

## 6. Cloud Functions Surface

Seven exported functions across `functions/src/`:

| Function | Trigger | Purpose |
|---|---|---|
| `createCheckoutSession` | HTTPS `onRequest` (POST) | Stripe Checkout session for donations; validates amount ≥ $1; returns sessionId + URL |
| `stripeWebhook` | HTTPS `onRequest` | Handles `checkout.session.completed`; writes to `donations` collection, optionally updates `pledges` if `updatePledge=true` |
| `sendVerificationEmail` | Auth `onCreate` | Auto-fires on user creation; generates verification link via Admin SDK; sends Gmail SMTP email |
| `sendCampaignSuccessEmails` | HTTPS `onCall` (admin-only) | Sends styled email to all pledgers when campaign hits goal |
| `sendCampaignEndedEmails` | HTTPS `onCall` (admin-only) | Sends campaign-ended email when timer expires |
| `sendCampaignUpdate` | HTTPS `onCall` (admin-only) | Sends milestone update email with custom title/message + progress |
| `sendTestEmail` | HTTPS `onCall` (admin-only) | Admin testing endpoint |

**Firestore triggers: 0.** No `onCreate` / `onWrite` / `onDelete` document listeners. All campaign emails are admin-pulled, not automatic.

### Email infrastructure (`functions/src/email.ts`)
- **Provider:** Gmail SMTP (`smtp.gmail.com:587`)
- **Secrets:** `email.user`, `email.pass` (Gmail app password) via `firebase functions:config:set`
- **Fallback:** If unset, creates a test transporter that logs to stdout
- **From address:** `"Reno Dev Space" <noreply@renodevspace.org>`
- **Template source:** Firestore `emailTemplates` collection (live-editable in EmailsPanel), falling back to static files in `functions/templates/` (4 HTML files)

---

## 7. Firestore Collections (full list)

All on the `main` database (not `default`).

| Collection | Subscription | Owner module |
|---|---|---|
| `canvasBlocks` | `subscribeToCanvas` | `canvasStorage.ts` |
| `rentalProperties` | `subscribeToProperties` | `propertyStorage.ts` |
| `chatMessages` | `subscribeToChat` | `chatStorage.ts` |
| `siteContent` | `subscribeToContent` | `contentStorage.ts` |
| `users` | `subscribeToUsers` | `userStorage.ts` |
| `pledges` | `subscribeToPledges` | `pledgeStorage.ts` |
| `donations` | (none — written by webhook) | written in `functions/src/index.ts` |
| `settings` | `subscribeToCampaignSettings`, `subscribeToGalleryPosition` (two known docs: `campaign`, `propertyGallery`) | `campaignStorage.ts`, `propertyGalleryStorage.ts` |
| `admins` | `subscribeToAdmins` | `adminStorage.ts` |
| `bannedEmails` | `subscribeToBannedEmails` | `bannedEmailsStorage.ts` |
| `deletedBlocks` | `subscribeToDeletions` | `deletionStorage.ts` |
| `blockEdits` | `subscribeToBlockEdits` | `editHistoryStorage.ts` |
| `presence` | `subscribeToPresence` | `presenceStorage.ts` |
| `emailTemplates` | `subscribeToEmailTemplates` | `emailTemplateStorage.ts` |
| `emailHistory` | `subscribeToEmailHistory` | `emailHistoryStorage.ts` |

**15 collections. 15 subscriptions. 1:1 mapping.** Each becomes a D1 table (or a small group of tables, in the case of `canvasBlocks` and `rentalProperties` which spawn vote/report join tables).

---

## 8. Out of scope (intentionally not catalogued here)

- **Stripe** is its own surface and won't migrate. The checkout/webhook code stays semantically identical when ported to Workers; only the runtime changes.
- **Firestore security rules** are managed in the Firebase Console (not in repo — see `MEMORY.md`). They'll be replaced by application-level authorization in Workers, which is a `FUNCTIONS.md` concern.
- **Nodemailer SMTP config** is captured here but the deliverability story (DKIM, SPF, dedicated IP) is an `EMAIL.md` concern.
- **Backup scripts** (`scripts/backup-firestore.js`, `restore-firestore.js`) are migration-adjacent — the export format is what feeds the eventual D1 import. Detailed in `CUTOVER.md`.
