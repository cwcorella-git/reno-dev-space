# Reno Dev Space

A collaborative space for indie game developers in Reno. Features a canvas-based editor where users can add text blocks, vote on content, and chat in real-time.

## Features

- **Canvas Editor** - Add text blocks, drag to reposition, resize via corner handles
- **Voting** - Any block can be made voteable; logged-in users vote with thumbs up/down
- **Real-time Chat** - Persistent community chat synced via Firestore
- **Donations** - One-time Stripe donations to support the space

## Tech Stack

- **Frontend**: Next.js 14 (static export)
- **Hosting**: GitHub Pages
- **Database**: Firebase Firestore
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

| Tab | Description |
|-----|-------------|
| **Editor** | Block styling (font, size, color, alignment) |
| **Community** | Chat + Members directory |
| **Donate** | Stripe one-time donations |
| **Settings** | Account management + Admin controls |

## Contributing

This is a community project for Reno game developers. Sign up on the site to add your ideas and chat with local devs.

## License

MIT
