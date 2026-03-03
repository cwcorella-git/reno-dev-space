/**
 * Activated Measurement System - Collision Detector
 *
 * Uses the MeasurementService to perform consistent collision detection.
 * All checks use normalized CanvasRect coordinates - no more coordinate confusion.
 */

import { CanvasBlock } from '@/types/canvas'
import { measurementService } from './MeasurementService'
import {
  CanvasRect,
  CollisionResult,
  ProximityZone,
  CollisionConfig,
  DEFAULT_COLLISION_CONFIG,
} from './types'

/**
 * Collision detector that uses the measurement service.
 */
class CollisionDetector {
  private config: CollisionConfig

  constructor(config: Partial<CollisionConfig> = {}) {
    this.config = { ...DEFAULT_COLLISION_CONFIG, ...config }
  }

  /**
   * Update configuration.
   */
  setConfig(config: Partial<CollisionConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Check if a proposed rectangle would collide with existing blocks.
   *
   * @param proposedRect - The rectangle to check (in canvas percentage coords)
   * @param existingBlocks - Blocks to check against
   * @param excludeIds - Block IDs to exclude from check (e.g., the block being moved)
   * @param canvasHeightPercent - Current canvas height percentage
   */
  checkCollision(
    proposedRect: CanvasRect,
    existingBlocks: CanvasBlock[],
    excludeIds: string[] = [],
    canvasHeightPercent: number = 100
  ): CollisionResult {
    // Update measurement service with current canvas height
    measurementService.updateCanvasHeight(canvasHeightPercent)

    const collidingBlockIds: string[] = []
    const proximityZones: ProximityZone[] = []

    for (const block of existingBlocks) {
      // Skip excluded blocks
      if (excludeIds.includes(block.id)) continue

      // Get measured bounding box
      const blockBounds = measurementService.getBoundingBox(block)

      // Create proximity zone (expanded bounding box)
      const zone: ProximityZone = {
        blockId: block.id,
        inner: blockBounds,
        outer: this.expandRect(blockBounds, this.config.proximityMargin),
        margin: this.config.proximityMargin,
      }
      proximityZones.push(zone)

      // Fast bounding box check first
      if (this.rectsIntersect(proposedRect, zone.outer)) {
        collidingBlockIds.push(block.id)
      }
    }

    // If no bounding box collisions, we're done
    if (collidingBlockIds.length === 0) {
      return {
        collides: false,
        collidingBlockIds: [],
        collisionType: 'none',
        checkedRect: proposedRect,
        proximityZones,
      }
    }

    // Optional: character-level refinement for edge cases
    // (when bounding boxes touch but actual text might not overlap)
    if (this.config.enableCharacterLevel) {
      const confirmedCollisions = this.refineWithCharacterLevel(
        proposedRect,
        collidingBlockIds,
        existingBlocks
      )

      return {
        collides: confirmedCollisions.length > 0,
        collidingBlockIds: confirmedCollisions,
        collisionType: confirmedCollisions.length > 0 ? 'character-level' : 'none',
        checkedRect: proposedRect,
        proximityZones,
      }
    }

    return {
      collides: true,
      collidingBlockIds,
      collisionType: 'bounding-box',
      checkedRect: proposedRect,
      proximityZones,
    }
  }

  /**
   * Check collision for a moving block at a new position.
   */
  checkMoveCollision(
    blockId: string,
    newX: number,
    newY: number,
    block: CanvasBlock,
    allBlocks: CanvasBlock[],
    canvasHeightPercent: number
  ): CollisionResult {
    // Get current block dimensions
    const currentBounds = measurementService.getBoundingBox(block)

    // Create proposed rect at new position
    const proposedRect: CanvasRect = {
      x: newX,
      y: newY,
      width: currentBounds.width,
      height: currentBounds.height,
    }

    return this.checkCollision(
      proposedRect,
      allBlocks,
      [blockId],
      canvasHeightPercent
    )
  }

  /**
   * Check collision for Add Text placement.
   * The preview is centered on cursor position.
   */
  checkAddTextCollision(
    cursorX: number,
    cursorY: number,
    previewWidth: number,
    previewHeight: number,
    existingBlocks: CanvasBlock[],
    canvasHeightPercent: number
  ): CollisionResult {
    // Center preview on cursor (this matches the visual preview behavior)
    const proposedRect: CanvasRect = {
      x: cursorX - previewWidth / 2,
      y: cursorY - previewHeight / 2,
      width: previewWidth,
      height: previewHeight,
    }

    return this.checkCollision(
      proposedRect,
      existingBlocks,
      [],
      canvasHeightPercent
    )
  }

  /**
   * Check collision for resize operation.
   */
  checkResizeCollision(
    blockId: string,
    newWidth: number,
    block: CanvasBlock,
    allBlocks: CanvasBlock[],
    canvasHeightPercent: number
  ): CollisionResult {
    const currentBounds = measurementService.getBoundingBox(block)

    // For resize, we keep the same position but change width
    // Height may change with text reflow, but we can't predict that accurately
    // So we keep the current height as an approximation
    const proposedRect: CanvasRect = {
      x: block.x,
      y: block.y,
      width: newWidth,
      height: currentBounds.height,
    }

    return this.checkCollision(
      proposedRect,
      allBlocks,
      [blockId],
      canvasHeightPercent
    )
  }

  /**
   * Expand a rectangle by a margin percentage.
   */
  private expandRect(rect: CanvasRect, margin: number): CanvasRect {
    return {
      x: rect.x - margin,
      y: rect.y - margin,
      width: rect.width + margin * 2,
      height: rect.height + margin * 2,
    }
  }

  /**
   * Check if two rectangles intersect.
   * Returns true if any part of the rectangles overlap.
   */
  private rectsIntersect(a: CanvasRect, b: CanvasRect): boolean {
    // No intersection if one is completely to the left/right/above/below the other
    return !(
      a.x + a.width <= b.x ||   // a is completely left of b
      b.x + b.width <= a.x ||   // b is completely left of a
      a.y + a.height <= b.y ||  // a is completely above b
      b.y + b.height <= a.y     // b is completely above a
    )
  }

  /**
   * Refine collision detection using character-level measurements.
   * Used when bounding boxes overlap but we want precise text overlap detection.
   */
  private refineWithCharacterLevel(
    proposedRect: CanvasRect,
    candidateBlockIds: string[],
    allBlocks: CanvasBlock[]
  ): string[] {
    const confirmed: string[] = []

    for (const blockId of candidateBlockIds) {
      const block = allBlocks.find(b => b.id === blockId)
      if (!block) continue

      const characters = measurementService.getCharacterMeasurements(block)

      // Check if any character actually overlaps
      const hasOverlap = characters.some(char =>
        this.rectsIntersect(proposedRect, char.rect)
      )

      if (hasOverlap) {
        confirmed.push(blockId)
      }
    }

    return confirmed
  }

  /**
   * Utility: Get proximity zones for all blocks (for debugging overlay).
   */
  getProximityZones(blocks: CanvasBlock[], excludeIds: string[] = []): ProximityZone[] {
    const zones: ProximityZone[] = []

    for (const block of blocks) {
      if (excludeIds.includes(block.id)) continue

      const blockBounds = measurementService.getBoundingBox(block)
      zones.push({
        blockId: block.id,
        inner: blockBounds,
        outer: this.expandRect(blockBounds, this.config.proximityMargin),
        margin: this.config.proximityMargin,
      })
    }

    return zones
  }
}

// Export default instance
export const collisionDetector = new CollisionDetector()
