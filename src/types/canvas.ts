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
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline' | 'line-through'
  fontFamily: string      // font family name
  color: string           // hex color
  textAlign: 'left' | 'center' | 'right'
  marquee?: boolean       // scrolling text effect
  backgroundColor?: string
}

// Available colors for random selection
export const TEXT_COLORS = [
  '#f87171', // red
  '#fb923c', // orange
  '#facc15', // yellow
  '#4ade80', // green
  '#22d3ee', // cyan
  '#818cf8', // indigo
  '#e879f9', // pink
  '#ffffff', // white
]

// Available fonts for random selection (CSS variables)
export const TEXT_FONTS = [
  'var(--font-inter)',
  'var(--font-jetbrains-mono)',
  'var(--font-space-grotesk)',
  'var(--font-exo-2)',
  'var(--font-orbitron)',
  'var(--font-quicksand)',
  'var(--font-playfair)',
  'var(--font-lora)',
  'var(--font-oswald)',
  'var(--font-anton)',
  'var(--font-bebas-neue)',
  'var(--font-caveat)',
]

// Get a random color from the palette
export function getRandomColor(): string {
  return TEXT_COLORS[Math.floor(Math.random() * TEXT_COLORS.length)]
}

// Get a random font from the palette
export function getRandomFont(): string {
  return TEXT_FONTS[Math.floor(Math.random() * TEXT_FONTS.length)]
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
  createdBy: string       // User ID of creator
  // Brightness voting (0-100, starts at 50)
  // Space = brighten, Alt = dim
  // At 0 brightness, block is deleted
  brightness: number
  voters: string[]        // User IDs who have voted (prevent double voting)
  votersUp?: string[]     // User IDs who voted up (for unvote)
  votersDown?: string[]   // User IDs who voted down (for unvote)
  reportedBy?: string[]          // User IDs who have reported this block
  dismissedReporters?: string[]  // User IDs whose reports were dismissed (can't re-report)
}

export type CanvasBlock = TextBlock

// Type guard
export function isTextBlock(block: CanvasBlock): block is TextBlock {
  return block.type === 'text'
}

// Default brightness for new blocks
export const DEFAULT_BRIGHTNESS = 50

// Brightness change per vote
export const VOTE_BRIGHTNESS_CHANGE = 5

// Default values for new blocks
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 1,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  fontFamily: 'var(--font-inter)',
  color: '#ffffff', // Will be overridden with random color on creation
  textAlign: 'left',
  marquee: false,
}

export const DEFAULT_BLOCK_SIZE = {
  width: 20,
  height: 0, // auto
}
