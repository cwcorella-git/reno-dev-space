# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A website for a non-profit game developer space in Reno. Features a canvas-based editor where users can place text and voteable content, plus a persistent community chat.

## Tech Stack

- **Frontend**: Next.js 14 with static export (`output: 'export'`)
- **Hosting**: GitHub Pages (cwcorella-git.github.io/reno-dev-space)
- **Database**: Firebase Firestore (database name: `main`, NOT default)
- **Auth**: Firebase Auth (Email/Password)
- **Payments**: Stripe (via Firebase Cloud Functions)
- **Icons**: Heroicons (`@heroicons/react`)
- **Testing**: Playwright (E2E)

## Architecture

Everything is Firestore-based with real-time updates via `onSnapshot`:
- Canvas blocks stored in `canvasBlocks` collection
- Chat messages stored in `chatMessages` collection
- Site content (CMS) stored in `siteContent` collection
- User data stored in `users` collection
- Pledges stored in `pledges` collection
- Campaign settings stored in `settings` collection (doc: `campaign`)
- Donations stored in `donations` collection (created by Stripe webhook)
- No external servers needed (except Stripe webhooks via Cloud Functions)

## Admin

Admin is identified by email: `christopher@corella.com` (hardcoded in `src/lib/admin.ts`)

Admin can:
- Use "Add Text" button (or right-click context menu) to add text blocks
- Double-click text to edit
- Drag blocks to reposition (optimistic UI with Firestore confirmation)
- Resize blocks via corner/edge handles (8 directions)
- Style text (font family, size, color, alignment, bold, italic, underline, strikethrough)
- Ctrl+click any EditableText to edit site content inline
- Access Content panel (pencil icon) for CMS and Campaign panel (chart icon) for controls
- Start/stop campaign timer, set funding goal, lock/unlock editing
- Undo/redo changes (Ctrl+Z / Ctrl+Y), copy/paste blocks (Ctrl+C / Ctrl+V)

**Note**: Pledged users (backers) can also add text blocks via the "Add Text" button.

## Key Files

```
src/
├── app/
│   ├── layout.tsx            # Root layout with providers (Auth, Canvas, Content)
│   ├── page.tsx              # Main page (renders Canvas + VersionTag)
│   └── globals.css           # Tailwind + custom styles + font CSS variables
├── components/
│   ├── canvas/
│   │   ├── Canvas.tsx            # Main canvas + right-click menu + marquee select + add text mode
│   │   ├── CanvasBlock.tsx       # Draggable/resizable block wrapper + pendingPosRef jitter fix
│   │   └── TextBlockRenderer.tsx # Text display + inline editing + Ctrl+B/I/U shortcuts
│   ├── panel/
│   │   ├── UnifiedPanel.tsx      # Main panel with 4 tabs + admin icons
│   │   ├── EditorTab.tsx         # Block styling controls (font, size, color, align, B/I/U/S)
│   │   ├── ChatTab.tsx           # Real-time chat messages
│   │   ├── MembersTab.tsx        # User directory with stats
│   │   ├── CommunityTab.tsx      # Chat/Members subtab toggle (legacy, not used by panel)
│   │   ├── DonateTab.tsx         # Stripe donation flow (used by DonateModal only)
│   │   ├── ProfilePanel.tsx      # User info, pledge, account actions
│   │   ├── ContentPanel.tsx      # Content CMS wrapper (admin-only)
│   │   ├── ContentTab.tsx        # CMS for UI text with 80+ registered keys
│   │   └── CampaignPanel.tsx     # Campaign controls + member count + stats (admin-only)
│   ├── chat/
│   │   ├── MessageList.tsx       # Chat message display
│   │   └── MessageInput.tsx      # Chat input field
│   ├── AuthModal.tsx             # Login/signup modal
│   ├── CampaignBanner.tsx        # Always-visible banner (inert teaser or active campaign)
│   ├── DonateModal.tsx           # Stripe checkout modal (opened from campaign banner)
│   ├── EditableText.tsx          # Inline editable text (ctrl+click for admin)
│   ├── IntroHint.tsx             # Intro card for visitors (Heroicons)
│   └── VersionTag.tsx            # Git commit hash display
├── contexts/
│   ├── AuthContext.tsx           # Firebase auth state + user profile
│   ├── CanvasContext.tsx         # Canvas blocks state + selection + isAddTextMode + undo/redo
│   └── ContentContext.tsx        # Site content CMS state + getText() + updateText()
├── hooks/
│   ├── useDragResize.ts          # Drag/resize logic for blocks (8-direction handles)
│   └── useFirestoreChat.ts       # Chat hook with Firestore
├── lib/
│   ├── firebase.ts               # Firebase init (uses 'main' database)
│   ├── admin.ts                  # Admin email check
│   ├── campaignStorage.ts        # Firestore ops for campaign settings
│   ├── canvasStorage.ts          # Firestore ops for canvas blocks + voting + brightness
│   ├── chatStorage.ts            # Firestore ops for chat messages
│   ├── contentStorage.ts         # Firestore ops for site content CMS
│   ├── overlapDetection.ts       # Block collision detection for Add Text
│   ├── permissions.ts            # Block edit permission checks
│   ├── pledgeStorage.ts          # Firestore ops for pledges
│   ├── sanitize.ts               # Input sanitization utilities (HTML + inline styles)
│   ├── selectionFormat.ts        # Multi-select formatting + inline tag wrapping
│   └── userStorage.ts            # Firestore ops for user profiles + cascade delete
└── types/
    └── canvas.ts                 # TextBlock, CanvasBlock, TextStyle types + 12 font vars

functions/
├── src/index.ts                  # Stripe checkout + webhook handlers
└── package.json                  # Node 20, firebase-functions, stripe

scripts/
├── migrate-users.js              # Sync Firebase Auth users to Firestore
├── delete-user.js                # Delete a user by email (cascade)
└── randomize-fonts.js            # Randomize fonts for all existing blocks

tests/
└── drag-jitter.spec.ts           # Playwright E2E test for drag behavior
```

## Canvas Constants

```typescript
DESIGN_WIDTH = 1440    // Base canvas width (px)
DESIGN_HEIGHT = 900    // One "screen" of content (px)
BANNER_HEIGHT = 56     // Fixed top banner height (px)
MOBILE_SAFE_ZONE = 375 // Mobile viewport target (px)
DESKTOP_FOCUS_WIDTH = 900 // Desktop content area (px)
// All block positions use percentages (0-100) for responsive scaling
// Canvas height extends dynamically based on lowest block
```

## Firestore Collections

### `canvasBlocks`
```typescript
{
  id: string
  type: 'text'
  x: number             // percentage 0-100
  y: number             // percentage 0-100
  width: number         // percentage
  height: number        // 0 = auto-fit content
  zIndex: number
  content: string
  style: {
    fontSize: number      // rem
    fontWeight: 'normal' | 'bold'
    fontStyle: 'normal' | 'italic'
    textDecoration: 'none' | 'underline' | 'line-through'
    fontFamily: string    // CSS variable (see Font System below)
    color: string         // hex
    textAlign: 'left' | 'center' | 'right'
    backgroundColor?: string
    marquee?: boolean     // scrolling text effect (defined but not rendered)
  }
  brightness: number    // 0-100, votes affect this (default: 50)
  voters: string[]      // user IDs who have voted
  createdBy: string
  createdAt: number
  updatedAt: number
}
```

### `chatMessages`
```typescript
{
  id: string
  room: string          // e.g., 'community'
  text: string
  username: string
  odId: string          // Firebase user ID
  timestamp: number
}
```

### `siteContent`
```typescript
{
  id: string            // e.g., 'intro.hint.title'
  value: string         // The actual text content
  category: string      // For grouping: 'intro', 'auth', 'panel', 'editor', 'chat', 'members', 'donate', 'profile', 'campaign', 'canvas'
  description?: string
  updatedAt: number
  updatedBy: string     // uid of last editor
}
```

### `users`
```typescript
{
  uid: string
  email: string
  displayName: string
  bio?: string
  createdAt: number
}
```

### `pledges`
```typescript
{
  odId: string          // Firebase user ID
  displayName: string   // user's display name
  amount: number        // pledge amount in dollars
  createdAt: number
  updatedAt: number
}
```

### `settings` (doc: `campaign`)
```typescript
{
  timerStartedAt: number | null   // timestamp when countdown began
  timerDurationMs: number         // milliseconds (default: 2 weeks)
  fundingGoal: number             // dollar amount
  isLocked: boolean               // prevents block editing when true
  pageViews: number               // analytics counter
}
```

### `donations` (created by Stripe webhook)
```typescript
{
  sessionId: string               // Stripe checkout session ID
  userId: string | null           // Firebase user ID if logged in
  displayName: string             // 'Anonymous' if not logged in
  amount: number                  // dollars
  email: string | null
  status: 'completed'
  createdAt: Timestamp
}
```

## Font System

12 Google Fonts loaded via Next.js and mapped to CSS variables:

| Variable | Font |
|----------|------|
| `var(--font-inter)` | Inter |
| `var(--font-jetbrains-mono)` | JetBrains Mono |
| `var(--font-space-grotesk)` | Space Grotesk |
| `var(--font-exo-2)` | Exo 2 |
| `var(--font-orbitron)` | Orbitron |
| `var(--font-quicksand)` | Quicksand |
| `var(--font-playfair)` | Playfair Display |
| `var(--font-lora)` | Lora |
| `var(--font-oswald)` | Oswald |
| `var(--font-anton)` | Anton |
| `var(--font-bebas-neue)` | Bebas Neue |
| `var(--font-caveat)` | Caveat |

New blocks receive a random font and color from `TEXT_FONTS` and `TEXT_COLORS` arrays in `src/types/canvas.ts`.

## Environment Variables

Required in `.env.local` (and GitHub Actions secrets):
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FUNCTIONS_URL=          # Optional, defaults to https://us-central1-reno-dev-space.cloudfunctions.net
```

## Firestore Rules

Rules must be set on the `main` database (not default). Pattern: public read, authenticated write for all collections.

## Development Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Creates static export in 'out/'
npm run lint     # Run ESLint
git push         # GitHub Actions deploys to Pages (main branch)
```

**Important**: The app uses `basePath: '/reno-dev-space'` in production. Local dev server runs at root `/`.

### Firebase Cloud Functions

```bash
cd functions
npm run build         # Compile TypeScript
npm run deploy        # Deploy functions to Firebase
```

Functions require environment variables in Firebase:
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

### Admin Scripts

```bash
# Sync Firebase Auth users to Firestore (requires serviceAccountKey.json)
node scripts/migrate-users.js

# Delete a user by email
node scripts/delete-user.js

# Randomize fonts for all existing blocks
node scripts/randomize-fonts.js
```

### Playwright E2E Tests

```bash
npx playwright install chromium    # Install browser (first time)
npx playwright test                # Run tests
```

## Features

- **Canvas Editor**: Admin/pledged users can add text blocks, drag to reposition, resize via 8 handles
- **Add Text Mode**: Cursor-following preview shows placement validity (green = valid, red = overlapping). Shows "Click to place" on desktop, "Tap to place" on mobile. Text cannot overlap existing blocks.
- **Voting**: Brightness-based voting; each vote changes brightness by ±5, block deleted at 0
- **Chat**: Persistent community chat using Firestore (last 100 messages)
- **Real-time**: All changes sync instantly across clients via Firestore listeners
- **Content CMS**: Admin can ctrl+click any EditableText to edit inline; 80+ keys registered in ContentTab
- **Campaign System**: Three states — inert teaser (member count), active (timer + progress + donate), expired (locked)
- **Multi-select**: Ctrl+click or marquee drag to select multiple blocks for batch editing
- **Undo/Redo**: Session-only history (Ctrl+Z / Ctrl+Y), max 50 entries
- **Copy/Paste**: Session-only clipboard (Ctrl+C / Ctrl+V), pastes at cursor position
- **Inline Formatting**: Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline) while editing text
- **Drag Jitter Fix**: `pendingPosRef` pattern holds optimistic position until Firestore confirms update

## Panel Structure

The bottom panel has 4 tabs on left + icon buttons on right:

```
[ Editor ] [ Chat ● ] [ Members ] [ Profile ]    [📝] [📊] [˅]
←──────────── tabs ─────────────→                ←─ icons ─→
```

**Left side (tabs):**
| Tab | Content |
|-----|---------|
| **Editor** | Block styling (font, size, color, alignment, bold/italic/underline/strikethrough) |
| **Chat** | Real-time community chat (green dot = connected) |
| **Members** | User directory with blocks, votes, pledge, join date |
| **Profile** | User info, pledge, account actions, sign out |

**Right side (icons):**
| Icon | Content |
|------|---------|
| **Content** (pencil, amber) | Content CMS for UI text (admin-only) |
| **Campaign** (chart, amber) | Timer, lock, goal, member count, stats (admin-only) |
| **Collapse** (chevron) | Minimize/expand panel |

**Donate**: Not a panel tab. Donations are accessed via the campaign banner's Donate button (only visible during active campaign).

## Keyboard Shortcuts

### Canvas (when blocks are selected)
| Shortcut | Action |
|----------|--------|
| Space | Vote up (brighten block) |
| Alt | Vote down (dim block) |
| Delete / Backspace | Delete selected blocks (own blocks only) |
| Ctrl+A | Select all blocks |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+C | Copy selected blocks |
| Ctrl+V | Paste blocks at cursor |
| Escape | Deselect / exit add text mode |

### Text Editing (when editing a block)
| Shortcut | Action |
|----------|--------|
| Ctrl+B | Bold (inline) |
| Ctrl+I | Italic (inline) |
| Ctrl+U | Underline (inline) |
| Escape | Save and exit editing |

### CMS (EditableText)
| Shortcut | Action |
|----------|--------|
| Ctrl+click | Open inline editor (admin) |
| Enter | Save edit |
| Escape | Cancel edit |

## Voting System

- Default brightness: 50 (scale 0-100)
- Each vote changes brightness by ±5
- Opacity maps to brightness: 0% → 0.2 opacity, 100% → 1.0 opacity
- Block deleted when brightness reaches 0
- Each user can only vote once per block (tracked in `voters` array)

## Mobile Interactions

- Touch-and-hold (300ms) to start dragging blocks (with haptic feedback)
- Tap to select, double-tap to edit
- Canvas zooms to fit viewport (375px mobile safe zone)
- "Tap to place" message in Add Text mode
- Three responsive breakpoints: mobile (<500px), tablet (500-900px), desktop (>900px)

## Content CMS System

Two patterns for making text admin-editable:

1. **`<EditableText>`** — For visible DOM elements (labels, buttons, headings):
   ```tsx
   <EditableText id="auth.button.signup" defaultValue="Create Account" category="auth" />
   ```

2. **`getText()`** — For string attributes (placeholders, error messages):
   ```tsx
   placeholder={getText('auth.placeholder.email', 'you@example.com')}
   ```

All content keys must be registered in `DEFAULT_CONTENT` array in `ContentTab.tsx` to appear in the admin Content panel. Currently 80+ keys across 10 categories: intro, auth, panel, editor, chat, members, donate, profile, campaign, canvas.

## Campaign System

### Three States

1. **Inert** (no timer started):
   - Banner always visible with muted slate gradient
   - Shows member count progress: "A campaign is brewing... X/5 members"
   - Shifts to emerald when threshold (5 members) reached: "We're ready to launch!"

2. **Active** (timer running):
   - Banner shows countdown timer + progress bar + Donate button
   - Single row: Timer | Progress bar + goal | Donate
   - Lists top 12 backers below progress bar

3. **Expired** (timer hit 0 or manually locked):
   - Shows "GOAL!" (if funded) or "Complete"
   - Auto-locks canvas editing
   - Donate button hidden

### Admin Controls (Campaign Panel)
- **Start Timer**: Begins 2-week countdown (shows member count threshold warning)
- **Reset Timer**: Stops and clears countdown
- **Set Goal**: Update funding target
- **Lock/Unlock**: Prevent/allow block editing
- **Reset Brightness**: Reset all blocks to default brightness

## User Account Deletion

Full cascade when user deletes account (via ProfilePanel):
1. Clears all votes from `voters` arrays
2. Deletes all blocks created by user
3. Deletes all chat messages by user
4. Deletes pledge record
5. Deletes user profile
6. Deletes Firebase Auth account

## Block Permissions

- Admin can edit any block
- Regular users can only edit blocks they created (`createdBy` matches their UID)
- Multi-select filters to only show editable blocks in count
- Locked campaign prevents all block modifications

## Stripe Integration

### Current Status: Test Mode (Sandbox)

Using Veritable Games Stripe account (`acct_1SVgXvFEu0YOwlhj`) for Reno Dev Space donations.

### Go-Live Checklist

When ready to accept real payments:

1. **Stripe Dashboard Setup**
   - [ ] Toggle OFF "Test mode" in Stripe Dashboard (top-right)
   - [ ] Complete account verification (business details, bank account, identity)
   - [ ] Update public business name to "Reno Dev Space" (Settings → Public details)
   - [ ] Configure branding colors to match site theme

2. **Get Live API Keys**
   - Go to Stripe Dashboard → Developers → API keys (with Test mode OFF)
   - Copy the live secret key (`sk_live_...`)

3. **Update Firebase Secrets**
   ```bash
   # Set live secret key (no trailing newlines!)
   printf "sk_live_YOUR_KEY" | firebase functions:secrets:set STRIPE_SECRET_KEY

   # Redeploy functions
   firebase deploy --only functions
   ```

4. **Set Up Live Webhook**
   - Stripe Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://us-central1-reno-dev-space.cloudfunctions.net/stripeWebhook`
   - Events: `checkout.session.completed`
   - Copy signing secret, then:
   ```bash
   printf "whsec_YOUR_WEBHOOK_SECRET" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   firebase deploy --only functions
   ```

5. **Test with Real Card**
   - Make a small donation ($1) to verify the full flow
   - Check Stripe Dashboard for the payment
   - Verify webhook fires and donation appears in Firestore

### Stripe CLI Commands

```bash
stripe login                    # Authenticate
stripe logs tail                # Live API logs (great for debugging)
stripe listen --forward-to ...  # Forward webhooks to local dev
stripe trigger checkout.session.completed  # Test webhook events
stripe open settings            # Open Stripe Dashboard settings
```

### Stripe Connect (Separate Branding)

To show "Reno Dev Space" instead of "Veritable Games" on checkout:
- See detailed instructions: `~/Desktop/STRIPE_CONNECT_SETUP.md`
- Creates Reno Dev Space as a "Connected Account" under Veritable Games
- Allows fully separate branding while using same Stripe infrastructure
