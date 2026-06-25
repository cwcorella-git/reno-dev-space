import { describe, it, expect } from 'vitest'
import {
  percentRectToPixels,
  rectsOverlapPx,
  percentRectsOverlap,
  PX_PER_X_UNIT,
  PX_PER_Y_UNIT,
} from './geometry'

describe('percentRectToPixels', () => {
  it('uses 14.4px per x-unit and 9px per y-unit', () => {
    expect(PX_PER_X_UNIT).toBeCloseTo(14.4)
    expect(PX_PER_Y_UNIT).toBeCloseTo(9.0)
    const px = percentRectToPixels({ x: 10, y: 10, width: 10, height: 10 })
    expect(px.left).toBeCloseTo(144)
    expect(px.top).toBeCloseTo(90)
    expect(px.right).toBeCloseTo(288)
    expect(px.bottom).toBeCloseTo(180)
  })
})

describe('rectsOverlapPx', () => {
  const a = { left: 0, top: 0, right: 100, bottom: 100 }
  it('detects clear overlap', () => {
    expect(rectsOverlapPx(a, { left: 50, top: 50, right: 150, bottom: 150 })).toBe(true)
  })
  it('detects clear separation', () => {
    expect(rectsOverlapPx(a, { left: 200, top: 0, right: 300, bottom: 100 })).toBe(false)
  })
  it('positive margin enforces a gap (touching rects collide)', () => {
    const touching = { left: 100, top: 0, right: 200, bottom: 100 }
    expect(rectsOverlapPx(a, touching, 0)).toBe(false)
    expect(rectsOverlapPx(a, touching, 10)).toBe(true)
  })
  it('negative margin tolerates overlap', () => {
    const overlapping = { left: 95, top: 0, right: 195, bottom: 100 }
    expect(rectsOverlapPx(a, overlapping, 0)).toBe(true)
    expect(rectsOverlapPx(a, overlapping, -10)).toBe(false)
  })
})

describe('percentRectsOverlap — axis symmetry regression', () => {
  // THE core bug: equal *visual* (pixel) gaps must be judged equally on both axes,
  // even though the percentage numbers differ between x and y.
  it('treats a 14.4px horizontal gap and a 14.4px vertical gap identically', () => {
    const base = { x: 10, y: 10, width: 10, height: 10 } // 144px..288px / 90px..180px
    // Horizontal neighbor 1 x-unit (14.4px) to the right of base's right edge:
    const horiz = { x: 21, y: 10, width: 10, height: 10 }
    // Vertical neighbor 1.6 y-units (14.4px) below base's bottom edge:
    const vert = { x: 10, y: 21.6, width: 10, height: 10 }
    // With a 14.4px margin, BOTH should just barely collide; without, neither.
    expect(percentRectsOverlap(base, horiz, 0)).toBe(false)
    expect(percentRectsOverlap(base, vert, 0)).toBe(false)
    expect(percentRectsOverlap(base, horiz, 14.5)).toBe(true)
    expect(percentRectsOverlap(base, vert, 14.5)).toBe(true)
  })
})
