# Admin Guide

## Prerequisites

All admin scripts use the Firebase Admin SDK and require a service account key:

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key → download as `serviceAccountKey.json`
3. Place it at `scripts/serviceAccountKey.json` (this file is gitignored)

Scripts must be run from the project root:
```bash
node scripts/<script-name>.js
```

---

## Admin Scripts

### backup-firestore.js — Backup All Data

Creates a timestamped JSON backup of all Firestore collections and Firebase Auth users.

```bash
node scripts/backup-firestore.js
# Output: scripts/backups/backup-YYYY-MM-DD-HHmmss/
```

See [docs/BACKUP.md](BACKUP.md) for detailed backup/restore procedures.

---

### restore-firestore.js — Restore from Backup

```bash
node scripts/restore-firestore.js <backup-path>              # Full restore
node scripts/restore-firestore.js <backup-path> --dry-run    # Preview only
node scripts/restore-firestore.js <backup-path> --collection canvasBlocks  # Single collection
```

Prompts for confirmation before executing a real restore.

---

### migrate-users.js — Sync Auth → Firestore

Reads all Firebase Auth users and creates/updates corresponding documents in the `users` Firestore collection. Useful after manual Auth changes or to bootstrap a new database.

```bash
node scripts/migrate-users.js
```

---

### delete-user.js — Delete a User by Email

> **Note**: This script does **not** perform a full cascade delete — use the in-app admin deletion (Members tab) for cascade deletion that also clears votes, blocks, and chat messages.

```bash
node scripts/delete-user.js user@example.com
```

---

### randomize-fonts.js — Randomize Canvas Block Fonts

Updates `style.fontFamily` on all documents in `canvasBlocks` with a randomly selected font from the 12 CSS variable options. Useful for visual refresh or testing.

```bash
node scripts/randomize-fonts.js
```

---

### add-blueprint-keywords.mjs — Seed Canvas Keywords

A one-time Playwright automation script that signs in as admin and writes 18 predefined community keyword blocks to the canvas. Uses 8 preset colors and all 12 fonts.

> **Credentials**: Requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables. Never hardcode credentials in the script.

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret node scripts/add-blueprint-keywords.mjs
```

---

### verify-production-ready.sh — Stripe Production Checklist

Runs 5 checks to verify the deployment is safe to go live with real Stripe payments:
1. No hardcoded test API keys in source
2. Firebase secrets configured (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
3. `.env.local` properly gitignored
4. Firebase Functions deployed
5. Webhook endpoint reachable at Cloud Functions URL

```bash
./scripts/verify-production-ready.sh
```

---

## In-App Admin

### User Moderation (Members Tab)

| Action | Effect |
|--------|--------|
| Delete user | Cascade: clears votes, deletes blocks + chat messages + pledge + user profile. Auto-signs out the user via real-time profile listener. Firebase Auth account NOT deleted (no server-side SDK). |
| Ban email | Adds email to `bannedEmails` collection. Blocked from signing up. |
| Unban email | Removes from `bannedEmails`. |
| Promote to admin | Adds email to `admins` collection. Takes effect immediately via real-time subscription. |
| Demote admin | Removes from `admins` collection. Super admin (`christopher@corella.com`) cannot be demoted. |

### Block Moderation

- **Reports**: Users can report blocks (⚠ button). Reported blocks get a yellow border for admins.
- **Dismiss report**: Clears `reportedBy`, adds reporter UIDs to `dismissedReporters` — they can't re-report that block.
- **Delete block**: Soft-deletes via `deletedBlocks` audit log with reason (`admin`, `vote`, `report`, etc.)
- **History panel**: View all deleted blocks and edit history. Admin can restore deleted blocks or permanently delete history entries.

### Campaign Controls (Campaign Panel)

- **Start/Reset timer**: Begins or restarts the campaign countdown
- **Lock/Unlock**: Prevents all block editing when locked (campaign expired state)
- **Set funding goal**: Updates the dollar target shown on the progress bar
- **Reset votes**: Atomically reverses all vote brightness changes via Firestore `increment()`

### Email Admin (Emails Panel)

- View and edit the 4 HTML email templates directly in a WYSIWYG iframe
- Send campaign emails to all backers (success, ended, update)
- View email send history (last 5, stored in `emailHistory` collection)

---

## Admin System Architecture

### Super Admin

Hardcoded in `src/lib/admin.ts` and `functions/src/email.ts`:
```typescript
const SUPER_ADMIN_EMAIL = 'christopher@corella.com'
```

Cannot be demoted via the app. Always has admin rights regardless of `admins` collection.

### Dynamic Admins

Any email in the `admins` Firestore collection is treated as an admin. `AuthContext` subscribes to this collection in real-time — promotions and demotions take effect immediately without refresh.

### Permission Checks

Client-side permission logic in `src/lib/permissions.ts`:

```typescript
canEditBlock(block, user, isAdmin)   // admin can edit any; users only own blocks
filterEditableBlocks(blocks, user, isAdmin)  // used for multi-select
countEditableBlocks(blocks, user, isAdmin)   // used for UI counts
```

### Self-Deletion Cascade (ProfilePanel)

When a user deletes their own account:
1. Clears all votes from `voters`, `votersUp`, `votersDown` arrays (reverses brightness)
2. Deletes all canvas blocks created by user
3. Deletes all chat messages by user
4. Deletes pledge record
5. Deletes user profile from Firestore
6. Deletes Firebase Auth account

### Admin-Deletion Cascade (MembersTab)

Same as self-deletion except:
- Firebase Auth account is NOT deleted (requires server-side Admin SDK)
- Deleted user is auto-signed-out via real-time profile listener detecting profile deletion
- Admin can subsequently ban the email to prevent re-signup
