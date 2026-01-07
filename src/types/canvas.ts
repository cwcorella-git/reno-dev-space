export type BlockType = 'text'

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
  // Voting fields (optional - not all text blocks are voteable)
  voteable?: boolean
  upvotes?: string[]    // User IDs
  downvotes?: string[]  // User IDs
}

export type CanvasBlock = TextBlock

// Type guard
export function isTextBlock(block: CanvasBlock): block is TextBlock {
  return block.type === 'text'
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
