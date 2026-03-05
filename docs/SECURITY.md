# Security

## Firestore Rules

> **Important**: Rules must be applied to the **`main` named database**, not the default database. The Firebase Console shows a separate Rules tab for each database — make sure you're editing the right one.

There is no `firestore.rules` file in the repository — rules are managed directly in the Firebase Console.

### Rule Pattern

The general pattern is **public read, authenticated write**. Admin-only operations check the `admins` collection:

```javascript
function isAdmin() {
  return get(/databases/main/documents/admins/$(request.auth.token.email)).exists;
}

// Most collections:
match /{collection}/{docId} {
  allow read: if true;
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null
    && (resource.data.createdBy == request.auth.uid || isAdmin());
}

// Admin-only write (emailTemplates, settings, admins):
match /emailTemplates/{templateId} {
  allow read: if true;
  allow write: if request.auth != null && isAdmin();
}
```

### Per-Collection Access

| Collection | Read | Write |
|------------|------|-------|
| `canvasBlocks` | Public | Auth (own blocks); admin (any) |
| `rentalProperties` | Public | Auth (create); own + admin (update/delete) |
| `chatMessages` | Public | Auth (create own); admin (delete any) |
| `siteContent` | Public | Admin only |
| `users` | Public | Auth (own profile); admin (any) |
| `pledges` | Public | Auth (own pledge) |
| `donations` | Public | Cloud Function only (webhook) |
| `settings` | Public | Admin only |
| `admins` | Public | Admin only |
| `bannedEmails` | Public | Admin only |
| `deletedBlocks` | Auth | Admin only |
| `blockEdits` | Auth | Auth (create) |
| `presence` | Public | Auth (own doc) |
| `emailTemplates` | Public | Admin only |
| `emailHistory` | Auth | Cloud Function only |

---

## Client-Side Permissions

`src/lib/permissions.ts` provides client-side guards (these mirror Firestore rules but run in the browser):

```typescript
canEditBlock(block: CanvasBlock, user: User, isAdmin: boolean): boolean
// Admin can edit any block; regular users only blocks they created

filterEditableBlocks(blocks, user, isAdmin): CanvasBlock[]
// Used for multi-select — returns only blocks the user can edit

countEditableBlocks(blocks, user, isAdmin): number
// Used in panel UI to show editable block count
```

---

## Input Sanitization

`src/lib/sanitize.ts` sanitizes HTML content for canvas blocks and chat:

**Allowed HTML tags**: `b, i, u, s, strong, em, span, br, a`

**Stripped**: All event handlers (`onclick`, `onerror`, etc.)

**Allowed inline styles** (on `span` only):
- `color`, `background-color`
- `font-weight`, `font-style`, `text-decoration`

**Blocked style values**: `javascript:`, `url()` (prevents CSS injection)

---

## Authentication

### Email Ban Check

On signup, `AuthModal.tsx` checks `bannedEmails/{email}` before creating the account. Banned emails cannot register even if they don't have an existing account.

### Auto Sign-Out on Deletion

`AuthContext` subscribes to the user's profile document in real-time. If an admin deletes the profile (the doc disappears), the user is automatically signed out immediately — no polling required.

### Admin Verification

Two layers:
1. **Client**: `AuthContext` subscribes to `admins` collection and computes `isAdmin` state
2. **Cloud Functions**: `isAdmin()` in `functions/src/email.ts` does a fresh Firestore lookup for every callable invocation

The super admin email (`christopher@corella.com`) is hardcoded in both `src/lib/admin.ts` and `functions/src/email.ts`.

---

## Cloud Function Security

Stripe functions:
- `createCheckoutSession`: CORS-enabled HTTP endpoint; validates minimum amount ($1)
- `stripeWebhook`: Validates Stripe webhook signature before processing

Email functions (callable):
- All check `isAdmin()` before executing
- Secrets loaded via Firebase `defineSecret` (not environment variables)

Required secrets (set via `firebase functions:secrets:set`):
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Email SMTP config via `functions.config().email` (host, port, user, pass).

---

## Known Considerations

### Email Template Editing

The `EmailsPanel` allows admins to edit HTML templates via a `contentEditable` iframe preview. Since only admins can access this panel (Firestore rules enforce admin-only write on `emailTemplates`), the XSS risk is limited to admin self-infliction. No user-submitted content goes through this path.

### Property Image Uploads

`AddPropertyModal` uploads images directly to Firebase Storage. Firebase Storage rules should validate:
- File type (JPEG/PNG only)
- File size limit
- Authenticated user only

Verify your Storage rules in the Firebase Console match these constraints.

### Hardcoded Credentials in Scripts

`scripts/add-blueprint-keywords.mjs`, `scripts/test-login.mjs`, and `scripts/test-login-debug.mjs` contain hardcoded admin credentials. These are one-off utility scripts and should not be committed after editing. They are not exposed to users or deployed.

### Stripe Keys

Run `./scripts/verify-production-ready.sh` before going live to confirm no test keys are hardcoded and all secrets are properly set. See [STRIPE_GO_LIVE.md](../STRIPE_GO_LIVE.md).
