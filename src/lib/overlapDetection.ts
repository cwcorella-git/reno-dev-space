import { CanvasBlock } from '@/types/canvas'

// Approximate dimensions for a new text block (percentages of canvas)
// These match the preview box in Canvas.tsx (12% wide, 6% tall)
const NEW_BLOCK_WIDTH = 12  // ~12% of canvas width
const NEW_BLOCK_HEIGHT = 6  // ~6% of canvasHeightPercent

// Tolerance for overlap detection (pixels) - allows padded boxes to overlap
// without flagging. Must cover padding on BOTH blocks.
// Horizontal padding: 12px × 2 = 24px, Vertical padding: 8px × 2 = 16px
// Use the larger value (horizontal) to allow text to get close on all sides.
const OVERLAP_TOLERANCE = 24  // px - 12px horizontal padding × 2

// Fallback height estimate when DOM is not available (percentage)
// This is used for server-side rendering or when block hasn't mounted yet
const FALLBACK_HEIGHT_ESTIMATE = 6 // Conservative estimate (matches NEW_BLOCK_HEIGHT)

/**
 * Measure what a new text block would actually render at.
 * Creates a hidden measurement element with exact block styling.
 *
 * @param canvasElement - The canvas DOM element for size reference
 * @param fontFamily - CSS font-family value (e.g., 'var(--font-inter)')
 * @param fontSize - Font size in rem units (default: 1)
 * @param placeholderText - Text to measure (default: 'Click to edit')
 * @returns Dimensions as percentages of canvas
 */
export function measureNewBlockSize(
  canvasElement: HTMLElement,
  fontFamily: string = 'var(--font-inter)',
  fontSize: number = 1,
  placeholderText: string = 'Click to edit'
): { widthPercent: number; heightPercent: number } {
  const canvasRect = canvasElement.getBoundingClientRect()

  // Create measurement element with exact block styling (matches CanvasBlock.tsx)
  const measurer = document.createElement('div')
  measurer.style.cssText = `
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: break-word;
    padding: 8px 12px;
    min-width: 80px;
    max-width: min(100%, 90vw);
    font-family: ${fontFamily};
    font-size: ${fontSize}rem;
    font-weight: normal;
    font-style: italic;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.5;
  `
  measurer.textContent = placeholderText

  canvasElement.appendChild(measurer)
  const rect = measurer.getBoundingClientRect()
  canvasElement.removeChild(measurer)

  // Convert to percentages of canvas
  const widthPercent = (rect.width / canvasRect.width) * 100
  const heightPercent = (rect.height / canvasRect.height) * 100

  // Enforce minimums to prevent tiny previews
  return {
    widthPercent: Math.max(widthPercent, 5),   // At least 5% width
    heightPercent: Math.max(heightPercent, 2)  // At least 2% height
  }
}

/**
 * Get the actual height of a block in percentage units.
 * Tries DOM measurement first, falls back to conservative estimate.
 *
 * @param blockId - The block's ID to look up in the DOM
 * @param canvasHeightPercent - The current canvas height as percentage (for conversion)
 * @returns Height as percentage of canvasHeightPercent
 */
function getBlockHeightPercent(blockId: string, canvasHeightPercent: number = 100): number {
  // Try to get actual DOM measurement
  const blockElement = document.querySelector(`[data-block-id="${blockId}"]`)
  // Find the canvas by looking for the parent that contains all blocks
  const canvasElement = blockElement?.closest('.bg-brand-dark') as HTMLElement

  if (blockElement && canvasElement) {
    const blockRect = blockElement.getBoundingClientRect()
    const canvasRect = canvasElement.getBoundingClientRect()

    // Convert pixel height to percentage of canvas
    const heightPercent = (blockRect.height / canvasRect.height) * canvasHeightPercent
    return heightPercent
  }

  // Fallback to conservative estimate if DOM not available
  return FALLBACK_HEIGHT_ESTIMATE
}

/**
 * Check if placing a new block at (newX, newY) would overlap existing blocks.
 * Coordinates are in percentage format (0-100 for x, 0-canvasHeightPercent for y).
 * Uses actual DOM measurements when available for accurate collision detection.
 */
export function wouldOverlap(
  newX: number,
  newY: number,
  blocks: CanvasBlock[],
  padding: number = 0,
  canvasHeightPercent: number = 100
): boolean {
  const newRight = newX + NEW_BLOCK_WIDTH
  const newBottom = newY + NEW_BLOCK_HEIGHT

  for (const block of blocks) {
    const blockWidth = block.width || 5
    const blockHeight = getBlockHeightPercent(block.id, canvasHeightPercent)

    const blockRight = block.x + blockWidth
    const blockBottom = block.y + blockHeight

    // Check rectangle intersection with padding
    // Two rectangles DON'T overlap if one is completely to the left, right, above, or below
    const noOverlap =
      newRight + padding < block.x ||  // new block is to the left
      newX > blockRight + padding ||   // new block is to the right
      newBottom + padding < block.y || // new block is above
      newY > blockBottom + padding     // new block is below

    if (!noOverlap) return true
  }
  return false
}

/**
 * Check if moving an existing block to (newX, newY) would overlap other blocks.
 * Excludes the block itself from the check.
 * Uses actual DOM measurements when available for accurate collision detection.
 */
export function wouldBlockOverlap(
  blockId: string,
  newX: number,
  newY: number,
  blockWidth: number,
  blocks: CanvasBlock[],
  padding: number = 0,
  canvasHeightPercent: number = 100
): boolean {
  // Get moving block's actual height
  const movingBlockHeight = getBlockHeightPercent(blockId, canvasHeightPercent)
  const newRight = newX + blockWidth
  const newBottom = newY + movingBlockHeight

  for (const other of blocks) {
    // Skip self
    if (other.id === blockId) continue

    const otherWidth = other.width || 5
    const otherHeight = getBlockHeightPercent(other.id, canvasHeightPercent)

    const otherRight = other.x + otherWidth
    const otherBottom = other.y + otherHeight

    // Check rectangle intersection with padding
    const noOverlap =
      newRight + padding < other.x ||
      newX > otherRight + padding ||
      newBottom + padding < other.y ||
      newY > otherBottom + padding

    if (!noOverlap) return true
  }
  return false
}

/**
 * DOM-based overlap check for Add Text placement.
 * Uses getBoundingClientRect() on existing blocks for pixel-accurate hit zones,
 * instead of the percentage-based estimates which underestimate block height.
 *
 * @param canvasElement - The canvas DOM element
 * @param cursorX - Cursor X position as percentage (0-100)
 * @param cursorY - Cursor Y position as percentage (0-canvasHeightPercent)
 * @param canvasHeightPercent - Canvas height as percentage of DESIGN_HEIGHT
 * @param newBlockWidth - Width of new block as percentage (default: NEW_BLOCK_WIDTH)
 * @param newBlockHeight - Height of new block as percentage (default: NEW_BLOCK_HEIGHT)
 * @param debug - Enable console logging for debugging
 */
export function wouldOverlapDOM(
  canvasElement: HTMLElement,
  cursorX: number,
  cursorY: number,
  canvasHeightPercent: number,
  newBlockWidth: number = NEW_BLOCK_WIDTH,
  newBlockHeight: number = NEW_BLOCK_HEIGHT,
  debug: boolean = false
): boolean {
  const canvasRect = canvasElement.getBoundingClientRect()

  // Calculate preview size in pixels
  const previewWidthPx = (newBlockWidth / 100) * canvasRect.width
  const previewHeightPx = (newBlockHeight / 100) * canvasRect.height

  // Convert cursor position to screen pixels
  const cursorScreenX = canvasRect.left + (cursorX / 100) * canvasRect.width
  const cursorScreenY = canvasRect.top + (cursorY / canvasHeightPercent) * canvasRect.height

  // CENTER the preview on cursor (not top-left at cursor)
  // This makes approach from all 4 directions symmetric
  const newLeft = cursorScreenX - previewWidthPx / 2
  const newTop = cursorScreenY - previewHeightPx / 2
  const newRight = cursorScreenX + previewWidthPx / 2
  const newBottom = cursorScreenY + previewHeightPx / 2

  if (debug) {
    console.log('[wouldOverlapDOM] Canvas:', {
      left: canvasRect.left, top: canvasRect.top,
      width: canvasRect.width, height: canvasRect.height
    })
    console.log('[wouldOverlapDOM] Cursor %:', { x: cursorX, y: cursorY, canvasHeightPercent })
    console.log('[wouldOverlapDOM] Preview size params:', { width: newBlockWidth, height: newBlockHeight })
    console.log('[wouldOverlapDOM] Preview size px:', { width: previewWidthPx, height: previewHeightPx })
    console.log('[wouldOverlapDOM] New block rect (screen px):', {
      left: newLeft, top: newTop, right: newRight, bottom: newBottom
    })
  }

  const blockElements = canvasElement.querySelectorAll<HTMLElement>('[data-block-id]')

  if (debug) {
    console.log('[wouldOverlapDOM] Found', blockElements.length, 'blocks')
  }

  for (let i = 0; i < blockElements.length; i++) {
    const blockRect = blockElements[i].getBoundingClientRect()
    const blockId = blockElements[i].getAttribute('data-block-id')

    if (debug) {
      console.log(`[wouldOverlapDOM] Block ${blockId}:`, {
        left: blockRect.left, top: blockRect.top,
        right: blockRect.right, bottom: blockRect.bottom,
        width: blockRect.width, height: blockRect.height
      })
    }

    // Apply tolerance: shrink existing block's hit zone by padding amount
    // This allows padded boxes to touch without flagging text overlap
    const noOverlap =
      newRight <= blockRect.left + OVERLAP_TOLERANCE ||
      newLeft >= blockRect.right - OVERLAP_TOLERANCE ||
      newBottom <= blockRect.top + OVERLAP_TOLERANCE ||
      newTop >= blockRect.bottom - OVERLAP_TOLERANCE

    if (!noOverlap) {
      if (debug) {
        console.log(`[wouldOverlapDOM] OVERLAP with block ${blockId}!`, {
          newBlock: { left: newLeft, top: newTop, right: newRight, bottom: newBottom },
          existing: { left: blockRect.left, top: blockRect.top, right: blockRect.right, bottom: blockRect.bottom },
          tolerance: OVERLAP_TOLERANCE,
          checks: {
            'newRight <= blockLeft+tol': `${newRight.toFixed(1)} <= ${(blockRect.left + OVERLAP_TOLERANCE).toFixed(1)}`,
            'newLeft >= blockRight-tol': `${newLeft.toFixed(1)} >= ${(blockRect.right - OVERLAP_TOLERANCE).toFixed(1)}`,
            'newBottom <= blockTop+tol': `${newBottom.toFixed(1)} <= ${(blockRect.top + OVERLAP_TOLERANCE).toFixed(1)}`,
            'newTop >= blockBottom-tol': `${newTop.toFixed(1)} >= ${(blockRect.bottom - OVERLAP_TOLERANCE).toFixed(1)}`,
          }
        })
      }
      return true
    }
  }
  return false
}

// ── DOM-based overlap detection (pixel-accurate) ──────────────────────

type Rect = { left: number; top: number; right: number; bottom: number }

/**
 * Check if a block's actual rendered bounding box overlaps any other block.
 * Uses getBoundingClientRect() for pixel-accurate measurements.
 *
 * @param blockId - The block to check (excluded from "others")
 * @param overrideRect - Optional rect override for the target block
 *                       (used when predicting size changes like font size increase)
 * @returns true if the block would overlap another block
 */
export function checkDOMOverlap(
  blockId: string,
  overrideRect?: Rect
): boolean {
  const allBlockElements = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]'))

  let targetRect: Rect | null = null
  const otherRects: Rect[] = []

  for (const el of allBlockElements) {
    const id = el.getAttribute('data-block-id')
    if (id === blockId) {
      targetRect = overrideRect ?? el.getBoundingClientRect()
    } else {
      otherRects.push(el.getBoundingClientRect())
    }
  }

  if (!targetRect) return false

  for (const other of otherRects) {
    // Two rects DON'T overlap if one is completely left, right, above, or below
    // Apply tolerance to allow padded boxes to touch without flagging text overlap
    const noOverlap =
      targetRect.right <= other.left + OVERLAP_TOLERANCE ||
      targetRect.left >= other.right - OVERLAP_TOLERANCE ||
      targetRect.bottom <= other.top + OVERLAP_TOLERANCE ||
      targetRect.top >= other.bottom - OVERLAP_TOLERANCE

    if (!noOverlap) return true
  }

  return false
}

/**
 * Estimate what a block's bounding rect would be after changing font size.
 * Height scales proportionally to the font-size ratio.
 * Width stays fixed (CSS percentage constraint) unless auto-width (width=0).
 */
export function estimateRectAfterFontSizeChange(
  blockElement: HTMLElement,
  oldFontSize: number,
  newFontSize: number,
  blockWidth: number
): Rect {
  const currentRect = blockElement.getBoundingClientRect()
  const ratio = newFontSize / oldFontSize

  const newHeight = currentRect.height * ratio
  // Auto-width blocks (width === 0) grow horizontally too
  const newWidthPx = blockWidth === 0
    ? currentRect.width * ratio
    : currentRect.width

  return {
    left: currentRect.left,
    top: currentRect.top,
    right: currentRect.left + newWidthPx,
    bottom: currentRect.top + newHeight,
  }
}

/**
 * Find an open position on the canvas for a restored block.
 * Tries the original position first, then scans a grid for open space.
 * Uses actual DOM measurements when available for accurate collision detection.
 */
export function findOpenPosition(
  preferredX: number,
  preferredY: number,
  blockWidth: number,
  blocks: CanvasBlock[],
  canvasHeightPercent: number = 100
): { x: number; y: number } {
  if (!wouldOverlap(preferredX, preferredY, blocks, 0, canvasHeightPercent)) {
    return { x: preferredX, y: preferredY }
  }

  const stepX = Math.max(blockWidth + 1, 6)
  const stepY = 3
  for (let y = 5; y < 200; y += stepY) {
    for (let x = 5; x < 95; x += stepX) {
      if (!wouldOverlap(x, y, blocks, 0, canvasHeightPercent)) {
        return { x, y }
      }
    }
  }

  const maxY = blocks.reduce((max, b) => Math.max(max, b.y), 0)
  return { x: 10, y: maxY + 5 }
}

/**
 * Check if two rectangles overlap (AABB collision detection)
 */
function rectanglesOverlap(
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    r1.x + r1.width <= r2.x ||
    r2.x + r2.width <= r1.x ||
    r1.y + r1.height <= r2.y ||
    r2.y + r2.height <= r1.y
  )
}

/**
 * Find all text blocks overlapping the gallery rectangle and calculate new positions.
 * Uses findOpenPosition() to relocate each overlapping block sequentially,
 * updating the processed list after each displacement so subsequent blocks
 * see the new positions and avoid re-colliding.
 * Uses actual DOM measurements when available for accurate collision detection.
 *
 * @param galleryRect - The gallery's bounding box in canvas percentages
 * @param blocks - All canvas blocks to check
 * @param canvasHeightPercent - The current canvas height as percentage (for conversion)
 * @returns Array of { id, newX, newY } for blocks that need to move
 */
export function displacOverlappingBlocks(
  galleryRect: { x: number; y: number; width: number; height: number },
  blocks: CanvasBlock[],
  canvasHeightPercent: number = 100
): Array<{ id: string; newX: number; newY: number }> {
  const displaced: Array<{ id: string; newX: number; newY: number }> = []
  const processedBlocks = [...blocks]

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const blockWidth = block.width || 5
    const blockHeight = getBlockHeightPercent(block.id, canvasHeightPercent)

    const blockRect = {
      x: block.x,
      y: block.y,
      width: blockWidth,
      height: blockHeight,
    }

    if (rectanglesOverlap(galleryRect, blockRect)) {
      // Find open space, excluding already-displaced blocks from collision check
      const excludeDisplaced = processedBlocks.filter(
        (b) => !displaced.some((d) => d.id === b.id) && b.id !== block.id
      )

      const { x: newX, y: newY } = findOpenPosition(
        block.x,
        block.y,
        blockWidth,
        excludeDisplaced,
        canvasHeightPercent
      )

      displaced.push({ id: block.id, newX, newY })

      // Update processedBlocks so next block sees this new position
      processedBlocks[i] = { ...block, x: newX, y: newY }
    }
  }

  return displaced
}
