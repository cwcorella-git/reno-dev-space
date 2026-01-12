# Reno Dev Space

A website for a non-profit game developer collective in Reno. Features a canvas-based editor where admin can place text and voteable content, plus a persistent community chat.

## Tech Stack

- **Frontend**: Next.js 14 with static export (`output: 'export'`)
- **Hosting**: GitHub Pages (cwcorella-git.github.io/reno-dev-space)
- **Database**: Firebase Firestore (database name: `main`, NOT default)
- **Auth**: Firebase Auth (Email/Password)

## Architecture

Everything is Firestore-based with real-time updates via `onSnapshot`:
- Canvas blocks stored in `canvasBlocks` collection
- Chat messages stored in `chatMessages` collection
- No external servers needed

## Admin

Admin is identified by email: `christopher@corella.com` (hardcoded in `src/lib/admin.ts`)

Admin can:
- Use "Add Text" button (or right-click context menu) to add text blocks
- Double-click text to edit
- Drag blocks to reposition (real-time visual feedback)
- Resize blocks via corner handles
- Toggle blocks as "voteable"
- Style text (font family, size, color, alignment, bold)
- Access Settings > Admin tab for campaign controls and content CMS

**Note**: Pledged users (backers) can also add text blocks via the "Add Text" button.

## Key Files

```
src/
├── app/
│   ├── layout.tsx          # Root layout with providers
│   └── page.tsx            # Main page (renders Canvas)
├── components/
│   ├── canvas/
│   │   ├── Canvas.tsx          # Main canvas + right-click context menu
│   │   ├── CanvasBlock.tsx     # Draggable/resizable block wrapper
│   │   ├── TextBlockRenderer.tsx # Text display + voting UI
│   │   └── BlockToolbar.tsx    # Style controls when block selected
│   ├── panel/
│   │   ├── UnifiedPanel.tsx    # Main panel with 4 tabs
│   │   ├── EditorTab.tsx       # Block styling controls
│   │   ├── CommunityTab.tsx    # Chat/Members subtab toggle
│   │   ├── ChatTab.tsx         # Real-time chat messages
│   │   ├── MembersTab.tsx      # User directory with stats
│   │   ├── DonateTab.tsx       # Stripe donation flow
│   │   ├── SettingsTab.tsx     # Account/Admin subtabs
│   │   └── ContentTab.tsx      # CMS for UI text (admin)
│   ├── chat/
│   │   ├── MessageList.tsx     # Chat message display
│   │   └── MessageInput.tsx    # Chat input field
│   ├── AuthModal.tsx           # Login/signup modal
│   └── IntroHint.tsx           # Intro text for visitors
├── contexts/
│   ├── AuthContext.tsx         # Firebase auth state
│   └── CanvasContext.tsx       # Canvas blocks state
├── hooks/
│   └── useFirestoreChat.ts     # Chat hook with Firestore
├── lib/
│   ├── firebase.ts             # Firebase init (uses 'main' database)
│   ├── admin.ts                # Admin email check
│   ├── canvasStorage.ts        # Firestore ops for canvas blocks
│   ├── chatStorage.ts          # Firestore ops for chat messages
│   └── overlapDetection.ts     # Block collision detection for Add Text
└── types/
    └── canvas.ts               # TextBlock, CanvasBlock types
```

## Firestore Collections

### `canvasBlocks`
```typescript
{
  id: string
  type: 'text'
  x: number           // percentage 0-100
  y: number           // percentage 0-100
  width: number       // percentage
  height: number      // 0 = auto
  zIndex: number
  content: string
  style: {
    fontSize: number    // rem
    fontWeight: 'normal' | 'bold'
    fontFamily: string  // e.g., 'Inter', 'Georgia', 'Monaco'
    color: string       // hex
    textAlign: 'left' | 'center' | 'right'
    backgroundColor?: string
  }
  voteable?: boolean
  upvotes?: string[]    // user IDs
  downvotes?: string[]  // user IDs
  createdAt: number
  updatedAt: number
}
```

### `chatMessages`
```typescript
{
  id: string
  room: string        // e.g., 'community'
  text: string
  username: string
  odId: string        // Firebase user ID
  timestamp: number
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

Rules must be set on the `main` database (not default). Example:
```
rules_version = '2';
service cloud.firestore {
  match /databases/main/documents {
    match /canvasBlocks/{blockId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /chatMessages/{messageId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Build & Deploy

```bash
npm run build    # Creates static export in 'out/'
git push         # GitHub Actions deploys to Pages
```

## Features

- **Canvas Editor**: Admin/pledged users can add text blocks, drag to reposition, resize via handles
- **Add Text Mode**: Cursor-following preview shows placement validity (green = valid, red = overlapping). Shows "Click to place" on desktop, "Tap to place" on mobile. Blocks cannot overlap existing text.
- **Voting**: Any text block can be made voteable; logged-in users vote with thumbs up/down
- **Chat**: Persistent community chat using Firestore (no relay server)
- **Real-time**: All changes sync instantly across clients via Firestore listeners

## Panel Structure

The bottom panel has 4 main tabs:

| Tab | Content |
|-----|---------|
| **Editor** | Block styling (font, size, color, alignment) |
| **Community** | Chat + Members subtabs |
| **Donate** | Stripe one-time donations |
| **Settings** | Account + Admin subtabs |

**Settings > Account**: User info, pledge management, clear votes, delete content, sign out
**Settings > Admin** (admin only): Campaign controls, stats, content CMS
