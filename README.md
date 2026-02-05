# Reno Dev Space

A collaborative space for indie game developers in Reno. Features a canvas-based editor where users can add text blocks, vote on content, and chat in real-time.

**Live site**: [cwcorella-git.github.io/reno-dev-space](https://cwcorella-git.github.io/reno-dev-space/)

## Features

- **Canvas Editor** — Add text blocks, drag to reposition, resize via 8-direction handles
- **Voting System** — Brightness-based voting with directional up/down tracking. Blocks deleted at 0 brightness.
- **Vote Text Effects** — CSS effects escalate with upvotes: glow → pulse → hue-cycle → rainbow gradient
- **Real-time Chat** — Persistent community chat synced via Firestore
- **Campaign System** — Always-visible banner with three states: member count teaser, active countdown with donations, and completed/locked
- **Donations** — One-time Stripe donations via campaign banner (during active campaigns)
- **Content CMS** — Admin can edit all 80+ UI text strings via Content panel or inline with Ctrl+click
- **Reporting** — Users can report blocks; admins see reports, can dismiss or delete
- **History** — Deletion audit log with restore capability + edit history for content changes
- **Admin Moderation** — Multi-admin system with user deletion, email banning, and report dismissal
- **Undo/Redo** — Comprehensive session-based history (Ctrl+Z / Ctrl+Y) for all canvas actions: move, resize, add, delete, style, content, vote
- **Copy/Paste** — Duplicate blocks with Ctrl+C / Ctrl+V
- **Multi-select** — Ctrl+click or marquee drag to select multiple blocks for batch editing
- **Inline Formatting** — Ctrl+B/I/U for bold, italic, underline; inline links via toolbar
- **12 Google Fonts** — Random font and color assigned to new blocks

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
[ Editor ] [ Chat ] [ Members ] [ Profile ]    [History] [Content] [Campaign] [Collapse]
```

| Tab/Icon | Description |
|----------|-------------|
| **Editor** | Block styling (font, size, color, alignment, bold/italic/underline/strikethrough, link) |
| **Chat** | Real-time community messages (green dot = connected) |
| **Members** | User directory + admin tools (delete, ban/unban, promote/demote) |
| **Profile** | User info, pledge amount, account actions |
| **History** (clock) | Deletion + edit history with restore/delete (admin-only) |
| **Content** (pencil) | CMS for all UI text (admin-only) |
| **Campaign** (chart) | Timer, goal, lock, reset votes (admin-only) |

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
3. **Vote** on blocks — upvotes add glow/shimmer effects, downvotes dim the text
4. **Report** inappropriate blocks — admins review and dismiss or delete
5. **Chat** with other community members in real-time
6. **Donate** via Stripe during active campaigns (button appears in the top banner)

## Contributing

This is a community project for Reno game developers. Sign up on the site to add your ideas and chat with local devs.

## License

MIT
