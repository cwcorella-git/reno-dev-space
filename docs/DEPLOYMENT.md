# Deployment

## Overview

The site is a Next.js static export hosted on GitHub Pages. Deployment is fully automated via GitHub Actions on every push to `main`.

```
git push → GitHub Actions → npm run build → Deploy to GitHub Pages
```

Live URL: `https://cwcorella-git.github.io/reno-dev-space/`

---

## Build Process

### Static Export

```bash
npm run build
# → Creates static HTML/CSS/JS in out/
```

`next.config.js` configuration:
- `output: 'export'` — static HTML export (no server-side rendering)
- `trailingSlash: true` — required for GitHub Pages routing
- `images.unoptimized: true` — required for static export (no Next.js image server)
- `basePath: '/reno-dev-space'` — in production only (empty string in dev)
- `assetPrefix: '/reno-dev-space'` — in production only

### basePath Behavior

| Environment | basePath | URL |
|-------------|----------|-----|
| Local dev (`npm run dev`) | `''` | `http://localhost:3000/` |
| GitHub Pages | `/reno-dev-space` | `https://cwcorella-git.github.io/reno-dev-space/` |

The app detects this automatically via `NODE_ENV`.

### Build-Time Env Vars

`next.config.js` injects these at build time (not from `.env.local`):

| Variable | Value | Used By |
|----------|-------|---------|
| `NEXT_PUBLIC_COMMIT_SHA` | `process.env.GITHUB_SHA` | `VersionTag` component |
| `NEXT_PUBLIC_BUILD_TIME` | `new Date().toISOString()` | `VersionTag` component |

---

## GitHub Actions

### deploy.yml — Main Deployment

**Trigger**: Push to `main` branch, or manual `workflow_dispatch`

**Steps**:
1. Checkout code
2. Setup Node.js
3. `npm ci` — install dependencies
4. `npm run build` — build with all `NEXT_PUBLIC_*` env vars from GitHub Secrets
5. Upload `out/` as GitHub Pages artifact
6. Deploy artifact to GitHub Pages

**Required GitHub Secrets** (set in repo Settings → Secrets → Actions):

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client SDK |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app |
| `NEXT_PUBLIC_SOCKETIO_URL` | Real-time presence WebSocket (optional) |

**Permissions required** (set in workflow file):
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

### claude.yml — Claude Code Integration

**Trigger**: Issue or PR comments containing `@claude`, or comments from the repo owner

**What it does**: Runs Claude Code to implement requested changes directly in the repo.

**Required secrets**:
- `ANTHROPIC_API_KEY` — Claude API access
- `CLAUDE_CODE_OAUTH_TOKEN` — Claude Code GitHub integration

See [GITHUB_SETUP_GUIDE.md](../GITHUB_SETUP_GUIDE.md) for setup instructions.

---

## Firebase Cloud Functions

Functions are deployed separately from the main site:

```bash
cd functions
npm run build    # Compile TypeScript → lib/
npm run deploy   # firebase deploy --only functions
```

**Runtime**: Node.js 20

**Functions deployed**:
- `createCheckoutSession` — Stripe checkout HTTP endpoint
- `stripeWebhook` — Stripe webhook handler
- `sendVerificationEmail` — Auth trigger (fires on new user signup)
- `sendCampaignSuccessEmails` — Callable by admin
- `sendCampaignEndedEmails` — Callable by admin
- `sendCampaignUpdate` — Callable by admin
- `sendTestEmail` — Callable by admin

**Function secrets** (set via `firebase functions:secrets:set`):
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

Email SMTP config via `firebase functions:config:set`:
```bash
firebase functions:config:set email.host="smtp.example.com" email.port="587" email.user="..." email.pass="..."
```

---

## First-Time Setup

1. Fork or clone the repository
2. Enable GitHub Pages in repo Settings → Pages → Source: GitHub Actions
3. Add all required secrets to repo Settings → Secrets → Actions
4. Push to `main` — Actions will build and deploy automatically

For Firebase Functions:
1. Install Firebase CLI: `npm install -g firebase-tools`
2. `firebase login`
3. Set function secrets (see above)
4. `cd functions && npm run deploy`

---

## Local Development

```bash
npm install
# Create .env.local with Firebase credentials (see CLAUDE.md)
npm run dev
# → http://localhost:3000 (no basePath in dev)
```

The dev server automatically sets `NODE_ENV=development`, which disables `basePath` in `next.config.js`.

---

## Known Limitations

- **No SSR**: Static export means no server-side rendering. All auth and data fetching happens client-side.
- **No Next.js Image optimization**: `images.unoptimized: true` is required for static export.
- **No API routes**: Static export doesn't support Next.js API routes. All server-side logic runs in Firebase Cloud Functions.
- **GitHub Pages caching**: Deployed assets may be cached. Hard refresh (`Ctrl+Shift+R`) if changes don't appear immediately.
