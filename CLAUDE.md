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

**Firestore Collections** (all on `main` database):

| Collection | Purpose |
|------------|---------|
| `canvasBlocks` | Text blocks on the canvas |
| `rentalProperties` | Rental property gallery entries |
| `chatMessages` | Community chat (last 100 messages) |
| `siteContent` | Content CMS (80+ text keys) |
| `users` | User profiles |
| `pledges` | Backer pledge records |
| `donations` | Stripe donation records (created by webhook) |
| `settings` | Campaign settings (doc: `campaign`) |
| `admins` | Dynamic admin emails (email as doc ID) |
| `bannedEmails` | Banned email addresses (email as doc ID) |
| `deletedBlocks` | Deletion audit log |
| `blockEdits` | Content edit history |
| `presence` | Live cursor positions (30s TTL) |
| `emailTemplates` | Editable HTML email templates |
| `emailHistory` | Sent email audit log |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed schemas.

## Admin System

### Super Admin
Hardcoded email: `christopher@corella.com` (in `src/lib/admin.ts`). Can never be demoted.

### Multi-Admin
Dynamic admin emails in `admins` Firestore collection. `AuthContext` subscribes in real-time.

### Admin Capabilities
- Add/edit/delete/resize/reposition canvas text blocks
- Position and manage rental property gallery
- Ctrl+click any EditableText to edit inline
- Start/stop campaign timer, set funding goal, lock/unlock editing
- Send campaign email updates to backers; edit HTML email templates (EmailsPanel)
- Undo/redo, copy/paste, multi-select blocks
- Delete/ban/promote users (Members tab)
- Dismiss block reports, view deletion/edit history (History panel)
- Use Measurement Overlay for collision debugging (dev tool)

**Pledged users** can also add text blocks and vote.

See [docs/ADMIN.md](docs/ADMIN.md) for admin scripts and moderation procedures.

## Key Files

```
src/
├── app/
│   ├── layout.tsx              # Root layout + provider chain
│   ├── page.tsx                # Main page (Canvas + VersionTag)
│   └── globals.css             # Tailwind + vote effect animations + font CSS vars
├── components/
│   ├── canvas/                 # Canvas.tsx, CanvasBlock.tsx, TextBlockRenderer.tsx,
│   │                           # CursorPresence.tsx, CelebrationOverlay.tsx
│   ├── chat/                   # MessageList.tsx, MessageInput.tsx
│   ├── panel/                  # UnifiedPanel.tsx, EditorTab.tsx, ChatTab.tsx,
│   │                           # MembersTab.tsx, EmailsPanel.tsx, EmailHtmlEditor.tsx,
│   │                           # EmailVariableEditor.tsx, ContentPanel.tsx, ContentTab.tsx,
│   │                           # CampaignPanel.tsx, CampaignUpdateModal.tsx,
│   │                           # HistoryPanel.tsx, HistoryTab.tsx, ProfilePanel.tsx,
│   │                           # DonateTab.tsx
│   ├── property/               # PropertyGallery.tsx, PropertyCarousel.tsx, PropertyCard.tsx,
│   │                           # PropertyVoteControls.tsx, GalleryPositionSlider.tsx,
│   │                           # AddPropertyModal.tsx
│   ├── dev/                    # MeasurementOverlay.tsx (admin debug tool)
│   └── (root)                  # AuthModal.tsx, CampaignBanner.tsx, DonateModal.tsx,
│                               # EditableText.tsx, IntroHint.tsx, VersionTag.tsx
├── contexts/                   # AuthContext, CanvasContext, ContentContext,
│                               # EffectsContext, PresenceContext
├── hooks/                      # useDragResize.ts, useFirestoreChat.ts
├── lib/
│   ├── measurement/            # MeasurementService.ts, CollisionDetector.ts, types.ts
│   ├── storage/                # 16 Firestore CRUD modules (one per collection)
│   └── (root)                  # admin.ts, emailFunctions.ts, firebase.ts,
│                               # permissions.ts, sanitize.ts, selectionFormat.ts,
│                               # voteEffects.ts,
│                               # overlapDetection.ts (legacy — replaced by measurement/)
└── types/                      # canvas.ts, property.ts

functions/src/
├── index.ts                    # Stripe checkout/webhook + email function exports
├── email.ts                    # Template loader, SMTP sender, helper queries
└── emailFunctions.ts           # 5 callable/triggered email functions

scripts/
├── backup-firestore.js         # Export all Firestore collections + Auth users
├── restore-firestore.js        # Restore from backup (supports --dry-run, --collection)
├── migrate-users.js            # Sync Firebase Auth users → Firestore users collection
├── delete-user.js              # Cascade-delete a user by email
├── randomize-fonts.js          # Randomize fonts for all existing canvas blocks
└── add-blueprint-keywords.mjs  # Seed predefined community keyword blocks on canvas

email-templates/                # 4 HTML templates (verify-email, campaign-success,
                                # campaign-ended, campaign-update)
tests/                          # 14 Playwright E2E spec files
docs/                           # Detailed documentation (see docs/README.md)
```

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

Required in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FUNCTIONS_URL=       # Optional, defaults to Cloud Functions URL
```

Cloud Functions secrets (set via `firebase functions:secrets:set`):
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
email.host / email.port / email.user / email.pass   # nodemailer SMTP config
```

Build-time env vars (injected by GitHub Actions / next.config.js):
```
NEXT_PUBLIC_COMMIT_SHA        # Git commit hash for VersionTag
NEXT_PUBLIC_BUILD_TIME        # Build timestamp
```

## Development Commands

```bash
npm run dev       # Dev server at localhost:3000 (basePath '' in dev, '/reno-dev-space' in prod)
npm run build     # Static export to out/
npm run lint      # Run ESLint
git push          # GitHub Actions deploys to GitHub Pages (main branch)

# Firebase Cloud Functions
cd functions && npm run build    # Compile TypeScript
cd functions && npm run deploy   # Deploy functions to Firebase

# Admin scripts (require scripts/serviceAccountKey.json)
node scripts/backup-firestore.js                          # Backup all data
node scripts/restore-firestore.js <path> [--dry-run]      # Restore from backup
node scripts/restore-firestore.js <path> --collection X   # Restore single collection
node scripts/migrate-users.js                             # Sync Auth → Firestore
node scripts/delete-user.js                               # Delete user by email (cascade)
node scripts/randomize-fonts.js                           # Randomize canvas block fonts
node scripts/add-blueprint-keywords.mjs                   # Seed canvas keywords

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

## Panel Structure

```
[ Editor ] [ Chat ● ] [ Members ] [ Profile ]    [📝] [📊] [📧] [🕐] [˅]
←──────── tabs ──────────────────→              ←── admin icons ──────────→
```

| Tab / Icon | Content |
|------------|---------|
| **Editor** | Block styling (font, size, color, B/I/U/S, alignment, link) |
| **Chat** | Real-time community chat (green dot = connected) |
| **Members** | User directory + admin: delete, ban/unban, promote/demote |
| **Profile** | User info, pledge, account actions, sign out |
| **Content** 📝 | CMS for 80+ UI text keys (admin-only) |
| **Campaign** 📊 | Timer, goal, lock, reset votes (admin-only) |
| **Emails** 📧 | Email template editor + send campaign updates (admin-only) |
| **History** 🕐 | Deletion + edit history; restore or delete (admin-only) |

## Keyboard Shortcuts

| Shortcut | Context | Action |
|----------|---------|--------|
| Space | Canvas selection | Vote up |
| Alt | Canvas selection | Vote down |
| Delete / Backspace | Canvas selection | Delete own blocks |
| Ctrl+A | Canvas | Select all blocks |
| Ctrl+Z | Canvas | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Canvas | Redo |
| Ctrl+C / Ctrl+V | Canvas | Copy / Paste at cursor |
| Escape | Canvas | Deselect / exit add-text mode |
| Ctrl+B / I / U | Text editing | Bold / Italic / Underline |
| Escape | Text editing | Save and exit |
| Ctrl+click | EditableText | Open inline CMS editor (admin) |

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
