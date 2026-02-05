import { CanvasBlock } from '@/types/canvas'

// Approximate dimensions for a new text block (percentages of canvas)
// These match the preview box in Canvas.tsx (12% wide, 6% tall)
const NEW_BLOCK_WIDTH = 12  // ~12% of canvas width
const NEW_BLOCK_HEIGHT = 6  // ~6% of canvasHeightPercent

// Padding between blocks (percentage) - zero to only flag true overlaps
const OVERLAP_PADDING = 0

/**
 * Check if placing a new block at (newX, newY) would overlap existing blocks.
 * Coordinates are in percentage format (0-100 for x, 0-canvasHeightPercent for y).
 */
export function wouldOverlap(
  newX: number,
  newY: number,
  blocks: CanvasBlock[],
  padding: number = OVERLAP_PADDING
): boolean {
  const newRight = newX + NEW_BLOCK_WIDTH
  const newBottom = newY + NEW_BLOCK_HEIGHT

  for (const block of blocks) {
    const blockWidth = block.width || 5
    const blockHeight = 1 // minimal height - only flag true overlaps

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
 */
export function wouldBlockOverlap(
  blockId: string,
  newX: number,
  newY: number,
  blockWidth: number,
  blocks: CanvasBlock[],
  padding: number = OVERLAP_PADDING
): boolean {
  const newRight = newX + blockWidth
  const newBottom = newY + NEW_BLOCK_HEIGHT // approximate height

  for (const other of blocks) {
    // Skip self
    if (other.id === blockId) continue

    const otherWidth = other.width || 5
    const otherHeight = 1 // minimal height - only flag true overlaps

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
 */
export function wouldOverlapDOM(
  canvasElement: HTMLElement,
  cursorX: number,            // percentage (0–100)
  cursorY: number,            // percentage (0–canvasHeightPercent)
  canvasHeightPercent: number
): boolean {
  const canvasRect = canvasElement.getBoundingClientRect()

  // Convert new block's top-left from canvas percentages to screen pixels
  const newLeft = canvasRect.left + (cursorX / 100) * canvasRect.width
  const newTop = canvasRect.top + (cursorY / canvasHeightPercent) * canvasRect.height
  // Estimate new block size in screen pixels (matches the 12% × 6% preview box)
  const newRight = newLeft + (NEW_BLOCK_WIDTH / 100) * canvasRect.width
  const newBottom = newTop + (NEW_BLOCK_HEIGHT / canvasHeightPercent) * canvasRect.height

  const blockElements = canvasElement.querySelectorAll<HTMLElement>('[data-block-id]')
  for (let i = 0; i < blockElements.length; i++) {
    const blockRect = blockElements[i].getBoundingClientRect()
    const noOverlap =
      newRight <= blockRect.left ||
      newLeft >= blockRect.right ||
      newBottom <= blockRect.top ||
      newTop >= blockRect.bottom
    if (!noOverlap) return true
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
    const noOverlap =
      targetRect.right <= other.left ||
      targetRect.left >= other.right ||
      targetRect.bottom <= other.top ||
      targetRect.top >= other.bottom

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
 */
export function findOpenPosition(
  preferredX: number,
  preferredY: number,
  blockWidth: number,
  blocks: CanvasBlock[]
): { x: number; y: number } {
  if (!wouldOverlap(preferredX, preferredY, blocks)) {
    return { x: preferredX, y: preferredY }
  }

  const stepX = Math.max(blockWidth + 1, 6)
  const stepY = 3
  for (let y = 5; y < 200; y += stepY) {
    for (let x = 5; x < 95; x += stepX) {
      if (!wouldOverlap(x, y, blocks)) {
        return { x, y }
      }
    }
  }

  const maxY = blocks.reduce((max, b) => Math.max(max, b.y), 0)
  return { x: 10, y: maxY + 5 }
}
