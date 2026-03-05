# Backup & Restore

## Overview

Two scripts handle Firestore data backup and restore. Both require `scripts/serviceAccountKey.json` (Firebase Admin SDK credentials — see [ADMIN.md](ADMIN.md#prerequisites)).

---

## Backing Up

```bash
node scripts/backup-firestore.js
```

Creates a timestamped directory under `scripts/backups/`:

```
scripts/backups/backup-2024-01-15-143022/
├── firestore.json    # All collection data
├── auth-users.json   # Firebase Auth user metadata
└── manifest.json     # Backup stats and timestamp
```

### What Gets Backed Up

**Firestore collections** (14 currently included):

| Collection | Included |
|------------|----------|
| `canvasBlocks` | ✅ |
| `chatMessages` | ✅ |
| `users` | ✅ |
| `pledges` | ✅ |
| `siteContent` | ✅ |
| `settings` | ✅ |
| `admins` | ✅ |
| `bannedEmails` | ✅ |
| `deletedBlocks` | ✅ |
| `blockEdits` | ✅ |
| `donations` | ✅ |
| `rentalProperties` | ✅ |
| `emailTemplates` | ✅ |
| `emailHistory` | ✅ |
| `presence` | ⚠️ Not included (ephemeral 30s TTL, no backup value) |

**Firebase Auth users**: Metadata only (email, uid, displayName, creation time). **Passwords cannot be exported** — users will need to reset passwords if restoring to a new Firebase project.

### manifest.json Format

```json
{
  "timestamp": "2024-01-15T14:30:22.000Z",
  "collections": ["canvasBlocks", "chatMessages", ...],
  "counts": { "canvasBlocks": 42, "chatMessages": 158, ... },
  "authUserCount": 23
}
```

---

## Restoring

> **Warning**: Restore overwrites existing data. Always use `--dry-run` first.

### Preview (Dry Run)

```bash
node scripts/restore-firestore.js scripts/backups/backup-2024-01-15-143022 --dry-run
```

Shows what would be restored without making any changes.

### Full Restore

```bash
node scripts/restore-firestore.js scripts/backups/backup-2024-01-15-143022
```

Prompts you to type `RESTORE` to confirm before executing.

### Single Collection Restore

```bash
node scripts/restore-firestore.js scripts/backups/backup-2024-01-15-143022 --collection canvasBlocks
```

Restores only the specified collection. Useful for recovering accidentally deleted blocks without overwriting everything.

### Restore Details

- Batch size: 500 operations per Firestore batch (Firestore limit)
- Existing documents are overwritten (upsert behavior)
- Documents not in backup are left untouched (not a destructive wipe)

---

## Recommended Schedule

- **Weekly**: Run before any major feature changes
- **Before Stripe go-live**: See [STRIPE_GO_LIVE.md](../STRIPE_GO_LIVE.md)
- **After major content additions**: Back up `canvasBlocks` and `rentalProperties`

---

## Off-Site Storage

Backup files in `scripts/backups/` are local only. For disaster recovery, copy backups to:
- Google Drive
- AWS S3
- Any cloud storage you control

The backup directory is gitignored — backups will not be committed to the repo.

---

## Limitations

- **Auth passwords**: Cannot be exported. Users must reset passwords if migrating to a new Firebase project.
- **Firebase Storage**: Property images (`properties/*/main.jpg`) are NOT backed up by these scripts. Back up Firebase Storage separately via the Firebase Console or `gsutil`.
- **Presence**: The `presence` collection is intentionally excluded — it stores ephemeral cursor positions with a 30s TTL and has no restore value.
