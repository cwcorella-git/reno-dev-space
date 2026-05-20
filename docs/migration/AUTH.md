# Auth Migration: Firebase Auth → better-auth on Workers

Replaces Firebase Auth (email/password + verification email trigger) with [better-auth](https://www.better-auth.com/) running on a Worker, backed by D1.

**Why better-auth (vs Clerk, vs Lucia, vs roll-your-own):**
- Open source (MIT) — survives any vendor change.
- D1 + Workers adapter is first-class.
- Email/password + verification + password reset out of the box.
- No third-party hosted dependency.
- Lucia is also good but recently announced sunset; better-auth is the actively-developed successor in the same shape.

---

## Current Firebase Auth surface (from `INVENTORY.md`)

- 4 flows: signup, login, logout, resend verification.
- 1 trigger: Auth `onCreate` → `sendVerificationEmail` Cloud Function.
- User properties used: `uid`, `email`, `displayName`, `emailVerified`. Plus Firestore profile fields (`bio`, `createdAt`).
- Admin detection: hardcoded super-admin + `subscribeToAdmins` from Firestore.
- Real-time `users/{uid}` doc subscription for profile sync (`AuthContext.tsx`).

No OAuth, no phone auth, no custom claims, no password reset (resend-verification stands in).

---

## Target architecture

```
Browser
   │
   │  (POST /api/auth/signup, /login, /logout, /verify, etc.)
   ▼
Worker (better-auth handler)
   │
   ├─► D1 tables: users, sessions, verification_tokens
   │
   └─► Resend (transactional email — see EMAIL.md)
```

better-auth provides a single mountable handler that exposes all the standard auth routes under `/api/auth/*`. The Worker mounts it and adds nothing custom for the standard flows.

Session is cookie-based (HttpOnly, Secure, SameSite=Lax). No client-side token in localStorage.

---

## D1 tables (additions to `SCHEMA.md`)

better-auth ships migrations; the resulting tables are:

```sql
-- The schema below is what better-auth's d1 adapter generates.
-- DO NOT hand-write; run `npx @better-auth/cli generate` to produce migrations.

CREATE TABLE auth_user (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  name            TEXT,
  image           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE auth_session (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  expires_at   INTEGER NOT NULL,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE auth_account (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  provider_id     TEXT NOT NULL,   -- 'credential' for email/password
  account_id      TEXT NOT NULL,   -- email for credential provider
  password        TEXT,            -- bcrypt-hashed
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE auth_verification (
  id           TEXT PRIMARY KEY,
  identifier   TEXT NOT NULL,      -- email
  value        TEXT NOT NULL,      -- token
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
```

**Relationship to the `users` table from `SCHEMA.md`:** `auth_user` is better-auth's identity table; the app's `users` table holds the profile (bio, etc.). They share the same `id` (better-auth's user ID becomes the app's user ID). A `users` row is created via a better-auth hook on signup completion — see "Hooks" below.

This is technically two user rows per identity. Acceptable trade-off: keeps better-auth's schema un-customized (easier upgrades) and keeps the app's profile schema un-coupled (clean separation). Alternative: tell better-auth to use the `users` table directly — supported, but ties us to its column conventions.

---

## Flow mappings

| Current flow | Firebase call | better-auth call |
|---|---|---|
| Signup | `createUserWithEmailAndPassword` + `updateProfile` + `sendEmailVerification` | `auth.api.signUpEmail({ email, password, name })` |
| Login | `signInWithEmailAndPassword` | `auth.api.signInEmail({ email, password })` |
| Logout | `signOut()` | `auth.api.signOut()` |
| Resend verification | `sendEmailVerification(currentUser)` | `auth.api.sendVerificationEmail({ email })` |
| Auth state | `onAuthStateChanged` listener | Client fetches `/api/auth/get-session` on mount; SWR/React Query for cache |

### Auth state subscription pattern

Firebase's `onAuthStateChanged` is push-based. better-auth's session is request-response. The pattern in `AuthContext.tsx` becomes:

```ts
// On mount and after every auth action:
const { data: session } = useSession();  // better-auth hook
// session.user has { id, email, name, emailVerified }
```

Session changes (login, logout) trigger re-fetch via the better-auth hook automatically. The push model isn't preserved — but it doesn't need to be; the only events that matter (login, logout) happen via user-initiated actions in this app, not background sync.

---

## Replacing the Auth `onCreate` Cloud Function

`sendVerificationEmail` (`functions/src/emailFunctions.ts:24`) fires automatically when a Firebase Auth user is created. better-auth has explicit lifecycle hooks for this:

```ts
// Worker setup
import { betterAuth } from 'better-auth';

const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      // Render template + send via Resend (see EMAIL.md)
      await sendTemplatedEmail('verify-email', user.email, { VERIFICATION_LINK: url });
    },
  },
  hooks: {
    afterSignUp: async ({ user }) => {
      // Replaces Firebase signup's "create Firestore profile + initial pledge" logic
      await db.insert(users).values({
        id: user.id,
        email: user.email,
        display_name: user.name,
        bio: '',
        email_verified: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      // Initial pledge record
      await db.insert(pledges).values({
        id: nanoid(),
        user_id: user.id,
        amount: 0,
        pledged_at: Date.now(),
        is_active: 1,
      });
    },
  },
});
```

The Auth `onCreate` Cloud Function disappears. Its work moves into the `afterSignUp` hook, which runs in the Worker request that processed the signup. **Stronger guarantee than Firebase**: signup either completes fully (auth + profile + pledge) or rolls back — better-auth wraps the hook in a transaction.

---

## Admin detection migration

The current pattern (`src/lib/admin.ts`):
- Hardcoded `SUPER_ADMIN_EMAIL = 'christopher@corella.com'`
- Plus subscribed `admins` collection

New pattern:
- Hardcoded super-admin stays in `src/lib/admin.ts` — same line, no change.
- `subscribeToAdmins` becomes a WS subscription to `AdminDO` (per `REALTIME.md`). Same callback shape; UI unchanged.
- Server-side admin checks (Worker routes that require admin) use a helper: `requireAdmin(ctx)` that reads the session, looks up the email, checks against super-admin OR queries `admins` table.

**Security improvement over current:** Firestore rules are the only thing enforcing admin-only writes today (and they live outside the repo — see `MEMORY.md`). Post-migration, every admin-only Worker route explicitly calls `requireAdmin()`. The check is in code, version-controlled, reviewable.

---

## Banned emails

Current: `subscribeToBannedEmails` returns a `Set<string>`; `AuthContext` blocks signup attempts client-side.

New: client-side check stays (UX — fast error). **Plus** a server-side check in the better-auth `beforeSignUp` hook:

```ts
hooks: {
  beforeSignUp: async ({ user }) => {
    const banned = await db.select().from(bannedEmails).where(eq(bannedEmails.email, user.email)).get();
    if (banned) throw new APIError('FORBIDDEN', 'This email is banned');
  },
}
```

Server-side check closes the hole where a hostile client could bypass the UI check. Another small security win.

---

## Migration of existing user identities

**Not applicable — fresh start.** Per user decision 2026-05-20, no existing users carry over from Firebase. The `auth_user` table starts empty. First user to sign up post-cutover becomes the first record.

This removes the entire scrypt → bcrypt bridging problem (and ~half a day of implementation). The original Firebase Auth users are abandoned with Firebase itself.

The super-admin (`christopher@corella.com`) signs up like anyone else; `src/lib/admin.ts` recognizes the hardcoded address and grants admin privileges automatically on first login.

---

## Files that change

- `src/contexts/AuthContext.tsx` — `onAuthStateChanged` → `useSession()`; signup/login/logout call better-auth client SDK
- `src/lib/admin.ts` — keep `SUPER_ADMIN_EMAIL`; `isAdmin()` now reads from session instead of Firebase user
- `src/lib/firebase.ts` — auth bits removed (Firestore bits also gone per other docs)
- New: `src/lib/auth.ts` — better-auth client SDK setup
- New: `workers/src/auth.ts` — server-side better-auth configuration with D1 adapter
- New: `workers/src/auth-hooks.ts` — beforeSignUp / afterSignUp implementations

---

## Resolved decisions

- **Session cookie domain: apex only (`renodevspace.org`).** Per user decision 2026-05-20. Cookie does not carry to subdomains. Configured via `cookieOptions: { domain: 'renodevspace.org' }` in better-auth setup. If subdomains are added later that need shared auth (e.g., `admin.renodevspace.org`), revisit then.

## Open questions

1. **CSRF on auth routes.** better-auth handles this internally with a state token on its routes. Confirm it works through the Cloudflare Pages → Worker routing path. Likely fine; verify during implementation.
2. **Rate limiting on login attempts.** Not in better-auth core; Cloudflare's Rate Limiting Rules (free tier on the dashboard) can cover this for `/api/auth/sign-in/*` paths. Configured per `FUNCTIONS.md` routing table.
