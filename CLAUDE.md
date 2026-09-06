# CLAUDE.md

## Project Overview

A website for a non-profit game developer space in Reno. Features a canvas-based text editor, a rental property gallery, persistent community chat, and a campaign/donation system. GitHub Pages static site backed entirely by Firebase.

## Tech Stack

- **Frontend**: Next.js 14 with static export (`output: 'export'`)
- **Hosting**: GitHub Pages (cwcorella-git.github.io/reno-dev-space)
- **Database**: Firebase Firestore (database name: `main`, NOT default)
- **Auth**: Firebase Auth (Email/Password)
- **Storage**: Firebase Storage (property images)
- **Payments**: Stripe (via Firebase Cloud Functions)
- **Email**: Nodemailer via Cloud Functions (4 HTML templates)
- **Icons**: Heroicons (`@heroicons/react`)
- **Testing**: Playwright (E2E, 14 spec files)

## Architecture

Real-time updates via Firestore `onSnapshot` subscriptions throughout. No global state library — React Context API only.

Provider nesting order (`layout.tsx`):
```
AuthProvider → ContentProvider → CanvasProvider → PresenceProvider
```

**Firestore collections** (all on the `main` database — never the default): 15 collections
(`canvasBlocks`, `rentalProperties`, `chatMessages`, `siteContent`, `users`, `pledges`,
`donations`, `settings`, `admins`, `bannedEmails`, `deletedBlocks`, `blockEdits`,
`presence`, `emailTemplates`, `emailHistory`). Schemas: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Admin System

### Super Admin
Hardcoded email: `christopher@corella.com` (in `src/lib/admin.ts`). Can never be demoted.

### Multi-Admin
Dynamic admin emails in `admins` Firestore collection. `AuthContext` subscribes in real-time.

### Admin capabilities

Full list, admin scripts, and moderation procedures: [docs/ADMIN.md](docs/ADMIN.md).
**Pledged users** can also add text blocks and vote.

## Key Files

Full annotated repository layout: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) appendix.
Anchors: provider chain in `src/app/layout.tsx`; one Firestore CRUD module per collection
in `src/lib/storage/`; Cloud Functions in `functions/src/`; admin scripts in `scripts/`.

## Canvas Constants

```typescript
DESIGN_WIDTH = 1440      // Base canvas width (px)
DESIGN_HEIGHT = 900      // One "screen" of content (px)
BANNER_HEIGHT = 56       // Fixed top banner height (px)
MOBILE_SAFE_ZONE = 375   // Mobile viewport target (px)
DESKTOP_FOCUS_WIDTH = 900 // Desktop content area (px)
OVERFLOW_LEFT = 10       // Blocks may extend 10% past left edge
OVERFLOW_RIGHT = 10      // Blocks may extend to 110% right
// All block positions stored as percentages (x: 0–100, y: can exceed 100 for scroll)
```

## Environment Variables

Full tables (`.env.local` Firebase keys, Cloud Functions secrets, build-time vars):
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Missing `NEXT_PUBLIC_FIREBASE_*` fails only at
runtime, not build — a green build is not proof the env is right.

## Development Commands

```bash
npm run dev       # Dev server at localhost:3000 (basePath '' in dev, '/reno-dev-space' in prod)
npm run build     # Static export to out/
npm run lint      # Run ESLint
git push          # GitHub Actions deploys to GitHub Pages (main branch)

# Firebase Cloud Functions
cd functions && npm run build    # Compile TypeScript
cd functions && npm run deploy   # Deploy functions to Firebase

# Admin scripts (require scripts/serviceAccountKey.json) — see docs/ADMIN.md

# E2E Tests
npx playwright install chromium    # First time only
npx playwright test
npx playwright test --headed       # See browser
npx playwright test tests/property-voting.spec.ts  # Single file
```

See [STRIPE_GO_LIVE.md](STRIPE_GO_LIVE.md) for payment go-live instructions.

## Key Patterns

### Coordinate System
All block/property positions stored as **percentages**:
- `x`: 0–100 of `DESIGN_WIDTH` (1440px)
- `y`: 0–100+ of `DESIGN_HEIGHT` (900px, unbounded for scroll)
- Rendered as `left: ${x}%` / `top: ${(y / 100) * DESIGN_HEIGHT}px`

See [docs/MEASUREMENT.md](docs/MEASUREMENT.md) for the full measurement and collision detection system.

### Firebase `main` Database
Always use the `main` named database — **not the default**. Configured in `src/lib/firebase.ts`.

### Voting System
- Brightness range: 0–100 (default 50); text blocks deleted at 0; properties archived at ≤ 20
- Each vote: ±5 brightness; opacity maps to brightness (0.2–1.0)
- Tracking: `votersUp[]` / `votersDown[]` arrays (legacy `voters[]` still supported)
- **Behavior**: Same-direction vote button is **disabled** (no-op). Opposite-direction button removes existing vote.
- Only upvotes trigger celebration animations

### Jitter Prevention (`pendingPosRef` pattern)
After drag end, store the optimistic position in a `ref`. Clear the ref only when Firestore confirms the new position matches. Prevents revert flash when the snapshot fires. Used in `CanvasBlock.tsx` and `PropertyGallery.tsx`.

### Canvas Height
Grow-only floor with 300ms debounce — height grows immediately when blocks extend down, shrinks only after a delay. Prevents scroll jitter from measurement double-changes.

### Content CMS
```tsx
// For visible DOM elements:
<EditableText id="intro.hint.title" defaultValue="Welcome" category="intro" />

// For string attributes (placeholders, aria-labels, etc.):
placeholder={getText('auth.placeholder.email', 'you@example.com')}
```
All keys must be registered in `DEFAULT_CONTENT` in `ContentTab.tsx`. Admin uses Ctrl+click to edit any `<EditableText>` inline.

### Undo/Redo
Session-only history (max 50 steps, Ctrl+Z / Ctrl+Y). Before-snapshots captured immediately; after-snapshots captured lazily during undo to avoid Firestore timing issues. Covers: add, delete, move, resize, style, content, vote. Batch operations produce one undo step.

### 3-Tier Responsive Scaling
1. Mobile (<500px): zoom to 375px safe zone (`scale = viewportWidth / 375`)
2. Tablet (500–900px): smooth interpolation
3. Desktop (>900px): cap at 1.2× scale, center on 900px focus area

## Panel Structure & Keyboard Shortcuts

Tab/icon layout and the full shortcut table: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
appendix. Admin-only surfaces: Content, Campaign, Emails, History.

## Documentation Index

- [docs/README.md](docs/README.md) — full documentation index
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, Firestore schemas, data flows
- [docs/PROPERTIES.md](docs/PROPERTIES.md) — rental property gallery feature
- [docs/MEASUREMENT.md](docs/MEASUREMENT.md) — coordinate system, collision detection
- [docs/EMAIL_SYSTEM.md](docs/EMAIL_SYSTEM.md) — email templates, Cloud Functions, sending
- [docs/TESTING.md](docs/TESTING.md) — Playwright test suite (14 specs)
- [docs/ADMIN.md](docs/ADMIN.md) — admin scripts, user management, moderation
- [docs/BACKUP.md](docs/BACKUP.md) — backup/restore procedures
- [docs/SECURITY.md](docs/SECURITY.md) — Firestore rules, auth, permissions
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — build process, GitHub Pages, CI/CD
- [STRIPE_GO_LIVE.md](STRIPE_GO_LIVE.md) — Stripe payment go-live guide
- [EMAIL_SETUP.md](EMAIL_SETUP.md) — email system quick-start
