# Overlap Detection Debugging Log

## Problem Statement

**User Report**: Cannot place text blocks next to existing blocks in "Add Text" mode. The system shows "Can't place here - overlapping" even when there's visible clear space. Behavior is asymmetric: LEFT approach sometimes works, but TOP/BOTTOM/RIGHT are blocked.

**Observed Behavior**:
1. Blocks CAN overlap when dragged (drag uses different detection)
2. "Add Text" mode blocks placement even with visible gaps
3. LEFT approach appears to work better than other directions

---

## Session Attempts (All Failed)

### Attempt 1: Increase OVERLAP_TOLERANCE
**File**: `src/lib/overlapDetection.ts`
**Change**: `OVERLAP_TOLERANCE = 0 → 8 → 16 → 24px`
**Rationale**: Allow padding boxes to touch without flagging text overlap
**Result**: ❌ No change in behavior
**Why it failed**: Tolerance affects the shrink of existing block hit zones, but the core issue is elsewhere

### Attempt 2: Fix height coordinate calculation
**File**: `src/lib/overlapDetection.ts`
**Change**: In `wouldOverlapDOM`, changed height calculation divisor
**Rationale**: Suspected wrong conversion between canvas % and screen pixels
**Result**: ❌ No change in behavior
**Why it failed**: The conversion was actually correct

### Attempt 3: Remove non-scaling minHeight from preview
**File**: `src/components/canvas/Canvas.tsx`
**Change**: Removed `minHeight` CSS constraint on preview box
**Rationale**: Suspected preview was larger than intended
**Result**: ❌ No change in behavior
**Why it failed**: minHeight wasn't the limiting factor

### Attempt 4: Fix stale closure with previewSizeRef
**File**: `src/components/canvas/Canvas.tsx`
**Change**: Added `previewSizeRef` alongside `previewSize` state, handlers read from ref
**Rationale**: React effects were capturing old `previewSize` before measurement completed
**Result**: ❌ No change in behavior
**Why it failed**: Even with correct size, detection still blocks valid placements

### Attempt 5: Add verbose debug logging
**Files**: `Canvas.tsx`, `overlapDetection.ts`
**Change**: Added console.log for every overlap check with all values
**Rationale**: Need to see actual values being compared
**Result**: ⚠️ Diagnostic only - revealed info but didn't fix
**Finding**: Confirmed preview uses measured size (~1.5% height) not default 6%

### Attempt 6: Center preview on cursor
**Files**: `Canvas.tsx`, `overlapDetection.ts`
**Changes**:
- Preview CSS: `transform: 'translate(-50%, -50%)'`
- `wouldOverlapDOM()`: Calculate centered coordinates instead of top-left
- Click handlers: Offset placement by half preview size
**Rationale**: Asymmetry caused by preview extending RIGHT/DOWN from cursor
**Result**: ❌ No change in behavior
**Why it failed**: Unknown - the math should have made approaches symmetric

---

## Diagnostic Findings

### From Playwright Tests

```
Canvas: 1728x3130px (very tall, extends below viewport)
Canvas heightPercent: 347.7% (of 900px design height)

Actual block dimensions:
- Screen size: 184x48px typical
- Canvas %: ~10.7% width × 1.5% height

Expected preview size:
- If text is ~48px: height = 1.53% of canvas
- If using default 6%: height = 187.776px (THIS IS THE BUG!)

Tolerance math (with 150x50px preview, 24px tolerance):
- LEFT approach: preview.x <= 36 (very restrictive)
- RIGHT approach: preview.x >= 300
- TOP approach: preview.y <= 30 (very restrictive)
- BOTTOM approach: preview.y >= 80
```

### Key Observations

1. **Two different overlap systems**:
   - `wouldOverlapDOM()` - Used by Add Text mode (DOM-based, pixel accurate)
   - `checkDOMOverlap()` - Used by drag mode (also DOM-based)
   - `wouldOverlap()` / `wouldBlockOverlap()` - Percentage-based (legacy?)

2. **Preview measurement works**: `measureNewBlockSize()` returns correct ~1.5% height

3. **Values pass through correctly**: Logging shows measured values reach `wouldOverlapDOM()`

4. **Tolerance is applied**: The shrink calculation runs, but still blocks

---

## Anti-Patterns Identified

### 1. Changing tolerance without understanding root cause
Increasing tolerance (0→8→16→24px) doesn't help if the fundamental comparison is wrong.

### 2. Assuming stale closure without verification
Added `previewSizeRef` pattern but logs showed values were already correct.

### 3. Centering preview without testing placement offset
Changed detection to centered coordinates but may have introduced mismatch between:
- Where detection thinks the block will be
- Where the block actually gets placed

### 4. Multiple coordinate systems
The codebase uses at least 3 coordinate systems:
- Screen pixels (getBoundingClientRect)
- Canvas percentage 0-100 (x coordinate)
- Canvas heightPercent 0-347+ (y coordinate)
Conversions between these may have errors.

### 5. Trusting visual preview matches detection
The CSS preview box may not match what `wouldOverlapDOM()` calculates.

---

## Unexplored Areas

### 1. Verify detection actually runs
Add a `console.log('OVERLAP DETECTED')` right before `return true` in `wouldOverlapDOM()` to confirm it's this function blocking placement (not something else).

### 2. Compare drag vs Add Text detection
Drag allows overlap but Add Text doesn't. What's different?
- Drag uses `checkDOMOverlap()`
- Add Text uses `wouldOverlapDOM()`
Are they using different logic?

### 3. Check if something else blocks placement
Is there another check besides overlap that returns early? Search for all `return` statements in the click handler.

### 4. Validate coordinate conversion
Create a test that:
1. Clicks at a known screen position
2. Logs the converted canvas coordinates
3. Compares to expected values

### 5. Check CSS transform interference
The canvas has `transform: scale()` for responsive sizing. Does this affect `getBoundingClientRect()` values?

### 6. Verify block placement coordinates
When a block IS successfully placed, do its stored coordinates match where the preview showed?

---

## Files Involved

| File | Role |
|------|------|
| `src/lib/overlapDetection.ts` | Core detection functions |
| `src/components/canvas/Canvas.tsx` | Add Text mode UI + handlers |
| `src/components/canvas/CanvasBlock.tsx` | Drag detection |
| `src/contexts/CanvasContext.tsx` | `addText()` function |
| `src/lib/storage/canvasStorage.ts` | Firestore block creation |
| `tests/overlap-diagnostic.spec.ts` | Playwright diagnostic tests |

---

## Next Steps to Try

1. **Binary search the problem**: Comment out the overlap check entirely - does placement work then?

2. **Log at return points**: Add unique logs at every `return` in the click handler to see exactly where it exits

3. **Compare getBoundingClientRect values**: Log both the preview's expected rect AND each block's rect, then manually verify the math

4. **Test with a single block**: Delete all blocks except one, try placing next to it from all 4 sides

5. **Check for CSS interference**: Temporarily remove canvas transform/scale, see if detection improves

---

## Session Commits

| Commit | Description | Result |
|--------|-------------|--------|
| `e0b92cd` | Increase tolerance to 24px, remove minHeight | ❌ Failed |
| `fc93b57` | Add verbose debug logging | ⚠️ Diagnostic |
| `ee0a23b` | Fix stale closure + measurement logging | ❌ Failed |
| `0952d58` | Center preview on cursor | ❌ Failed |

---

## Current Diagnostic: Always-On Logging

Added always-on console logs to trace every overlap check:

**In browser console, you should see:**
- `[Canvas mousemove] Checking overlap at {x, y, previewSize}` - Every mouse move
- `[OVERLAP BLOCKED] Preview blocked by block XXX` - When a block causes blocking
- `[OVERLAP OK] Placement allowed at (X%, Y%)` - When placement would succeed

**To test:**
1. Open http://localhost:3000
2. Open browser DevTools console
3. Sign in as admin
4. Click "Add Text"
5. Move mouse near existing blocks
6. Watch console output to see which block is blocking and why
