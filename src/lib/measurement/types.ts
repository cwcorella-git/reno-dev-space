/**
 * Activated Measurement System - Type Definitions
 *
 * All measurements are normalized to canvas percentage coordinates.
 * This eliminates the coordinate system confusion that plagued the old overlap detection.
 */

/**
 * Normalized rectangle in canvas percentage coordinates.
 * All measurements are converted to this format for consistent collision detection.
 */
export interface CanvasRect {
  x: number       // percentage 0-100 (can exceed for overflow zones)
  y: number       // percentage 0-canvasHeightPercent
  width: number   // percentage
  height: number  // percentage (always calculated, never 0)
}

/**
 * A single character's measured position and dimensions.
 */
export interface CharacterMeasurement {
  char: string
  index: number       // position in text content
  rect: CanvasRect    // bounding box of this character
  lineIndex: number   // which line this character is on
}

/**
 * A line of text with its measurements.
 */
export interface LineMeasurement {
  lineIndex: number
  startCharIndex: number
  endCharIndex: number
  rect: CanvasRect    // bounding box of entire line
  isWrapped: boolean  // true if this line resulted from word-wrap (not explicit \n)
}

/**
 * Complete measurement of a text block including character-level detail.
 */
export interface BlockMeasurement {
  blockId: string
  timestamp: number   // when measurement was taken (for cache invalidation)

  // Fast access (always computed)
  boundingBox: CanvasRect

  // Detailed measurements (lazy, computed on demand)
  lines?: LineMeasurement[]
  characters?: CharacterMeasurement[]

  // Metadata for cache validation
  contentHash: string   // hash of block.content
  styleHash: string     // hash of relevant style properties (fontSize, fontFamily, fontWeight)
}

/**
 * Proximity zone around a block for placement blocking.
 * The outer zone is the expanded bounding box that triggers collision.
 */
export interface ProximityZone {
  blockId: string
  inner: CanvasRect   // actual block bounds
  outer: CanvasRect   // expanded bounds with margin
  margin: number      // margin in canvas percentage
}

/**
 * Result of a collision check.
 */
export interface CollisionResult {
  collides: boolean
  collidingBlockIds: string[]
  collisionType: 'none' | 'bounding-box' | 'character-level'

  // For debugging/visualization
  checkedRect: CanvasRect
  proximityZones?: ProximityZone[]
}

/**
 * Configuration for the measurement service.
 */
export interface MeasurementConfig {
  proximityMargin: number       // percentage margin for proximity blocking (default: 1)
  cacheTimeoutMs: number        // how long to keep measurements before re-measuring
  enableCharacterLevel: boolean // whether to compute character-level measurements
}

/**
 * Configuration for collision detection.
 */
export interface CollisionConfig {
  proximityMargin: number       // percentage margin (default: 1)
  enableCharacterLevel: boolean // use character-level for precise checks
}

/**
 * Dev overlay configuration.
 */
export interface MeasurementDebugConfig {
  enabled: boolean
  showBoundingBoxes: boolean
  showProximityZones: boolean
  showCharacterBoxes: boolean
  showLineBoxes: boolean
  showCollisionState: boolean
}

/**
 * Default configurations.
 */
export const DEFAULT_MEASUREMENT_CONFIG: MeasurementConfig = {
  proximityMargin: 1,           // 1% margin around blocks
  cacheTimeoutMs: 5000,         // 5 second cache
  enableCharacterLevel: true,
}

export const DEFAULT_COLLISION_CONFIG: CollisionConfig = {
  proximityMargin: 1,
  enableCharacterLevel: false,  // Fast by default
}

export const DEFAULT_DEBUG_CONFIG: MeasurementDebugConfig = {
  enabled: false,
  showBoundingBoxes: true,
  showProximityZones: true,
  showCharacterBoxes: false,    // Expensive, off by default
  showLineBoxes: false,
  showCollisionState: true,
}
