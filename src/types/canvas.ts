export type BlockType = 'text' | 'vote'

export interface BlockPosition {
  x: number  // percentage 0-100 from left
  y: number  // percentage 0-100 from top
}

export interface BlockSize {
  width: number   // percentage 0-100 of canvas width
  height: number  // percentage 0-100 of canvas height (use 0 for auto)
}

export interface TextStyle {
  fontSize: number        // rem units
  fontWeight: 'normal' | 'bold'
  color: string           // hex color
  textAlign: 'left' | 'center' | 'right'
  backgroundColor?: string
}

export interface BaseBlock {
  id: string
  type: BlockType
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  createdAt: number
  updatedAt: number
}

export interface TextBlock extends BaseBlock {
  type: 'text'
  content: string
  style: TextStyle
}

export interface VoteBlock extends BaseBlock {
  type: 'vote'
  proposalId: string
}

export type CanvasBlock = TextBlock | VoteBlock

// Type guards
export function isTextBlock(block: CanvasBlock): block is TextBlock {
  return block.type === 'text'
}

export function isVoteBlock(block: CanvasBlock): block is VoteBlock {
  return block.type === 'vote'
}

// Default values for new blocks
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 1,
  fontWeight: 'normal',
  color: '#ffffff',
  textAlign: 'left',
}

export const DEFAULT_BLOCK_SIZE = {
  width: 20,
  height: 0, // auto
}
