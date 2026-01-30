# Reno Dev Space

A collaborative space for indie game developers in Reno. Features a canvas-based editor where users can add text blocks, vote on content, and chat in real-time.

## Features

- **Canvas Editor** - Add text blocks, drag to reposition, resize via 8-direction handles
- **Voting System** - Brightness-based voting affects block visibility (blocks deleted at 0 brightness)
- **Real-time Chat** - Persistent community chat synced via Firestore
- **Campaign System** - Always-visible banner with three states: member count teaser, active countdown with donations, and completed/locked
- **Donations** - One-time Stripe donations via campaign banner (during active campaigns)
- **Content CMS** - Admin can edit all 80+ UI text strings via Content panel or inline with ctrl+click
- **Undo/Redo** - Session-based history with Ctrl+Z / Ctrl+Y
- **Copy/Paste** - Duplicate blocks with Ctrl+C / Ctrl+V
- **Multi-select** - Ctrl+click or marquee drag to select multiple blocks for batch editing
- **Inline Formatting** - Ctrl+B/I/U for bold, italic, underline while editing text
- **12 Google Fonts** - Random font and color assigned to new blocks

## Tech Stack

- **Frontend**: Next.js 14 (static export)
- **Hosting**: GitHub Pages
- **Database**: Firebase Firestore (named `main` database)
- **Auth**: Firebase Auth (Email/Password)
- **Payments**: Stripe (via Firebase Cloud Functions)
- **Icons**: Heroicons
- **Testing**: Playwright (E2E)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Panel Structure

The bottom panel has 4 tabs + admin icon buttons:

```
[ Editor ] [ Chat ● ] [ Members ] [ Profile ]    [Content] [Campaign] [Collapse]
```

| Tab/Icon | Description |
|----------|-------------|
| **Editor** | Block styling (font, size, color, alignment, bold/italic/underline/strikethrough) |
| **Chat** | Real-time community messages (green dot = connected) |
| **Members** | User directory with blocks, votes, pledge, join date |
| **Profile** | User info, pledge amount, account actions |
| **Content** (pencil) | CMS for all UI text — 80+ editable strings (admin-only) |
| **Campaign** (chart) | Timer, lock, goal, member count, stats (admin-only) |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Space / Alt | Vote up / down on selected block |
| Ctrl+B / I / U | Bold / italic / underline (while editing) |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+C / Ctrl+V | Copy / paste blocks |
| Ctrl+A | Select all blocks |
| Delete | Delete selected blocks |
| Escape | Deselect / exit mode |

## How It Works

1. **Sign up** with email/password, display name, and a pledge amount ($20 minimum)
2. **Add text blocks** to the canvas (requires pledge or admin status)
3. **Vote** on blocks to increase/decrease their brightness
4. **Chat** with other community members in real-time
5. **Donate** via Stripe during active campaigns (button appears in the top banner)

## Contributing

This is a community project for Reno game developers. Sign up on the site to add your ideas and chat with local devs.

## License

MIT
