import { CanvasBlock } from '@/types/canvas'

/**
 * Check if a user can edit a specific block
 * Admin can edit any block, users can only edit their own
 */
export function canEditBlock(
  block: CanvasBlock,
  userId: string | undefined,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true
  if (!userId) return false
  return block.createdBy === userId
}

/**
 * Filter a list of block IDs to only those the user can edit
 */
export function filterEditableBlocks(
  blockIds: string[],
  blocks: CanvasBlock[],
  userId: string | undefined,
  isAdmin: boolean
): string[] {
  return blockIds.filter((id) => {
    const block = blocks.find((b) => b.id === id)
    return block && canEditBlock(block, userId, isAdmin)
  })
}

/**
 * Count how many blocks in a selection the user can edit
 */
export function countEditableBlocks(
  blockIds: string[],
  blocks: CanvasBlock[],
  userId: string | undefined,
  isAdmin: boolean
): number {
  return filterEditableBlocks(blockIds, blocks, userId, isAdmin).length
}
