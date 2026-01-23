# Reno Dev Space

A collaborative space for indie game developers in Reno. Features a canvas-based editor where users can add text blocks, vote on content, and chat in real-time.

## Features

- **Canvas Editor** - Add text blocks, drag to reposition, resize via corner/edge handles
- **Voting System** - Brightness-based voting affects block visibility (blocks deleted at 0 brightness)
- **Real-time Chat** - Persistent community chat synced via Firestore
- **Campaign System** - Admin can run timed funding campaigns with auto-lock on expiry
- **Donations** - One-time Stripe donations to support the space
- **Content CMS** - Admin can edit all UI text inline with ctrl+click

## Tech Stack

- **Frontend**: Next.js 14 (static export)
- **Hosting**: GitHub Pages
- **Database**: Firebase Firestore (named `main` database)
- **Auth**: Firebase Auth (Email/Password)
- **Payments**: Stripe (via Firebase Cloud Functions)

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

The bottom panel has 3 tabs on left + icon buttons on right:

```
[ Editor ] [ Community ] [ Donate ]    [Profile] [Content] [Campaign] [Collapse]
```

| Tab/Icon | Description |
|----------|-------------|
| **Editor** | Block styling (font, size, color, alignment) |
| **Community** | Chat + Members directory |
| **Donate** | Stripe one-time donations |
| **Profile** (👤) | User info, pledge, account actions |
| **Content** (📝) | CMS for UI text (admin-only) |
| **Campaign** (📊) | Timer, lock, goal controls (admin-only) |

## How It Works

1. **Sign up** with email/password and an optional pledge amount
2. **Add text blocks** to the canvas (requires pledge or admin status)
3. **Vote** on blocks to increase/decrease their brightness
4. **Chat** with other community members in real-time
5. **Donate** via Stripe to support the space

## Contributing

This is a community project for Reno game developers. Sign up on the site to add your ideas and chat with local devs.

## License

MIT
