import { CanvasBlock, DESIGN_WIDTH, DESIGN_HEIGHT } from '@/types/canvas'
import { percentRectsOverlap, rectsOverlapPx, PX_PER_X_UNIT } from '@/lib/measurement/geometry'

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

  // Convert to percentages. Width is %-of-canvas-width (= %-of-1440).
  // Height must be in canvasHeightPercent units (100 = one DESIGN_HEIGHT
  // screen), NOT a fraction of the full scrolled canvas — otherwise the
  // value disagrees with the collision system once the canvas scrolls.
  const oneScreenPx = (canvasRect.width / DESIGN_WIDTH) * DESIGN_HEIGHT
  const widthPercent = (rect.width / canvasRect.width) * 100
  const heightPercent = (rect.height / oneScreenPx) * 100

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
    // Negative margin = tolerance: allow up to OVERLAP_TOLERANCE px of overlap
    // (padding) before flagging. `targetRect`/`other` are screen-pixel rects.
    if (rectsOverlapPx(targetRect, other, -OVERLAP_TOLERANCE)) {
      return true
    }
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
  const yCeiling = Math.max(canvasHeightPercent, 100)
  for (let y = 5; y < yCeiling; y += stepY) {
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
  return percentRectsOverlap(r1, r2, 0)
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
