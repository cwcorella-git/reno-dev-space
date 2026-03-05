# Rental Property Gallery

## Overview

The rental property gallery lets community members submit rental spaces for consideration. Properties are displayed in an image carousel on the canvas and support the same voting/reporting system as canvas text blocks. Admins can drag-position the gallery anywhere on the canvas.

See [ARCHITECTURE.md](ARCHITECTURE.md) for Firestore schema details.

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `PropertyGallery` | `src/components/property/PropertyGallery.tsx` | Main gallery container; handles subscriptions, drag-to-position, voting, reporting |
| `PropertyCarousel` | `src/components/property/PropertyCarousel.tsx` | Image + metadata carousel display |
| `PropertyCard` | `src/components/property/PropertyCard.tsx` | Individual property card renderer |
| `PropertyVoteControls` | `src/components/property/PropertyVoteControls.tsx` | Up/down vote buttons overlaid on image |
| `GalleryPositionSlider` | `src/components/property/GalleryPositionSlider.tsx` | Admin Y-position slider (desktop only) |
| `AddPropertyModal` | `src/components/property/AddPropertyModal.tsx` | Form to submit new property with image upload |

## Data Model

Stored in the `rentalProperties` Firestore collection (on `main` database):

```typescript
{
  id: string
  address: string
  description: string
  imageStoragePath: string   // Firebase Storage: properties/{id}/main.jpg
  cost: number | null        // Monthly cost in dollars; null if not specified
  brightness: number         // 0-100 (default: 50)
  voters: string[]           // Legacy — pre-directional-voting UIDs
  votersUp: string[]         // UIDs who upvoted
  votersDown: string[]       // UIDs who downvoted
  reportedBy?: string[]      // UIDs who reported this property
  dismissedReporters?: string[]  // UIDs whose reports were dismissed
  phone?: string
  companyName?: string
  createdBy: string          // Firebase Auth UID of submitter
  createdAt: number          // Unix timestamp
  updatedAt: number
}
```

**Gallery position** is stored separately in `settings` doc `propertyGallery`:
```typescript
{ x: number, y: number }   // Canvas percentages; default x: 37.5%, y: 66.7%
```

## Voting System

Properties use the same 3-state voting model as canvas text blocks:

| State | brightness | votersUp | votersDown |
|-------|-----------|----------|------------|
| Neutral | 50 | [] | [] |
| Upvoted | 55 | [uid] | [] |
| Downvoted | 45 | [] | [uid] |

**Key behaviors**:
- ±5 brightness per vote; opacity maps to brightness (0.2–1.0)
- Same-direction vote button is **disabled** (no-op)
- Opposite-direction button removes existing vote and returns to neutral
- **Archive threshold**: brightness ≤ 20 → property is grayed out (not deleted)
  - Unlike canvas blocks (deleted at brightness 0), properties are preserved for review
- **Celebration effects**: `PropertyVoteControls` triggers `CelebrationOverlay` on upvotes (same as canvas blocks, using `getCelebrationEffect(property.id)`)

## Reporting & Moderation

- Any authenticated user can report a property (⚠ button)
- Admins see a yellow border on reported properties
- Admin can **dismiss** reports: clears `reportedBy`, adds UIDs to `dismissedReporters` (those users can't re-report)
- Admin can delete the property outright

## Admin Features

### Drag-to-Position
- Admin can drag the gallery container anywhere on the canvas
- Jitter prevention via `pendingPosRef` pattern (same as canvas blocks)
- Position saved to `settings/propertyGallery` in Firestore

### Gallery Position Slider
- Desktop-only Y-axis slider at `left: 64.4%` of canvas
- Allows fine-tuning vertical position without drag
- Only visible to admins

### Mobile Safe Zone Constraints
During drag, X-position is clamped so the full gallery width fits within the 375px mobile safe zone:
```typescript
const MOBILE_ZONE_LEFT = 37.0   // (532.5 / 1440) * 100
const MOBILE_ZONE_RIGHT = 63.0  // (907.5 / 1440) * 100
// Gallery X clamped to [37.0%, 38.0%] to keep 360px inside the 375px zone
```

### Displacement on Drop
After dragging the gallery, `displacOverlappingBlocks()` automatically pushes any overlapping canvas text blocks aside. This action is recorded in the undo history.

## Submitting a Property (AddPropertyModal)

Any authenticated user can submit a property:
1. Fill in address, description, optional cost/phone/company
2. Upload an image (JPEG/PNG)
3. Image uploaded to Firebase Storage at `properties/{propertyId}/main.jpg`
4. Firestore document created with `imageStoragePath`

## Mobile Behavior

- Gallery is touch-scrollable (swipe between properties)
- Tap property image → full-view modal with pinch-to-zoom
- Vote controls visible as floating overlay on image
- Gallery positioned within mobile safe zone

## Full-View Modal

- **Mobile**: Pinch-to-zoom enabled, full-screen overlay
- **Desktop**: Full-screen with close button
- Z-index: `z-[200]` (close button `z-[210]`)

## Storage Layer

| File | Purpose |
|------|---------|
| `src/lib/storage/propertyStorage.ts` | CRUD + real-time subscription for `rentalProperties` |
| `src/lib/storage/propertyGalleryStorage.ts` | Gallery position read/write in `settings/propertyGallery` |

Real-time subscription orders by `createdAt` descending (newest first).
