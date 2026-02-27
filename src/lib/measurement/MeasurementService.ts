/**
 * Activated Measurement System - Measurement Service
 *
 * Singleton service for measuring and caching block dimensions.
 * All coordinate transformations are handled here - consumers work
 * only with normalized CanvasRect coordinates.
 */

import { CanvasBlock, TextStyle } from '@/types/canvas'
import {
  CanvasRect,
  BlockMeasurement,
  CharacterMeasurement,
  LineMeasurement,
  MeasurementConfig,
  DEFAULT_MEASUREMENT_CONFIG,
} from './types'

/**
 * Singleton service for measuring and caching block dimensions.
 */
class MeasurementService {
  private cache: Map<string, BlockMeasurement> = new Map()
  private config: MeasurementConfig = DEFAULT_MEASUREMENT_CONFIG
  private canvasElement: HTMLElement | null = null
  private canvasHeightPercent: number = 100

  /**
   * Initialize with canvas element reference.
   * Must be called when canvas mounts.
   */
  setCanvas(element: HTMLElement | null, heightPercent: number): void {
    this.canvasElement = element
    this.canvasHeightPercent = heightPercent
    // Clear cache when canvas changes
    this.cache.clear()
  }

  /**
   * Update canvas height percent (called when canvas grows/shrinks).
   */
  updateCanvasHeight(heightPercent: number): void {
    if (Math.abs(this.canvasHeightPercent - heightPercent) > 0.1) {
      this.canvasHeightPercent = heightPercent
      // Invalidate all measurements - they need recalculating
      this.cache.clear()
    }
  }

  /**
   * Get current canvas height percent.
   */
  getCanvasHeightPercent(): number {
    return this.canvasHeightPercent
  }

  /**
   * Update configuration.
   */
  setConfig(config: Partial<MeasurementConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get or compute bounding box measurement for a block.
   * This is the fast path - always available.
   */
  getBoundingBox(block: CanvasBlock): CanvasRect {
    // Check cache first
    const cached = this.cache.get(block.id)
    if (cached && this.isCacheValid(cached, block)) {
      return cached.boundingBox
    }

    // Compute fresh measurement
    const measurement = this.measureBlock(block)
    this.cache.set(block.id, measurement)
    return measurement.boundingBox
  }

  /**
   * Get full block measurement (includes bounding box).
   */
  getBlockMeasurement(block: CanvasBlock): BlockMeasurement {
    const cached = this.cache.get(block.id)
    if (cached && this.isCacheValid(cached, block)) {
      return cached
    }

    const measurement = this.measureBlock(block)
    this.cache.set(block.id, measurement)
    return measurement
  }

  /**
   * Get line measurements for a block.
   */
  getLineMeasurements(block: CanvasBlock): LineMeasurement[] {
    const cached = this.cache.get(block.id)

    if (cached && this.isCacheValid(cached, block) && cached.lines) {
      return cached.lines
    }

    // Compute with line-level detail
    const measurement = this.measureBlockDetailed(block, false)
    this.cache.set(block.id, measurement)
    return measurement.lines ?? []
  }

  /**
   * Get character-level measurements for a block.
   * This is the slow path - computed lazily.
   */
  getCharacterMeasurements(block: CanvasBlock): CharacterMeasurement[] {
    const cached = this.cache.get(block.id)

    if (cached && this.isCacheValid(cached, block) && cached.characters) {
      return cached.characters
    }

    // Compute with character-level detail
    const measurement = this.measureBlockDetailed(block, true)
    this.cache.set(block.id, measurement)
    return measurement.characters ?? []
  }

  /**
   * Invalidate cache for specific blocks.
   */
  invalidate(blockIds: string[]): void {
    blockIds.forEach(id => this.cache.delete(id))
  }

  /**
   * Clear entire cache.
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats for debugging.
   */
  getCacheStats(): { size: number; blockIds: string[] } {
    return {
      size: this.cache.size,
      blockIds: Array.from(this.cache.keys()),
    }
  }

  /**
   * Core measurement function - converts DOM pixels to canvas percentages.
   */
  private measureBlock(block: CanvasBlock): BlockMeasurement {
    const canvas = this.canvasElement
    if (!canvas) {
      // Fallback: use stored values (less accurate)
      return this.createFallbackMeasurement(block)
    }

    const blockElement = canvas.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement
    if (!blockElement) {
      return this.createFallbackMeasurement(block)
    }

    const boundingBox = this.domRectToCanvasRect(blockElement.getBoundingClientRect())

    return {
      blockId: block.id,
      timestamp: Date.now(),
      boundingBox,
      contentHash: this.hashContent(block.content),
      styleHash: this.hashStyle(block.style),
    }
  }

  /**
   * Detailed measurement including character and line positions.
   */
  private measureBlockDetailed(block: CanvasBlock, includeCharacters: boolean): BlockMeasurement {
    const baseMeasurement = this.measureBlock(block)

    const canvas = this.canvasElement
    if (!canvas) return baseMeasurement

    const blockElement = canvas.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement
    if (!blockElement) return baseMeasurement

    // Find the text content element (inside the block wrapper)
    // Try multiple selectors since structure may vary
    const textElement =
      blockElement.querySelector('.whitespace-pre-wrap') as HTMLElement ||
      blockElement.querySelector('[contenteditable]') as HTMLElement ||
      blockElement

    if (!textElement) return baseMeasurement

    const { characters, lines } = this.measureTextContent(textElement, includeCharacters)

    return {
      ...baseMeasurement,
      characters: includeCharacters ? characters : undefined,
      lines,
    }
  }

  /**
   * Measure text content using Range API.
   */
  private measureTextContent(
    textElement: HTMLElement,
    includeCharacters: boolean
  ): {
    characters: CharacterMeasurement[]
    lines: LineMeasurement[]
  } {
    const characters: CharacterMeasurement[] = []
    const lines: LineMeasurement[] = []

    // Get text nodes
    const walker = document.createTreeWalker(
      textElement,
      NodeFilter.SHOW_TEXT,
      null
    )

    let charIndex = 0
    let currentLineTop = -Infinity
    let currentLineIndex = -1
    let lineStartIndex = 0
    let lineChars: CharacterMeasurement[] = []
    const LINE_THRESHOLD = 2 // pixels - if Y changes by more than this, it's a new line

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text
      const text = textNode.textContent || ''

      for (let i = 0; i < text.length; i++) {
        const range = document.createRange()
        range.setStart(textNode, i)
        range.setEnd(textNode, i + 1)

        const domRect = range.getBoundingClientRect()
        const canvasRect = this.domRectToCanvasRect(domRect)

        // Detect line breaks (Y position changed significantly)
        if (Math.abs(domRect.top - currentLineTop) > LINE_THRESHOLD) {
          // Save previous line
          if (currentLineIndex >= 0 && lineChars.length > 0) {
            lines.push({
              lineIndex: currentLineIndex,
              startCharIndex: lineStartIndex,
              endCharIndex: charIndex - 1,
              rect: this.computeBoundsFromChars(lineChars),
              isWrapped: currentLineIndex > 0 && (lineChars[0]?.char !== '\n'),
            })
          }

          currentLineTop = domRect.top
          currentLineIndex++
          lineStartIndex = charIndex
          lineChars = []
        }

        const charMeasurement: CharacterMeasurement = {
          char: text[i],
          index: charIndex,
          rect: canvasRect,
          lineIndex: currentLineIndex,
        }

        if (includeCharacters) {
          characters.push(charMeasurement)
        }
        lineChars.push(charMeasurement)

        charIndex++
      }
    }

    // Save final line
    if (lineChars.length > 0) {
      lines.push({
        lineIndex: currentLineIndex,
        startCharIndex: lineStartIndex,
        endCharIndex: charIndex - 1,
        rect: this.computeBoundsFromChars(lineChars),
        isWrapped: false,
      })
    }

    return { characters, lines }
  }

  /**
   * Convert DOM DOMRect to canvas percentage coordinates.
   * This is the key normalization function that eliminates coordinate confusion.
   */
  private domRectToCanvasRect(domRect: DOMRect): CanvasRect {
    const canvas = this.canvasElement
    if (!canvas) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    const canvasRect = canvas.getBoundingClientRect()

    // Convert pixel positions to percentages of canvas
    // Note: getBoundingClientRect includes CSS transforms (scaling),
    // so we work entirely in the transformed pixel space
    const x = ((domRect.left - canvasRect.left) / canvasRect.width) * 100
    const y = ((domRect.top - canvasRect.top) / canvasRect.height) * this.canvasHeightPercent
    const width = (domRect.width / canvasRect.width) * 100
    const height = (domRect.height / canvasRect.height) * this.canvasHeightPercent

    return { x, y, width, height }
  }

  /**
   * Compute bounding box that encompasses all given characters.
   */
  private computeBoundsFromChars(chars: CharacterMeasurement[]): CanvasRect {
    if (chars.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    const minX = Math.min(...chars.map(c => c.rect.x))
    const minY = Math.min(...chars.map(c => c.rect.y))
    const maxX = Math.max(...chars.map(c => c.rect.x + c.rect.width))
    const maxY = Math.max(...chars.map(c => c.rect.y + c.rect.height))

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  /**
   * Create fallback measurement when DOM is not available.
   */
  private createFallbackMeasurement(block: CanvasBlock): BlockMeasurement {
    // Use stored values with conservative height estimate
    const heightEstimate = block.height > 0 ? block.height : 6 // 6% fallback (matches old system)

    return {
      blockId: block.id,
      timestamp: Date.now(),
      boundingBox: {
        x: block.x,
        y: block.y,
        width: block.width || 12,
        height: heightEstimate,
      },
      contentHash: this.hashContent(block.content),
      styleHash: this.hashStyle(block.style),
    }
  }

  /**
   * Check if cached measurement is still valid.
   */
  private isCacheValid(cached: BlockMeasurement, block: CanvasBlock): boolean {
    // Check timeout
    if (Date.now() - cached.timestamp > this.config.cacheTimeoutMs) {
      return false
    }

    // Check content/style hash
    if (cached.contentHash !== this.hashContent(block.content)) {
      return false
    }
    if (cached.styleHash !== this.hashStyle(block.style)) {
      return false
    }

    return true
  }

  /**
   * Simple hash for content comparison.
   */
  private hashContent(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i)
      hash |= 0
    }
    return hash.toString(16)
  }

  /**
   * Simple hash for style comparison.
   * Only includes properties that affect layout.
   */
  private hashStyle(style: TextStyle): string {
    const relevant = JSON.stringify({
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
    })
    let hash = 0
    for (let i = 0; i < relevant.length; i++) {
      hash = ((hash << 5) - hash) + relevant.charCodeAt(i)
      hash |= 0
    }
    return hash.toString(16)
  }
}

// Export singleton instance
export const measurementService = new MeasurementService()
