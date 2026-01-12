import { CanvasBlock } from '@/types/canvas'

// Approximate dimensions for a new text block (percentages of canvas)
const NEW_BLOCK_WIDTH = 12  // ~12% of canvas width
const NEW_BLOCK_HEIGHT = 6  // ~6% of canvas height (one screen = 100)

/**
 * Check if placing a new block at (newX, newY) would overlap existing blocks.
 * Coordinates are in percentage format (0-100 for x, 0-canvasHeightPercent for y).
 */
export function wouldOverlap(
  newX: number,
  newY: number,
  blocks: CanvasBlock[],
  padding: number = 2
): boolean {
  const newRight = newX + NEW_BLOCK_WIDTH
  const newBottom = newY + NEW_BLOCK_HEIGHT

  for (const block of blocks) {
    const blockWidth = block.width || 12
    const blockHeight = 6 // approximate text block height

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
