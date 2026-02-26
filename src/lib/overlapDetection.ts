import { CanvasBlock } from '@/types/canvas'

// Approximate dimensions for a new text block (percentages of canvas)
// These match the preview box in Canvas.tsx (12% wide, 6% tall)
const NEW_BLOCK_WIDTH = 12  // ~12% of canvas width
const NEW_BLOCK_HEIGHT = 6  // ~6% of canvasHeightPercent

// Padding between blocks (percentage) - zero to only flag true overlaps
const OVERLAP_PADDING = 0

// Fallback height estimate when DOM is not available (percentage)
// This is used for server-side rendering or when block hasn't mounted yet
const FALLBACK_HEIGHT_ESTIMATE = 6 // Conservative estimate (matches NEW_BLOCK_HEIGHT)

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
  padding: number = OVERLAP_PADDING,
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
  padding: number = OVERLAP_PADDING,
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
 */
export function wouldOverlapDOM(
  canvasElement: HTMLElement,
  cursorX: number,            // percentage (0–100)
  cursorY: number,            // percentage (0–canvasHeightPercent)
  canvasHeightPercent: number,
  debug: boolean = false
): boolean {
  const canvasRect = canvasElement.getBoundingClientRect()

  // Convert new block's top-left from canvas percentages to screen pixels
  const newLeft = canvasRect.left + (cursorX / 100) * canvasRect.width
  const newTop = canvasRect.top + (cursorY / canvasHeightPercent) * canvasRect.height
  // Estimate new block size in screen pixels (matches the 12% × 6% preview box)
  const newRight = newLeft + (NEW_BLOCK_WIDTH / 100) * canvasRect.width
  const newBottom = newTop + (NEW_BLOCK_HEIGHT / canvasHeightPercent) * canvasRect.height

  if (debug) {
    console.log('[wouldOverlapDOM] Canvas:', {
      left: canvasRect.left, top: canvasRect.top,
      width: canvasRect.width, height: canvasRect.height
    })
    console.log('[wouldOverlapDOM] Cursor %:', { x: cursorX, y: cursorY, canvasHeightPercent })
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
        right: blockRect.right, bottom: blockRect.bottom
      })
    }

    const noOverlap =
      newRight <= blockRect.left ||
      newLeft >= blockRect.right ||
      newBottom <= blockRect.top ||
      newTop >= blockRect.bottom

    if (!noOverlap) {
      if (debug) {
        console.log(`[wouldOverlapDOM] OVERLAP with block ${blockId}!`)
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
 * Uses actual DOM measurements when available for accurate collision detection.
 */
export function findOpenPosition(
  preferredX: number,
  preferredY: number,
  blockWidth: number,
  blocks: CanvasBlock[],
  canvasHeightPercent: number = 100
): { x: number; y: number } {
  if (!wouldOverlap(preferredX, preferredY, blocks, OVERLAP_PADDING, canvasHeightPercent)) {
    return { x: preferredX, y: preferredY }
  }

  const stepX = Math.max(blockWidth + 1, 6)
  const stepY = 3
  for (let y = 5; y < 200; y += stepY) {
    for (let x = 5; x < 95; x += stepX) {
      if (!wouldOverlap(x, y, blocks, OVERLAP_PADDING, canvasHeightPercent)) {
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
