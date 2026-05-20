# Migration: GitHub Pages → renodevspace.org (Cloudflare Pages)

Tracking the move from `cwcorella-git.github.io/reno-dev-space` to the apex domain `renodevspace.org`, hosted on **Cloudflare Pages**. Hard cutover — no redirect from the old github.io URL; that path becomes GitHub's default 404 once Pages is disabled.

## Why Cloudflare Pages (and not Tunnel)

The veritablegames.com stack uses **Cloudflare Tunnel** because it exposes a self-hosted Coolify origin. reno-dev-space has **no origin server** — it's a Next.js static export fully backed by Firebase (Auth, Firestore, Storage, Cloud Functions, Stripe via Functions). Tunnel doesn't apply. Pages is git-integrated static hosting at the Cloudflare edge — the right shape for this app.

## Done (in-repo code changes)

| Change | File |
|---|---|
| Drop `/reno-dev-space` subpath from the Next.js build | `next.config.js` |
| Favicon URLs served from site root | `src/app/layout.tsx` |
| Email-template fetch served from site root | `src/components/panel/EmailsPanel.tsx` |
| Stripe `success_url` / `cancel_url` no longer baked with the subpath | `functions/src/index.ts` |
| Single source of truth for the canonical site URL introduced | `src/lib/siteConfig.ts` (new) |
| Frontend verification-link samples now read from `SITE_URL` | `src/components/panel/EmailsPanel.tsx`, `src/components/panel/EmailVariableEditor.tsx` |

These edits are safe to land on `main` immediately — the existing GitHub Pages deploy keeps working until Phase 4 cutover, because the basePath flip just removes a prefix the apex domain doesn't need.

## Not yet done

### In-repo (mine to finish)

- [ ] **`src/lib/siteConfig.ts` — `SITE_URL` value.** `TODO(human)` is in place. Pending your design call (literal vs. env-driven, trailing slash or not). Until defined, the two frontend imports won't resolve.
- [ ] **Mirror the chosen `SITE_URL` into `functions/src/emailFunctions.ts:318`.** Separate npm package, no path alias into `src/` — handled manually once you've decided the value.
- [ ] **Rebuild Cloud Functions.** `cd functions && npm run build` so `functions/lib/` matches the updated source (the Stripe redirect fix is sitting in source-only right now).
- [ ] **Playwright sweep.** Check `playwright.config.ts` and `tests/*.spec.ts` for hardcoded `github.io` or `/reno-dev-space` references in `baseURL` / navigation calls.
- [ ] **Phase 4 cutover edits** (after you confirm Pages is live on the new domain):
  - Delete `.github/workflows/deploy.yml`.
  - Update `CLAUDE.md` hosting line (currently says "GitHub Pages (cwcorella-git.github.io/reno-dev-space)").
  - Update the memory file at `~/.claude/projects/-home-user-Projects-reno-dev-space/memory/MEMORY.md`.

### Off-repo (your side — I don't touch dashboards)

- [ ] **Cloudflare:** add `renodevspace.org` as a zone; repoint registrar nameservers.
- [ ] **Cloudflare Pages:** create project from the GitHub repo. Build `npm run build`, output `out`, Node 20.
- [ ] **Cloudflare Pages env vars:** copy the six `NEXT_PUBLIC_FIREBASE_*` values from GitHub Actions secrets into Pages → Settings → Environment variables, for both Production and Preview.
- [ ] **Cloudflare Pages custom domains:** attach `renodevspace.org` and `www.renodevspace.org`.
- [ ] **Firebase Console → Authentication → Settings → Authorized domains:** add `renodevspace.org`, `www.renodevspace.org`, and the `<project>.pages.dev` preview domain. *Auth fails silently if this is missed.*
- [ ] **Stripe Dashboard:** confirm no domain allowlist blocks the new origin. The webhook endpoint is a Cloud Function URL, unaffected by the move.
- [ ] **`emailTemplates` Firestore collection audit:** any saved HTML containing the old `cwcorella-github.io/reno-dev-space/` link needs the URL swapped. Code defaults won't overwrite stored documents — paste any matches here and I'll hand you corrected HTML.
- [ ] **Deploy Cloud Functions** (after I've rebuilt them locally): `cd functions && npm run deploy`. Touches Firebase, so it's yours.
- [ ] **Disable GitHub Pages** in repo Settings → Pages, *after* Pages is verified working on the new domain. The old github.io URL then serves GitHub's stock 404 — by design.

## Sequencing notes

- The in-repo code changes can land on `main` now without breaking the live github.io site, because they only *remove* a prefix the old deploy doesn't strictly need at build time — but the current github.io URL will go stale the moment you push: the favicon and email-template fetches assume root paths. Safer order: land code changes, then immediately cut over to Pages, then disable GitHub Pages. The window of broken github.io should be minutes, not days.
- Functions deploy is independent of Pages deploy. The Stripe-URL fix should ship to Functions *before* the first donation flow on the new domain, otherwise users land on a 404 at `renodevspace.org/reno-dev-space/?donation=success`.
- The Firebase Auth authorized-domains change can (and should) be done early — adding a domain pre-emptively breaks nothing.

## Out of scope (explicitly)

- No redirect from `cwcorella-git.github.io/reno-dev-space/*` to the new domain. Hard cutover; GitHub's default 404 is the chosen outcome.
- No Cloudflare Tunnel, Workers, or Access policies. Plain DNS + Pages.
- No data migration in Firestore beyond the `emailTemplates` URL audit. Everything else is keyed by user/document IDs, not URLs.
- `Canvas.tsx:528` localStorage key `reno-dev-space-viewed` stays as-is — renaming it re-pops the intro hint for every existing visitor for no benefit.
