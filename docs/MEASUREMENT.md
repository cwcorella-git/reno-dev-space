# Measurement System

## Overview

The Activated Measurement System replaces the legacy `overlapDetection.ts` with a sophisticated multi-layer coordinate normalization and collision detection pipeline. It provides accurate block dimension measurement via DOM queries, percentage-based coordinate normalization, and 3-tier collision checking for the Add Text placement flow.

**Location**: `src/lib/measurement/`

## Architecture

```
MeasurementService (singleton)
  ├── Measures DOM block dimensions
  ├── Caches results (5s TTL, hash-based invalidation)
  └── Converts DOM pixels → canvas percentages

CollisionDetector (singleton)
  ├── Uses MeasurementService for coordinate lookup
  ├── 3-tier collision: bounding-box → line-level → character-level
  └── checkAddTextCollision() — main API for canvas placement

MeasurementOverlay (component)
  ├── Admin debug visualization
  └── MeasurementControls embedded in CampaignPanel
```

## Coordinate System (CanvasRect)

All positions are normalized to **canvas percentages**:

```typescript
interface CanvasRect {
  x: number      // percentage of DESIGN_WIDTH (1440px)
  y: number      // percentage of DESIGN_HEIGHT (900px), unbounded for scroll
  width: number  // percentage of DESIGN_WIDTH
  height: number // percentage of DESIGN_HEIGHT
}
```

**Overflow zones**: Blocks may extend beyond 0–100% range:
- `OVERFLOW_LEFT = 10` → blocks can extend to -10% (left)
- `OVERFLOW_RIGHT = 10` → blocks can extend to 110% (right)

**DOM → Canvas conversion** (`domRectToCanvasRect`):
- Uses `getBoundingClientRect()` — works in CSS-transformed space
- Canvas CSS scale transforms are handled correctly via this approach
- No manual scale factor calculations needed

## MeasurementService

**Singleton**: `export const measurementService = new MeasurementService()`

### Measurement Levels

| Level | Detail | Cost | Use Case |
|-------|--------|------|---------|
| Bounding box | Full block dimensions | Fast | Most collision checks |
| Lines | Per-line rectangles | Medium | Multiline text refinement |
| Characters | Per-character rectangles | Expensive | Precise edge detection |

Character and line measurements are lazy-loaded (computed only when needed).

### Cache System

```typescript
interface MeasurementCache {
  boundingBox: CanvasRect
  lines?: LineRect[]
  characters?: CharRect[][]
  contentHash: string    // hash of all text content
  styleHash: string      // hash of fontSize, fontFamily, fontWeight
  timestamp: number      // invalidated after 5000ms
}
```

**Cache invalidation keys**:
- `contentHash`: Did the text change?
- `styleHash`: Did `fontSize`, `fontFamily`, or `fontWeight` change?
- Color and text alignment **do not** invalidate the cache (they don't affect bounding box dimensions)

**Fallback**: When DOM is unavailable, falls back to stored `block.x/y/width` and `block.height || 6` (6% height estimate).

### DOM Element Selection

Priority order for finding the text element within a block:
1. `.whitespace-pre-wrap`
2. `[contenteditable]`
3. The block element itself

Every block has a `data-block-id={block.id}` attribute for O(1) DOM lookup.

### Canvas Height Tracking

The service also tracks `canvasHeightPercent` (100 = DESIGN_HEIGHT):
- Grows immediately when blocks extend down
- Shrinks only after 300ms debounce (prevents jitter from measurement oscillation)
- Used to correctly normalize Y coordinates for blocks below the fold

## CollisionDetector

**Singleton**: `export const collisionDetector = new CollisionDetector()`

**Default config**: `enableCharacterLevel: false` — bounding-box only by default for performance.

### Main API

```typescript
checkAddTextCollision(
  x: number,           // cursor X as canvas percentage
  y: number,           // cursor Y as canvas percentage
  width: number,       // preview width as canvas percentage
  height: number,      // preview height as canvas percentage
  blocks: CanvasBlock[],
  canvasHeightPercent: number
): boolean             // true = collision detected
```

The preview rect is centered on the cursor position (offset by half width/height).

### 3-Tier Collision Pipeline

1. **Fast pass** (always runs): Bounding-box AABB check — if rects don't overlap, done
2. **Line pass** (optional): Checks individual line rects for multiline text
3. **Character pass** (optional, `enableCharacterLevel: true`): Checks per-character rects for precise edge detection

### Other Collision Methods

- `checkDragCollision(blockId, newX, newY, blocks)` — used during drag to detect overlaps
- `checkResizeCollision(blockId, newRect, blocks)` — used during resize handle drag

## MeasurementOverlay (Debug Tool)

Admin-only visual debug overlay. Accessible from CampaignPanel via `MeasurementControls`.

### Exports

- `MeasurementOverlay` — the visual overlay component
- `MeasurementControls` — the toggle UI panel (embedded in CampaignPanel)

### Visualization Layers

| Layer | Color | Description | Default |
|-------|-------|-------------|---------|
| Bounding boxes | Blue rectangles | Block measured bounds | On |
| Proximity zones | Amber dashed border | Collision margin around blocks | On |
| Line boxes | Teal rectangles | Per-line text bounds | Off |
| Character boxes | Green rectangles | Per-character bounds (expensive) | Off |
| Collision state | Red/green dot at cursor | Is cursor position in collision? | On |

### Stats Panel

Shows in real-time:
- Block count
- Cache size (number of cached measurements)

### MeasurementDebugConfig

```typescript
interface MeasurementDebugConfig {
  enabled: boolean
  showBoundingBoxes: boolean
  showProximityZones: boolean
  showLineBoxes: boolean
  showCharacterBoxes: boolean    // expensive — disables by default
  showCollisionState: boolean
}
```

## Usage in Canvas

### Add Text Flow

```typescript
// 1. On entering add-text mode:
const size = await measurementService.measureNewBlockSize(content, style)
setPreviewSize(size)

// 2. On mouse move:
const hasCollision = collisionDetector.checkAddTextCollision(
  cursorX, cursorY,
  previewWidth, previewHeight,
  blocks,
  canvasHeightPercent
)
setIsValidPlacement(!hasCollision)

// 3. On click to place:
const placedX = cursorX - previewWidth / 2
const placedY = cursorY - previewHeight / 2
addBlock({ x: placedX, y: placedY, ... })
```

### Height Tracking

```typescript
// ResizeObserver in Canvas.tsx watches all [data-block-id] elements
const observer = new ResizeObserver(measure)
canvas.querySelectorAll('[data-block-id]').forEach(el => observer.observe(el))

// On each measurement:
measurementService.updateCanvasHeight(measuredMaxY)
// → grows immediately, shrinks after 300ms debounce
```

## Legacy System

`src/lib/overlapDetection.ts` is the predecessor — a simpler bounding-box only check without DOM measurement or caching.

**Status**: Still actively imported. `Canvas.tsx` imports `measureNewBlockSize()` from it to measure new block preview dimensions before placement. This function is **not** superseded by `src/lib/measurement/` and remains in use.

All collision detection logic for existing blocks (drag, resize, placement overlap) has moved to `CollisionDetector` in `src/lib/measurement/`. Do not add new collision logic to `overlapDetection.ts` — extend `CollisionDetector` instead.
