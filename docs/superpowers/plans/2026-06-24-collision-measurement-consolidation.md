# Collision & Text-Measurement Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make canvas text-collision math correct and consistent by routing every overlap test through one pixel-space geometry helper, and eliminate stale-measurement and frozen-block bugs.

**Architecture:** The canvas stores positions as percentages on two *different* physical scales (x/width = % of 1440px, y/height = % of 900px). Today, six separate AABB implementations across two collision systems (`src/lib/measurement/*` and `src/lib/overlapDetection.ts`) compare x-percent against y-percent as if they shared a scale, and apply one scalar margin to both axes — so collision zones are skewed ovals that worsen as the canvas grows. This plan adds one pure pixel-space helper (`src/lib/measurement/geometry.ts`), converts all rects to pixels before testing, and routes both systems through it. A single **signed** pixel margin unifies the two systems' opposite intents (new system: positive margin = enforce gap; legacy: negative margin = overlap tolerance). Then it fixes the stale measurement cache (resize), the frozen-block confirm bug, and the add-text preview height basis, and deletes dead duplicates.

**Tech Stack:** TypeScript, Next.js 14, React 18. New dev dependency: **Vitest** (pure-function unit tests for the geometry module — the repo currently has only Playwright E2E, which cannot prove pure math cheaply).

## Global Constraints

- Block positions are percentages: `x`/`width` are % of `DESIGN_WIDTH = 1440`; `y`/`height` are % of `DESIGN_HEIGHT = 900` (the `canvasHeightPercent` unit, where 100 = one 900px screen; `y` is unbounded downward).
- Rendered as `left: ${x}%`, `top: ${(y/100)*900}px`. So **px-per-x-unit = 14.4**, **px-per-y-unit = 9.0**.
- `DESIGN_WIDTH` / `DESIGN_HEIGHT` are currently declared in `src/contexts/CanvasContext.tsx:30-31` and imported by many files. Keep those import paths working.
- Do **not** invent a new collision system or new public component. This is consolidation + correction of existing code only.
- Behavior parity target: collisions should feel the same on a short (unscrolled) canvas where the old math happened to be least wrong, and *correct* (no longer skewed) on tall canvases.
- Every task ends green on `npx tsc --noEmit` (ignore the pre-existing errors in `tests/` and `workers/`) and `npx eslint <changed files>`.

---

### Task 1: Pure pixel-space geometry helper + unit tests

**Files:**
- Modify: `src/types/canvas.ts` (add pure `DESIGN_WIDTH`/`DESIGN_HEIGHT` constants near top, after the `BlockSize` interface ~line 11)
- Modify: `src/contexts/CanvasContext.tsx:30-31` (re-export instead of re-declaring)
- Create: `src/lib/measurement/geometry.ts`
- Create: `src/lib/measurement/geometry.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency + `test:unit` script)

**Interfaces:**
- Produces:
  - `DESIGN_WIDTH: number`, `DESIGN_HEIGHT: number` (from `@/types/canvas`)
  - `interface PixelRect { left: number; top: number; right: number; bottom: number }`
  - `interface PercentRect { x: number; y: number; width: number; height: number }`
  - `PX_PER_X_UNIT: number`, `PX_PER_Y_UNIT: number`
  - `percentRectToPixels(r: PercentRect): PixelRect`
  - `rectsOverlapPx(a: PixelRect, b: PixelRect, marginPx?: number): boolean` — positive `marginPx` grows `b` (enforce gap), negative shrinks `b` (overlap tolerance)
  - `percentRectsOverlap(a: PercentRect, b: PercentRect, marginPx?: number): boolean`

- [ ] **Step 1: Move design constants into the pure types module**

In `src/types/canvas.ts`, after the `BlockSize` interface (around line 11), add:

```typescript
// Base design canvas dimensions (px). The single source of truth.
// x/width percentages are of DESIGN_WIDTH; y/height percentages are of DESIGN_HEIGHT.
export const DESIGN_WIDTH = 1440
export const DESIGN_HEIGHT = 900 // Base "one screen" height in pixels
```

- [ ] **Step 2: Re-export the constants from CanvasContext for back-compat**

In `src/contexts/CanvasContext.tsx`, replace lines 30-31:

```typescript
export const DESIGN_WIDTH = 1440
export const DESIGN_HEIGHT = 900 // Base "one screen" height in pixels
```

with:

```typescript
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '@/types/canvas'
export { DESIGN_WIDTH, DESIGN_HEIGHT }
```

Place the `import` with the other imports at the top of the file (not mid-file), and keep only the `export { ... }` re-export line where lines 30-31 were. Every existing `import { DESIGN_WIDTH } from '@/contexts/CanvasContext'` keeps working.

- [ ] **Step 3: Write the geometry module**

Create `src/lib/measurement/geometry.ts`:

```typescript
/**
 * Pure pixel-space geometry for canvas collision.
 *
 * The canvas uses TWO percentage scales: x/width are % of DESIGN_WIDTH (1440),
 * y/height are % of DESIGN_HEIGHT (900). Comparing them directly is wrong
 * because 1% of x (14.4px) != 1% of y (9px). Every overlap test must convert
 * to pixels first. This module is the ONE place that happens.
 */
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '@/types/canvas'

export interface PixelRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** A rect in canvas percentage space: x/width are %-of-1440, y/height are %-of-900. */
export interface PercentRect {
  x: number
  y: number
  width: number
  height: number
}

export const PX_PER_X_UNIT = DESIGN_WIDTH / 100  // 14.4 px per 1% on x
export const PX_PER_Y_UNIT = DESIGN_HEIGHT / 100 // 9.0 px per 1% on y

/** Convert a percentage-space rect to pixels in the design canvas. */
export function percentRectToPixels(r: PercentRect): PixelRect {
  const left = r.x * PX_PER_X_UNIT
  const top = r.y * PX_PER_Y_UNIT
  return {
    left,
    top,
    right: left + r.width * PX_PER_X_UNIT,
    bottom: top + r.height * PX_PER_Y_UNIT,
  }
}

/**
 * AABB overlap test in pixel space.
 * `marginPx` adjusts rect `b`'s effective hit zone on ALL sides:
 *   - positive  -> grow b   (enforce a gap; blocks must stay marginPx apart)
 *   - negative  -> shrink b  (tolerance; allow up to |marginPx| of overlap)
 */
export function rectsOverlapPx(a: PixelRect, b: PixelRect, marginPx = 0): boolean {
  return !(
    a.right <= b.left - marginPx ||
    a.left >= b.right + marginPx ||
    a.bottom <= b.top - marginPx ||
    a.top >= b.bottom + marginPx
  )
}

/** Convenience: overlap test for two percentage-space rects. */
export function percentRectsOverlap(a: PercentRect, b: PercentRect, marginPx = 0): boolean {
  return rectsOverlapPx(percentRectToPixels(a), percentRectToPixels(b), marginPx)
}
```

- [ ] **Step 4: Write the failing unit tests**

Create `src/lib/measurement/geometry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  percentRectToPixels,
  rectsOverlapPx,
  percentRectsOverlap,
  PX_PER_X_UNIT,
  PX_PER_Y_UNIT,
} from './geometry'

describe('percentRectToPixels', () => {
  it('uses 14.4px per x-unit and 9px per y-unit', () => {
    expect(PX_PER_X_UNIT).toBeCloseTo(14.4)
    expect(PX_PER_Y_UNIT).toBeCloseTo(9.0)
    const px = percentRectToPixels({ x: 10, y: 10, width: 10, height: 10 })
    expect(px.left).toBeCloseTo(144)
    expect(px.top).toBeCloseTo(90)
    expect(px.right).toBeCloseTo(288)
    expect(px.bottom).toBeCloseTo(180)
  })
})

describe('rectsOverlapPx', () => {
  const a = { left: 0, top: 0, right: 100, bottom: 100 }
  it('detects clear overlap', () => {
    expect(rectsOverlapPx(a, { left: 50, top: 50, right: 150, bottom: 150 })).toBe(true)
  })
  it('detects clear separation', () => {
    expect(rectsOverlapPx(a, { left: 200, top: 0, right: 300, bottom: 100 })).toBe(false)
  })
  it('positive margin enforces a gap (touching rects collide)', () => {
    const touching = { left: 100, top: 0, right: 200, bottom: 100 }
    expect(rectsOverlapPx(a, touching, 0)).toBe(false)
    expect(rectsOverlapPx(a, touching, 10)).toBe(true)
  })
  it('negative margin tolerates overlap', () => {
    const overlapping = { left: 95, top: 0, right: 195, bottom: 100 }
    expect(rectsOverlapPx(a, overlapping, 0)).toBe(true)
    expect(rectsOverlapPx(a, overlapping, -10)).toBe(false)
  })
})

describe('percentRectsOverlap — axis symmetry regression', () => {
  // THE core bug: equal *visual* (pixel) gaps must be judged equally on both axes,
  // even though the percentage numbers differ between x and y.
  it('treats a 14.4px horizontal gap and a 14.4px vertical gap identically', () => {
    const base = { x: 10, y: 10, width: 10, height: 10 } // 144px..288px / 90px..180px
    // Horizontal neighbor 1 x-unit (14.4px) to the right of base's right edge:
    const horiz = { x: 21, y: 10, width: 10, height: 10 }
    // Vertical neighbor 1.6 y-units (14.4px) below base's bottom edge:
    const vert = { x: 10, y: 21.6, width: 10, height: 10 }
    // With a 14.4px margin, BOTH should just barely collide; without, neither.
    expect(percentRectsOverlap(base, horiz, 0)).toBe(false)
    expect(percentRectsOverlap(base, vert, 0)).toBe(false)
    expect(percentRectsOverlap(base, horiz, 14.5)).toBe(true)
    expect(percentRectsOverlap(base, vert, 14.5)).toBe(true)
  })
})
```

- [ ] **Step 5: Add Vitest config and script**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

In `package.json`, add to `devDependencies`: `"vitest": "^2.1.0"`, and to `scripts`: `"test:unit": "vitest run"`.

- [ ] **Step 6: Install and run tests to verify they pass**

Run: `npm install && npm run test:unit`
Expected: all geometry tests PASS (4 describe blocks). If the axis-symmetry test fails, the conversion constants are wrong — fix `geometry.ts`, not the test.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "canvas|geometry|CanvasContext" || echo OK`
Expected: `OK` (no new errors from the moved constants).

- [ ] **Step 8: Commit**

```bash
git add src/types/canvas.ts src/contexts/CanvasContext.tsx src/lib/measurement/geometry.ts src/lib/measurement/geometry.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat(canvas): add pixel-space geometry helper + unit tests

Single source of truth for collision math. Converts both percentage axes
to pixels before AABB so x%(of 1440) and y%(of 900) are no longer compared
as if equal. Signed margin unifies gap-enforcement and overlap-tolerance."
```

---

### Task 2: Route CollisionDetector through the geometry helper

**Files:**
- Modify: `src/lib/measurement/CollisionDetector.ts` (`rectsIntersect` :219, `expandRect` :206, `checkCollision` :60-75, `getProximityZones` :268)
- Modify: `src/lib/measurement/types.ts` (`CollisionConfig.proximityMargin` semantics → px; `DEFAULT_COLLISION_CONFIG` :121)

**Interfaces:**
- Consumes: `percentRectsOverlap`, `PercentRect` from `./geometry` (Task 1)
- Produces: unchanged public methods (`checkCollision`, `checkMoveCollision`, `checkAddTextCollision`, `checkResizeCollision`, `getProximityZones`) — same signatures, corrected internals.

- [ ] **Step 1: Change the proximity margin to pixels**

In `src/lib/measurement/types.ts`, update the `CollisionConfig` comment and default. Replace line 96:

```typescript
  proximityMargin: number       // percentage margin (default: 1)
```

with:

```typescript
  proximityMargin: number       // pixel gap enforced around each block (default: 12)
```

And in `DEFAULT_COLLISION_CONFIG` (line 121-124) change `proximityMargin: 1` to `proximityMargin: 12`. (12px ≈ the old 1%-of-x margin, now applied symmetrically in real pixels.)

- [ ] **Step 2: Rewrite `rectsIntersect` and `expandRect` to use pixels**

In `src/lib/measurement/CollisionDetector.ts`, add at the top with the other imports:

```typescript
import { percentRectsOverlap, percentRectToPixels, PX_PER_X_UNIT, PX_PER_Y_UNIT } from './geometry'
```

Replace the body of `checkCollision`'s per-block loop (lines 55-75) so the bounding-box test uses the pixel helper with the px margin, and the proximity zone is expanded *asymmetrically in percent* so the debug overlay stays honest:

```typescript
    for (const block of existingBlocks) {
      // Skip excluded blocks
      if (excludeIds.includes(block.id)) continue

      // Get measured bounding box (percentage space)
      const blockBounds = measurementService.getBoundingBox(block)

      // Create proximity zone for visualization (expanded by the px margin,
      // converted back to each axis's percentage so the overlay matches reality)
      const zone: ProximityZone = {
        blockId: block.id,
        inner: blockBounds,
        outer: this.expandRect(blockBounds, this.config.proximityMargin),
        margin: this.config.proximityMargin,
      }
      proximityZones.push(zone)

      // Pixel-space collision with the configured gap
      if (percentRectsOverlap(proposedRect, blockBounds, this.config.proximityMargin)) {
        collidingBlockIds.push(block.id)
      }
    }
```

- [ ] **Step 3: Make `expandRect` margin px-correct (asymmetric in percent)**

Replace `expandRect` (lines 206-213):

```typescript
  private expandRect(rect: CanvasRect, marginPx: number): CanvasRect {
    const mx = marginPx / PX_PER_X_UNIT // px -> x-percent units
    const my = marginPx / PX_PER_Y_UNIT // px -> y-percent units
    return {
      x: rect.x - mx,
      y: rect.y - my,
      width: rect.width + mx * 2,
      height: rect.height + my * 2,
    }
  }
```

- [ ] **Step 4: Fix `rectsIntersect` (used only by the character-level path now)**

Replace `rectsIntersect` (lines 219-227) so it also goes through pixels:

```typescript
  private rectsIntersect(a: CanvasRect, b: CanvasRect): boolean {
    return percentRectsOverlap(a, b, 0)
  }
```

(`CanvasRect` and `PercentRect` are structurally identical `{x,y,width,height}`; passing one where the other is expected typechecks.)

- [ ] **Step 5: Update `getProximityZones` to pass through (no logic change needed)**

`getProximityZones` (line 268) already calls `this.expandRect(blockBounds, this.config.proximityMargin)`; with Step 3 it now expands correctly. No edit required — confirm by reading it.

- [ ] **Step 6: Typecheck + lint + unit tests**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -iE "collision|measurement" || echo OK
npx eslint src/lib/measurement/CollisionDetector.ts src/lib/measurement/types.ts
npm run test:unit
```
Expected: `OK`, no lint errors, geometry tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/measurement/CollisionDetector.ts src/lib/measurement/types.ts
git commit -m "fix(canvas): collision detector tests overlap in pixel space

rectsIntersect/expandRect no longer compare x% against y%. Proximity
margin is now a symmetric pixel gap (12px). Overlay zones expand
asymmetrically in percent so the debug overlay matches the real hit zone."
```

---

### Task 3: Invalidate measurement cache on resize/move so collision reads the live box

**Files:**
- Modify: `src/components/canvas/CanvasBlock.tsx` (resize-overlap effect :95-108; move commit :255-299; resize commit :353-373)

**Interfaces:**
- Consumes: `measurementService.invalidate(blockIds: string[])` (already exists, `MeasurementService.ts:131`, currently unused) and `collisionDetector` (already imported).

**Background:** The measurement cache (`MeasurementService.isCacheValid` :364) keys only on content + font hash + a 5s timeout. A *width* change matches none of those, so `getBoundingBox` returns the pre-resize box for up to 5s — and `checkResizeCollision` uses that stale height. During a live resize, `block.width` hasn't committed yet, so the cleanest fix is to drop the cached entry right before each check, forcing a re-measure of the already-rendered DOM (the effect runs post-render, so the DOM shows the new width and its reflowed height).

- [ ] **Step 1: Invalidate before the live resize-overlap check**

In `src/components/canvas/CanvasBlock.tsx`, in the resize effect (lines 95-108), add an `invalidate` call before the collision check. Replace lines 100-107:

```typescript
    const result = collisionDetector.checkResizeCollision(
      block.id,
      resizeWidth?.width ?? block.width,
      block,
      blocks,
      canvasHeightPercent
    )
    setIsResizeOverlapping(result.collides)
```

with:

```typescript
    // The DOM has already re-rendered at the new width (this effect runs
    // post-commit), but the cache still holds the old box. Drop it so the
    // collision check re-measures the actual reflowed height.
    measurementService.invalidate([block.id])
    const result = collisionDetector.checkResizeCollision(
      block.id,
      resizeWidth?.width ?? block.width,
      block,
      blocks,
      canvasHeightPercent
    )
    setIsResizeOverlapping(result.collides)
```

Add the import at the top of the file if not present:

```typescript
import { measurementService } from '@/lib/measurement'
```

(Verify `@/lib/measurement/index.ts` re-exports `measurementService` — it does, line 12.)

- [ ] **Step 2: Invalidate before the resize-commit check**

In the resize commit (lines 354-369), add `measurementService.invalidate([block.id])` immediately before the `collisionDetector.checkResizeCollision(...)` call at line 356.

- [ ] **Step 3: Invalidate before the move-commit check**

In the move commit (lines 257-265), add `measurementService.invalidate([block.id])` immediately before `collisionDetector.checkMoveCollision(...)` at line 258. (A moved block's own box doesn't change shape, but neighbors it now sits among may have grown since last cached; invalidating the moving block is cheap and keeps its height honest after any prior reflow.)

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "CanvasBlock" || echo OK
npx eslint src/components/canvas/CanvasBlock.tsx
```
Expected: `OK`, no lint errors.

- [ ] **Step 5: Manual verification (resize reflow)**

Run `npm run dev`, sign in as admin, create two stacked text blocks close together. Narrow the upper block so its text wraps to more lines (grows taller). Expected: the red "overlapping" state now appears as soon as the reflowed box reaches the lower block — not one drag-step late, and not after a multi-second delay.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/CanvasBlock.tsx
git commit -m "fix(canvas): invalidate measurement cache before resize/move checks

Width resizes never matched the cache key (content+font only), so
collision read a stale box for up to 5s. Invalidate the block before
each check so it re-measures the live reflowed DOM. Wires in the
previously-dead measurementService.invalidate()."
```

---

### Task 4: Fix add-text preview height basis + remove always-on console logs

**Files:**
- Modify: `src/lib/overlapDetection.ts` (`measureNewBlockSize` :62-63)
- Modify: `src/components/canvas/Canvas.tsx` (the `console.log` at ~:623; verify preview/collision still agree)

**Background:** `measureNewBlockSize` divides measured pixel height by `canvasRect.height` (the FULL scrolled canvas height) → a whole-canvas fraction, while every consumer treats that number as a `canvasHeightPercent`-unit value. They only agree when the canvas is one screen tall. The fix: divide height by the same per-screen basis the renderer and collision system use (`canvasRect.width / DESIGN_WIDTH * DESIGN_HEIGHT` = the pixel size of one design screen at the current scale).

- [ ] **Step 1: Correct the height-percent basis**

In `src/lib/overlapDetection.ts`, add at the top:

```typescript
import { CanvasBlock } from '@/types/canvas'
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '@/types/canvas'
```

(Combine with the existing import line if preferred.) Then replace lines 61-63:

```typescript
  // Convert to percentages of canvas
  const widthPercent = (rect.width / canvasRect.width) * 100
  const heightPercent = (rect.height / canvasRect.height) * 100
```

with:

```typescript
  // Convert to percentages. Width is %-of-canvas-width (= %-of-1440).
  // Height must be in canvasHeightPercent units (100 = one DESIGN_HEIGHT
  // screen), NOT a fraction of the full scrolled canvas — otherwise the
  // value disagrees with the collision system once the canvas scrolls.
  const oneScreenPx = (canvasRect.width / DESIGN_WIDTH) * DESIGN_HEIGHT
  const widthPercent = (rect.width / canvasRect.width) * 100
  const heightPercent = (rect.height / oneScreenPx) * 100
```

- [ ] **Step 2: Remove the always-on placement log**

In `src/components/canvas/Canvas.tsx`, delete the `console.log('[Canvas] Measured preview size:', ...)` statement (around line 623, inside the add-text measurement effect). It fires on every add-mode entry.

- [ ] **Step 3: Typecheck + lint**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -iE "overlapDetection|Canvas.tsx" || echo OK
npx eslint src/lib/overlapDetection.ts src/components/canvas/Canvas.tsx
```
Expected: `OK`, no lint errors.

- [ ] **Step 4: Manual verification (preview matches placement)**

`npm run dev`, admin. Scroll the canvas down so it is several screens tall. Enter add-text mode and move the cursor near existing blocks low on the canvas. Expected: the dashed preview box is the same height as the block that actually appears on click, and the red "can't place" state lines up with the real blocks (no phantom rejections, no accepted overlaps).

- [ ] **Step 5: Commit**

```bash
git add src/lib/overlapDetection.ts src/components/canvas/Canvas.tsx
git commit -m "fix(canvas): add-text preview height uses per-screen basis

measureNewBlockSize divided by the full scrolled canvas height, so the
preview/collision/placement disagreed once the canvas scrolled. Use the
one-screen pixel basis (canvasHeightPercent units) to match the renderer
and collision system. Drop an always-on console.log."
```

---

### Task 5: Stop `pendingPosRef` from freezing a block after drag

**Files:**
- Modify: `src/components/canvas/CanvasBlock.tsx` (confirm effect :69-80; touch-drag confirm path if present near :427-436)

**Background:** After a drag, `pendingPosRef` holds the local position and is cleared only when a Firestore snapshot arrives matching within `0.01`. If the saved value is clamped or rounded so it never matches within `0.01`, both `dragPos` and `pendingPosRef` stay set and the block stops responding to updates until reload. Fix: widen the tolerance to a sub-pixel-but-robust value, and add a safety timeout that force-clears after 1s so a never-matching confirm can't freeze the block.

- [ ] **Step 1: Widen tolerance and add a safety timeout**

In `src/components/canvas/CanvasBlock.tsx`, replace the confirm effect (lines 69-80):

```typescript
  // Clear dragPos when Firestore confirms the new position (prevents jitter)
  useEffect(() => {
    if (pendingPosRef.current && !isDragging) {
      const tolerance = 0.01 // Small tolerance for floating point comparison
      const xMatches = Math.abs(block.x - pendingPosRef.current.x) < tolerance
      const yMatches = Math.abs(block.y - pendingPosRef.current.y) < tolerance
      if (xMatches && yMatches) {
        // Firestore has confirmed the position, safe to clear local state
        pendingPosRef.current = null
        setDragPos(null)
      }
    }
  }, [block.x, block.y, isDragging])
```

with:

```typescript
  // Clear dragPos when Firestore confirms the new position (prevents jitter).
  // Tolerance is sub-pixel at 1440px width (0.5% x ~= 7px is too loose; 0.05%
  // x ~= 0.7px). A clamped/rounded save can differ from the local drag value
  // by more than the old 0.01, which would strand the block — so we also arm a
  // 1s safety timeout that force-clears regardless.
  useEffect(() => {
    if (!pendingPosRef.current || isDragging) return

    const tolerance = 0.05
    const xMatches = Math.abs(block.x - pendingPosRef.current.x) < tolerance
    const yMatches = Math.abs(block.y - pendingPosRef.current.y) < tolerance
    if (xMatches && yMatches) {
      pendingPosRef.current = null
      setDragPos(null)
      return
    }

    const safety = setTimeout(() => {
      pendingPosRef.current = null
      setDragPos(null)
    }, 1000)
    return () => clearTimeout(safety)
  }, [block.x, block.y, isDragging])
```

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "CanvasBlock" || echo OK
npx eslint src/components/canvas/CanvasBlock.tsx
```
Expected: `OK`, no lint errors.

- [ ] **Step 3: Manual verification (no stuck block)**

`npm run dev`, admin. Drag a block to the extreme edge (where clamping applies) repeatedly and quickly. Expected: the block always settles and remains draggable afterward (never freezes requiring reload). With two browser windows, a drag in one reflects in the other within ~1s.

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/CanvasBlock.tsx
git commit -m "fix(canvas): prevent pendingPosRef from freezing a dragged block

A clamped/rounded Firestore save could differ from the local drag value
by more than the 0.01 tolerance, stranding the block. Widen tolerance to
0.05 and arm a 1s safety timeout that force-clears the pending state."
```

---

### Task 6: Delete dead collision code

**Files:**
- Delete: `src/hooks/useDragResize.ts` (unreferenced; obsolete flat-0-100 Y model that contradicts the live system)
- Modify: `src/lib/overlapDetection.ts` (remove `wouldOverlapDOM` :188-272 and `wouldBlockOverlap` :139-173 — both have zero importers)

**Background:** Confirmed unused by the audit: `useDragResize.ts` is imported nowhere; `wouldOverlapDOM` was replaced by `collisionDetector.checkAddTextCollision`; `wouldBlockOverlap` has no callers. Removing them deletes duplicate AABB copies that still carry the axis bug, so it can't creep back in via a stale helper. Keep `wouldOverlap`, `findOpenPosition`, `rectanglesOverlap`, `checkDOMOverlap`, `estimateRectAfterFontSizeChange`, `displacOverlappingBlocks`, `measureNewBlockSize`, `getBlockHeightPercent` — all still live (Task 7 corrects their math).

- [ ] **Step 1: Confirm zero importers before deleting**

Run:
```bash
grep -rn "useDragResize\|wouldOverlapDOM\|wouldBlockOverlap" src/ --include=*.ts --include=*.tsx
```
Expected: matches ONLY inside `src/hooks/useDragResize.ts` and the definitions in `src/lib/overlapDetection.ts`. If any other file imports them, STOP and report — do not delete.

- [ ] **Step 2: Delete the dead hook**

Run: `git rm src/hooks/useDragResize.ts`

- [ ] **Step 3: Remove the two dead functions**

In `src/lib/overlapDetection.ts`, delete the entire `wouldOverlapDOM` function (lines 188-272, including its doc comment starting ~line 176) and the entire `wouldBlockOverlap` function (lines 139-173, including its doc comment ~line 134). Leave the `OVERLAP_TOLERANCE` constant (still used by `checkDOMOverlap`).

- [ ] **Step 4: Typecheck + lint + build**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -iE "overlapDetection|useDragResize" || echo OK
npx eslint src/lib/overlapDetection.ts
npm run build 2>&1 | tail -5
```
Expected: `OK`, no lint errors, build succeeds (static export to `out/`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(canvas): delete dead collision code

Remove unreferenced useDragResize.ts (obsolete Y model) and the unused
wouldOverlapDOM / wouldBlockOverlap functions — duplicate AABBs that
still carried the axis bug. Live paths are unaffected."
```

---

### Task 7: Route the remaining legacy percent-space checks through the geometry helper

**Files:**
- Modify: `src/lib/overlapDetection.ts` (`wouldOverlap` :104-132, `rectanglesOverlap` :383-393, `checkDOMOverlap` :287-320, `findOpenPosition` :355-378)

**Background:** With the dead functions gone, the still-live legacy checks must use the same pixel-space math. `wouldOverlap` and `rectanglesOverlap` currently mix axes; `checkDOMOverlap` already works in screen pixels but applies a single `OVERLAP_TOLERANCE` to both axes — express it as a signed (negative) px margin via the shared helper for consistency. `findOpenPosition` should bound its scan by `canvasHeightPercent` instead of the literal `200`.

- [ ] **Step 1: Reroute `wouldOverlap`**

In `src/lib/overlapDetection.ts`, ensure the geometry import is present:

```typescript
import { percentRectsOverlap, rectsOverlapPx, PX_PER_X_UNIT } from '@/lib/measurement/geometry'
```

Replace the body of `wouldOverlap` (lines 111-131) so it builds percent rects and delegates:

```typescript
  const newRect = { x: newX, y: newY, width: NEW_BLOCK_WIDTH, height: NEW_BLOCK_HEIGHT }

  for (const block of blocks) {
    const blockRect = {
      x: block.x,
      y: block.y,
      width: block.width || 5,
      height: getBlockHeightPercent(block.id, canvasHeightPercent),
    }
    // `padding` is a percentage-x value in the old API; convert to px for the
    // symmetric margin (0 in every current caller, so this is a no-op today).
    if (percentRectsOverlap(newRect, blockRect, padding * PX_PER_X_UNIT)) {
      return true
    }
  }
  return false
```

- [ ] **Step 2: Reroute `rectanglesOverlap`**

Replace `rectanglesOverlap` (lines 383-393):

```typescript
function rectanglesOverlap(
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number }
): boolean {
  return percentRectsOverlap(r1, r2, 0)
}
```

- [ ] **Step 3: Express `checkDOMOverlap` tolerance via the shared helper**

In `checkDOMOverlap` (lines 307-317), replace the inline per-edge tolerance test with the shared pixel helper using a NEGATIVE margin (tolerance lets padded boxes overlap):

```typescript
  for (const other of otherRects) {
    // Negative margin = tolerance: allow up to OVERLAP_TOLERANCE px of overlap
    // (padding) before flagging. `targetRect`/`other` are screen-pixel rects.
    if (rectsOverlapPx(targetRect, other, -OVERLAP_TOLERANCE)) {
      return true
    }
  }
  return false
```

(`Rect` here is `{left,top,right,bottom}` — exactly `PixelRect`, so it passes to `rectsOverlapPx` directly.)

- [ ] **Step 4: Bound `findOpenPosition` by canvas height**

Replace the scan loop bounds in `findOpenPosition` (lines 366-374):

```typescript
  const stepX = Math.max(blockWidth + 1, 6)
  const stepY = 3
  const yCeiling = Math.max(canvasHeightPercent, 100)
  for (let y = 5; y < yCeiling; y += stepY) {
    for (let x = 5; x < 95; x += stepX) {
      if (!wouldOverlap(x, y, blocks, 0, canvasHeightPercent)) {
        return { x, y }
      }
    }
  }
```

- [ ] **Step 5: Typecheck + lint + unit tests + build**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "overlapDetection" || echo OK
npx eslint src/lib/overlapDetection.ts
npm run test:unit
npm run build 2>&1 | tail -5
```
Expected: `OK`, no lint errors, tests pass, build succeeds.

- [ ] **Step 6: Manual verification (gallery displacement + history restore)**

`npm run dev`, admin. (a) Drag the property gallery over a cluster of text blocks; expected: only blocks actually under the gallery move, and they relocate to evenly-spaced open positions (no skew). (b) Delete a block, then restore it from the History panel on a tall canvas; expected: it lands in a nearby open spot, not dumped far below.

- [ ] **Step 7: Commit**

```bash
git add src/lib/overlapDetection.ts
git commit -m "fix(canvas): route legacy percent checks through pixel geometry

wouldOverlap/rectanglesOverlap no longer mix x% and y%; checkDOMOverlap
expresses its 24px tolerance as a signed margin; findOpenPosition scans
to canvasHeightPercent instead of a hardcoded 200. Both collision
systems now share one pixel-space AABB."
```

---

## Verification (whole-plan, after all tasks)

- [ ] `npm run test:unit` — geometry unit tests green
- [ ] `npx tsc --noEmit` — no NEW errors (pre-existing `tests/` + `workers/` errors unchanged)
- [ ] `npm run build` — static export succeeds
- [ ] Manual smoke on a TALL (multi-screen) canvas as admin: add-text near blocks (preview matches placement), drag blocks together (symmetric gap top/bottom vs left/right), resize-to-reflow (overlap flags immediately), gallery displacement, history restore, and rapid edge drags (no frozen block).
- [ ] Toggle the Measurement Overlay (admin dev tool) and confirm the amber proximity ring now matches where drops are actually blocked.

## Self-Review notes

- **Spec coverage:** Axis bug → Tasks 1,2,7. Stale cache → Task 3. Preview height basis → Task 4. Frozen block → Task 5. Dead code → Task 6. All five audit clusters covered.
- **Type consistency:** `PercentRect` and `CanvasRect` are both `{x,y,width,height}` (structural match — no adapter needed). `PixelRect` and legacy `Rect` are both `{left,top,right,bottom}`. `percentRectsOverlap`/`rectsOverlapPx`/`percentRectToPixels`/`PX_PER_X_UNIT`/`PX_PER_Y_UNIT` names used identically in every task that consumes them.
- **Margin semantics:** positive px margin = enforce gap (CollisionDetector); negative = tolerance (checkDOMOverlap). One signed helper, verified by Task 1 Step 4 tests.
- **Out of scope (deliberately deferred):** the disabled character-level path (`enableCharacterLevel: false`) is left in place but now uses the corrected `rectsIntersect`; `LINE_THRESHOLD` scale sensitivity (overlay-only) is not addressed — note for a future pass.
</content>
</invoke>
