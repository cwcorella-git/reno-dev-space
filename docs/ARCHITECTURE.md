# Architecture Documentation

## System Overview

Reno Dev Space is a real-time collaborative platform built on Next.js with Firebase backend. The architecture emphasizes real-time updates, optimistic UI, and admin-controlled content management.

## Tech Stack

- **Frontend**: Next.js 14.2.35 (App Router, static export)
- **Deployment**: GitHub Pages (static hosting)
- **Database**: Firebase Firestore (`main` database)
- **Auth**: Firebase Auth (Email/Password)
- **Storage**: Firebase Storage (property images)
- **Payments**: Stripe (via Firebase Cloud Functions)
- **Real-time**: Firestore `onSnapshot` subscriptions
- **Icons**: Heroicons v2
- **Testing**: Playwright

## Core Design Patterns

### 1. Real-time Data Subscription

**Pattern**: All dynamic data uses Firestore subscriptions, not one-time queries

```typescript
// Example: src/lib/storage/propertyStorage.ts
export function subscribeToProperties(
  onUpdate: (properties: RentalProperty[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const db = getDb()
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      onUpdate(properties)
    },
    onError
  )
}
```

**Usage in Components**:
```typescript
useEffect(() => {
  const unsubscribe = subscribeToProperties(setProperties, console.error)
  return () => unsubscribe()
}, [])
```

### 2. Optimistic UI with Jitter Prevention

**Problem**: User drags gallery → Firestore update → Snapshot fires → Gallery jumps back

**Solution**: `pendingPosRef` pattern

```typescript
// src/components/property/PropertyGallery.tsx
const pendingPosRef = useRef<{ x: number; y: number } | null>(null)

// On drag end:
updateGalleryPosition(dragPos.x, dragPos.y, user.uid)
pendingPosRef.current = dragPos

// On Firestore update:
useEffect(() => {
  if (pendingPosRef.current && !isDragging) {
    const tolerance = 0.01
    if (matches(firestorePos, pendingPosRef.current, tolerance)) {
      pendingPosRef.current = null
      setDragPos(null)  // Clear optimistic state
    }
  }
}, [firestorePos, isDragging])
```

### 3. Content CMS Pattern

**Two-pattern system** for making text admin-editable:

**Pattern A: EditableText (Visible DOM)**
```tsx
<h3>
  <EditableText id="property.gallery.title" defaultValue="Potential Spaces" category="property" />
</h3>
```

**Pattern B: getText() (Attributes/Variables)**
```tsx
<input placeholder={getText('auth.placeholder.email', 'you@example.com')} />
```

**Registration** (required):
```typescript
// src/components/panel/ContentTab.tsx
const DEFAULT_CONTENT = [
  { id: 'property.gallery.title', category: 'property', defaultValue: 'Potential Spaces' },
  // ...
]
```

### 4. Vote System Architecture

**Three-state model**:
```
User State:     [Neutral] ←→ [Upvoted] ←→ [Downvoted]
Brightness:        50          55           45
votersUp:          []          [uid]        []
votersDown:        []          []           [uid]
```

**State transitions**:
```typescript
// Neutral → Upvote: Add to votersUp, +5 brightness
// Upvoted → Vote down: Remove from votersUp, back to neutral (neutralize)
// Neutral → Vote down: Add to votersDown, -5 brightness
// Downvoted → Vote up: Remove from votersDown, back to neutral
```

**Key invariant**: User can only be in one state at a time

## Firestore Collections

### Properties (`rentalProperties`)
```typescript
{
  id: string
  address: string
  imageUrl: string           // Firebase Storage path
  cost: number | null
  brightness: number         // 0-100, default 50
  voters: string[]          // Legacy array
  votersUp: string[]        // UIDs who upvoted
  votersDown: string[]      // UIDs who downvoted
  createdBy: string
  createdAt: number
  updatedAt: number
}
```

### Email Templates (`emailTemplates`)
```typescript
{
  id: 'verify-email' | 'campaign-success' | 'campaign-ended' | 'campaign-update'
  html: string              // Full HTML with {{VARIABLES}}
  variables: string[]       // Extracted via /{{([A-Z_]+)}}/g
  updatedAt: number
  updatedBy: string
  version: number
}
```

### Site Content (`siteContent`)
```typescript
{
  id: string                // e.g., 'property.gallery.title'
  value: string
  category: string          // For grouping in Content panel
  updatedAt: number
  updatedBy: string
}
```

## Component Architecture

### Modal Pattern

**Full-screen modals** (property full-view, email preview):
```tsx
<div className="fixed inset-0 z-[250] bg-black/90">
  <button className="fixed top-4 right-4 z-[260]">Close</button>
  <div className="w-full h-full flex items-center justify-center">
    {/* Content */}
  </div>
</div>
```

**Z-index hierarchy**:
- Canvas: `z-0` (base layer)
- Property gallery: `z-10`
- Panel: `z-20`
- Modals: `z-200` (property), `z-250` (emails)
- Modal close buttons: `z-[210]`, `z-[260]`

### Responsive Design

**Breakpoints**:
- Mobile: `< 500px`
- Tablet: `500px - 900px`
- Desktop: `> 900px`

**Mobile safe zone** (for property gallery):
```typescript
const MOBILE_ZONE_LEFT = 37.0   // 532.5 / 1440 * 100
const MOBILE_ZONE_RIGHT = 63.0  // 907.5 / 1440 * 100
```

## State Management

**No global state library** - Uses React Context API:

- **AuthContext**: User auth, admin status
- **CanvasContext**: Canvas blocks, selection, undo/redo
- **ContentContext**: CMS content, getText() function
- **EffectsContext**: Vote celebration effects

## Security Model

### Firestore Rules (on `main` database)

```javascript
// Public read, authenticated write
match /rentalProperties/{propertyId} {
  allow read: if true;
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null
    && (resource.data.createdBy == request.auth.uid || isAdmin());
}

// Admin-only write
match /emailTemplates/{templateId} {
  allow read: if true;
  allow write: if request.auth != null && isAdmin();
}

function isAdmin() {
  return get(/databases/main/documents/admins/$(request.auth.token.email)).exists;
}
```

## Performance Optimizations

1. **Static export**: Entire site pre-rendered at build time
2. **Image optimization**: Next.js Image component (disabled for static export)
3. **Code splitting**: Automatic route-based splitting
4. **Real-time subscriptions**: Unsubscribe on component unmount
5. **Optimistic UI**: Immediate feedback before Firestore confirms

## Deployment Pipeline

```
git push → GitHub Actions → npm run build → Deploy to gh-pages branch
```

**Build process**:
1. `next build` - Creates static export in `out/`
2. Copies to `gh-pages` branch
3. GitHub Pages serves from `https://cwcorella-git.github.io/reno-dev-space/`

## Testing Strategy

### Playwright E2E Tests

**Challenges**:
- Requires Firebase auth (real user accounts)
- Dev server port conflicts
- Async Firestore updates need proper waits

**Current approach**:
- Test suite written for manual execution
- Focus on critical flows (voting, modals)
- Manual testing on deployed site

### Future Improvements

- Set up test Firebase project
- Seed test data in beforeEach
- Mock auth with custom tokens
- Run tests in CI/CD pipeline

## Known Limitations

1. **Static export**: Can't use Next.js Image optimization
2. **GitHub Pages**: No server-side rendering
3. **Firestore**: Requires client-side SDK (no server-side queries)
4. **Stripe**: Webhooks require external endpoint (Firebase Functions)

## Migration Considerations

If moving to Vercel/Netlify:
- Enable SSR for better performance
- Use Next.js Image optimization
- Consider Server Components for auth checks
- Move Firebase Functions to API routes
