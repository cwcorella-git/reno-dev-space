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

## Architecture

Everything is Firestore-based with real-time updates via `onSnapshot`:
- Canvas blocks stored in `canvasBlocks` collection
- Chat messages stored in `chatMessages` collection
- Site content (CMS) stored in `siteContent` collection
- User data stored in `users` collection
- Pledges stored in `pledges` collection
- Campaign settings stored in `settings` collection (doc: `campaign`)
- No external servers needed (except Stripe webhooks via Cloud Functions)

## Admin

Admin is identified by email: `christopher@corella.com` (hardcoded in `src/lib/admin.ts`)

Admin can:
- Use "Add Text" button (or right-click context menu) to add text blocks
- Double-click text to edit
- Drag blocks to reposition (real-time visual feedback)
- Resize blocks via corner/edge handles (8 directions)
- Style text (font family, size, color, alignment, bold, italic, underline)
- Ctrl+click any EditableText to edit site content inline
- Access Content panel (📝 icon) for CMS and Campaign panel (📊 icon) for controls
- Start/stop campaign timer, set funding goal, lock/unlock editing

**Note**: Pledged users (backers) can also add text blocks via the "Add Text" button.

## Key Files

```
src/
├── app/
│   ├── layout.tsx            # Root layout with providers
│   ├── page.tsx              # Main page (renders Canvas)
│   └── globals.css           # Tailwind + custom styles
├── components/
│   ├── canvas/
│   │   ├── Canvas.tsx            # Main canvas + right-click menu + marquee select
│   │   ├── CanvasBlock.tsx       # Draggable/resizable block wrapper
│   │   └── TextBlockRenderer.tsx # Text display + inline editing
│   ├── panel/
│   │   ├── UnifiedPanel.tsx      # Main panel with tabs + icons
│   │   ├── EditorTab.tsx         # Block styling controls
│   │   ├── CommunityTab.tsx      # Chat/Members subtab toggle
│   │   ├── ChatTab.tsx           # Real-time chat messages
│   │   ├── MembersTab.tsx        # User directory with stats
│   │   ├── DonateTab.tsx         # Stripe donation flow
│   │   ├── ProfilePanel.tsx      # User info, pledge, account actions
│   │   ├── ContentPanel.tsx      # Content CMS wrapper (admin-only)
│   │   ├── CampaignPanel.tsx     # Campaign controls + stats (admin-only)
│   │   └── ContentTab.tsx        # CMS for UI text
│   ├── chat/
│   │   ├── MessageList.tsx       # Chat message display
│   │   └── MessageInput.tsx      # Chat input field
│   ├── AuthModal.tsx             # Login/signup modal
│   ├── CampaignBanner.tsx        # Top countdown banner (when active)
│   ├── EditableText.tsx          # Inline editable text (ctrl+click for admin)
│   ├── IntroHint.tsx             # Intro card for visitors
│   └── VersionTag.tsx            # Git commit hash display
├── contexts/
│   ├── AuthContext.tsx           # Firebase auth state + user profile
│   ├── CanvasContext.tsx         # Canvas blocks state + selection + isAddTextMode
│   └── ContentContext.tsx        # Site content CMS state
├── hooks/
│   ├── useDragResize.ts          # Drag/resize logic for blocks
│   └── useFirestoreChat.ts       # Chat hook with Firestore
├── lib/
│   ├── firebase.ts               # Firebase init (uses 'main' database)
│   ├── admin.ts                  # Admin email check
│   ├── campaignStorage.ts        # Firestore ops for campaign settings
│   ├── canvasStorage.ts          # Firestore ops for canvas blocks
│   ├── chatStorage.ts            # Firestore ops for chat messages
│   ├── contentStorage.ts         # Firestore ops for site content CMS
│   ├── overlapDetection.ts       # Block collision detection for Add Text
│   ├── permissions.ts            # Block edit permission checks
│   ├── pledgeStorage.ts          # Firestore ops for pledges
│   ├── sanitize.ts               # Input sanitization utilities
│   ├── selectionFormat.ts        # Multi-select formatting helpers
│   └── userStorage.ts            # Firestore ops for user profiles
└── types/
    └── canvas.ts                 # TextBlock, CanvasBlock, TextStyle types

functions/
├── src/index.ts                  # Stripe checkout + webhook handlers
└── package.json                  # Node 20, firebase-functions, stripe
```

## Canvas Constants

```typescript
DESIGN_WIDTH = 1440    // Base canvas width (px)
DESIGN_HEIGHT = 900    // One "screen" of content (px)
// All positions use percentages (0-100) for responsive scaling
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
    fontFamily: string    // 'Inter', 'Georgia', 'Monaco', 'Comic Sans MS', 'Impact'
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
  category: string      // For grouping: 'intro', 'auth', 'panel'
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
  username: string
  amount: number        // pledge amount in dollars
  createdAt: number
  updatedAt: number
}
```

### `settings` (doc: `campaign`)
```typescript
{
  timerStartedAt: number | null   // timestamp when countdown began
  timerDuration: number           // milliseconds (default: 2 weeks)
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

## Environment Variables

Required in `.env.local` (and GitHub Actions secrets):
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
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
```

## Features

- **Canvas Editor**: Admin/pledged users can add text blocks, drag to reposition, resize via 8 handles
- **Add Text Mode**: Cursor-following preview shows placement validity (green = valid, red = overlapping). Shows "Click to place" on desktop, "Tap to place" on mobile. Text cannot overlap existing blocks.
- **Voting**: Brightness-based voting; each vote changes brightness by ±5, block deleted at 0
- **Chat**: Persistent community chat using Firestore (last 100 messages, no relay server)
- **Real-time**: All changes sync instantly across clients via Firestore listeners
- **Content CMS**: Admin can ctrl+click any EditableText to edit inline
- **Campaign Timer**: Admin can start 2-week countdown; auto-locks editing when timer expires
- **Multi-select**: Ctrl+click or marquee drag to select multiple blocks for batch editing

## Panel Structure

The bottom panel has 3 tabs on left + icon buttons on right:

```
[ Editor ] [ Community ● ] [ ♡ Donate ]    [👤] [📝] [📊] [˅]
←──────── tabs ──────────→                 ←── icons ───→
```

**Left side (tabs):**
| Tab | Content |
|-----|---------|
| **Editor** | Block styling (font, size, color, alignment, bold/italic/underline) |
| **Community** | Chat + Members subtabs |
| **Donate** | Stripe one-time donations with optional pledge update |

**Right side (icons):**
| Icon | Content |
|------|---------|
| **Profile** (👤) | User info, pledge, account actions, sign out |
| **Content** (📝, amber) | Content CMS for UI text (admin-only) |
| **Campaign** (📊, amber) | Timer, lock, goal, stats (admin-only) |
| **Collapse** (˅) | Minimize/expand panel |

## Voting System

- Default brightness: 50 (scale 0-100)
- Each vote changes brightness by ±5
- Opacity maps to brightness: 0% → 0.2 opacity, 100% → 1.0 opacity
- Block deleted when brightness reaches 0
- Each user can only vote once per block (tracked in `voters` array)
- Keyboard shortcuts: Space (upvote), Alt (downvote) when block selected

## Mobile Interactions

- Touch-and-hold (300ms) to start dragging blocks
- Tap to select, double-tap to edit
- Canvas zooms to fit viewport (375px mobile safe zone)
- "Tap to place" message in Add Text mode

## Inline Content Editing

The `EditableText` component allows admin to edit UI text inline:
- Ctrl+click any EditableText to open inline editor
- Enter to save, Esc to cancel
- Content persists in `siteContent` Firestore collection
- Falls back to default values if no Firestore entry exists

## Campaign System

Admin controls via Campaign panel (📊 icon):
- **Start Timer**: Begins 2-week countdown
- **Reset Timer**: Stops and clears countdown
- **Set Goal**: Update funding target
- **Lock/Unlock**: Prevent/allow block editing
- **Reset Brightness**: Reset all blocks to default brightness

When timer expires, campaign auto-locks to prevent further editing.

CampaignBanner shows at top of page when timer is active, displaying countdown and funding progress.

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
