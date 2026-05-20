# Storage Migration: Firebase Storage → R2

The smallest subsystem in the migration. Firebase Storage holds exactly one kind of object: rental property images at `properties/{propertyId}/main.jpg`. R2 replaces it with the same path layout.

---

## Current usage

| Operation | Where | Detail |
|---|---|---|
| Upload | `src/lib/storage/propertyStorage.ts:74` (`uploadPropertyImage`) | `uploadBytes()` → returns download URL |
| Delete | `src/lib/storage/propertyStorage.ts:206` (inside `deleteProperty`) | `deleteObject()` before Firestore row deletion |
| Read | Client `<img src={imageUrl}>` | No SDK call; browser fetches the public URL stored in `rentalProperties.imageUrl` |

No other Storage usage in the codebase. No avatars, no email attachments, no template assets.

---

## R2 layout

Single bucket: `renodevspace-assets`. Same path structure as today:

```
renodevspace-assets/
└── properties/
    └── {propertyId}/
        └── main.jpg
```

Keeping the path identical means the migration script (`CUTOVER.md`) can `aws s3 cp` from a Firebase Storage export directly into R2 without renaming.

---

## Access pattern: signed URLs vs public bucket

**Recommendation: bind R2 to a public-read custom domain** (e.g. `cdn.renodevspace.org` pointing at the bucket). Property images are intentionally public — anyone with the listing URL should see the photo. No need for signed URLs.

| Option | Trade-off |
|---|---|
| **Public custom domain (recommended)** | Simplest. URLs look clean: `https://cdn.renodevspace.org/properties/abc123/main.jpg`. Cacheable at edge. Free egress. |
| Signed URLs per request | Adds complexity. Necessary only if images become access-controlled later. Worker mints short-lived URLs on each render. |
| Direct R2 SDK fetch | Wrong shape — bypasses the CDN, wastes egress (though R2 egress is free). |

Public custom domain it is.

---

## Upload flow rewrite

Current Firebase Storage upload uses the client SDK to `uploadBytes()` directly. R2 doesn't have a browser SDK that's safe to use client-side — clients can't hold R2 credentials. The new flow uses a Worker as the upload broker:

```
Client → POST /api/properties/upload-url     (with auth)
       ← { uploadUrl, finalUrl }            (signed URL valid 5 min, plus the eventual public URL)

Client → PUT uploadUrl with image bytes      (directly to R2, bypasses Worker)

Client → POST /api/properties               (with auth + finalUrl + metadata)
       ← { id }                             (row created in D1)
```

Two-step pattern:
1. **Worker mints a presigned upload URL** (`r2.createPresignedUrl({ method: 'PUT', expiresIn: 300 })`). This is the only step that needs Cloudflare credentials; the Worker has them via binding.
2. **Client uploads directly to R2** with the presigned URL. Bytes never pass through the Worker (saves Worker CPU time + matches R2's recommended pattern).
3. **Client tells the API the upload is done** with a normal authenticated POST. API verifies the object exists in R2, then inserts the `rental_properties` row.

---

## Delete flow rewrite

```
Client → DELETE /api/properties/:id          (with auth + admin or owner check)
       Worker:
       - Verify auth (owner or admin)
       - DELETE FROM rental_properties WHERE id = ?    (cascades votes/reports per SCHEMA.md FKs)
       - r2.delete('properties/{id}/main.jpg')
```

Order matters: D1 first (so the row is gone), then R2 (so an orphan image is the failure mode, not an orphan row). R2 has no FK semantics — orphan images get cleaned up by a periodic Worker (cron) or simply ignored (storage cost is negligible).

---

## File-type / size validation

The current code has **no validation**, relying on Firebase Storage's defaults (5 GB limit). With a Worker in the middle, this becomes our responsibility:

- **Size limit:** enforce 5 MB max in the presigned-URL request (signed URLs can include `Content-Length` constraints).
- **MIME type:** enforce `image/jpeg`, `image/png`, `image/webp` only. R2 doesn't validate content; the Worker checks the Content-Type header at the upload-completion step.
- **Image dimensions:** optional — render-time concern, not upload-time. Skip for v1.

This is a *security improvement* over current behavior, not a regression. Worth a callout in the implementation PR.

---

## Bandwidth & cost (see `COSTS.md`)

R2 has **free egress, always**. This is the single biggest win over Firebase Storage (which charges $0.12/GB and rate-limits to 1 GB/day on free tier). Property images can be served unmetered.

Worker bandwidth for the upload-URL endpoint is negligible — tiny JSON responses, ~50 ops/month at projected scale.

---

## Migration data movement

Detailed in `CUTOVER.md`, but the shape:

1. Run `scripts/backup-firestore.js` (already exports `rentalProperties` collection with image URLs).
2. For each property, download the Firebase Storage image (the existing `imageUrl` works).
3. Upload to R2 at the identical path (`properties/{id}/main.jpg`).
4. Update the `imageUrl` to point at `cdn.renodevspace.org` instead of Firebase Storage URL.
5. Insert `rental_properties` row in D1 with the new URL.

Zero downtime: during cutover, both URLs work — old `imageUrl` keeps resolving until Firebase Storage is deprovisioned. Fixed by the D1 row holding the new URL after import.

---

## Files that change

- `src/lib/storage/propertyStorage.ts` — `uploadPropertyImage()` becomes the two-step flow; `deleteProperty()` calls the new endpoint
- `wrangler.jsonc` — R2 bucket binding
- New Worker route file: `workers/src/routes/properties.ts` — owns upload-URL mint, upload-complete handler, delete handler
- `next.config.js` — add `cdn.renodevspace.org` to `images.remotePatterns` if Next's `<Image>` component is used (it isn't currently; `<img>` is fine)

---

## Out of scope

- **Image optimization** (resize, convert to WebP, generate thumbnails). Cloudflare offers Images for this ($5/mo + per-image fees) — separate decision, not bundled with the migration. Status quo: serve originals.
- **Backup of R2 bucket.** Defer to `CUTOVER.md` and a separate cron Worker.
- **CDN cache invalidation.** R2 + custom domain auto-caches; for image replacement on the same property, append a query string (`?v=2`) or accept brief staleness. Status quo behavior is identical (Firebase Storage URLs don't auto-invalidate either).
