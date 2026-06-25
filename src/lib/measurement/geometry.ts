/**
 * Pure pixel-space geometry for canvas collision.
 *
 * The canvas uses TWO percentage scales: x/width are % of DESIGN_WIDTH (1440),
 * y/height are % of DESIGN_HEIGHT (900). Comparing them directly is wrong
 * because 1% of x (14.4px) != 1% of y (9px). Every overlap test must convert
 * to pixels first. This module is the ONE place that happens.
 */
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '@/types/canvas'

export interface PixelRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** A rect in canvas percentage space: x/width are %-of-1440, y/height are %-of-900. */
export interface PercentRect {
  x: number
  y: number
  width: number
  height: number
}

export const PX_PER_X_UNIT = DESIGN_WIDTH / 100  // 14.4 px per 1% on x
export const PX_PER_Y_UNIT = DESIGN_HEIGHT / 100 // 9.0 px per 1% on y

/** Convert a percentage-space rect to pixels in the design canvas. */
export function percentRectToPixels(r: PercentRect): PixelRect {
  const left = r.x * PX_PER_X_UNIT
  const top = r.y * PX_PER_Y_UNIT
  return {
    left,
    top,
    right: left + r.width * PX_PER_X_UNIT,
    bottom: top + r.height * PX_PER_Y_UNIT,
  }
}

/**
 * AABB overlap test in pixel space.
 * `marginPx` adjusts rect `b`'s effective hit zone on ALL sides:
 *   - positive  -> grow b   (enforce a gap; blocks must stay marginPx apart)
 *   - negative  -> shrink b  (tolerance; allow up to |marginPx| of overlap)
 */
export function rectsOverlapPx(a: PixelRect, b: PixelRect, marginPx = 0): boolean {
  return !(
    a.right <= b.left - marginPx ||
    a.left >= b.right + marginPx ||
    a.bottom <= b.top - marginPx ||
    a.top >= b.bottom + marginPx
  )
}

/** Convenience: overlap test for two percentage-space rects. */
export function percentRectsOverlap(a: PercentRect, b: PercentRect, marginPx = 0): boolean {
  return rectsOverlapPx(percentRectToPixels(a), percentRectToPixels(b), marginPx)
}
