'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { CanvasBlock } from '@/types/canvas'

const OUTLINE_COLORS = [
  '#818cf8', // indigo
  '#f472b6', // pink
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f87171', // red
  '#a78bfa', // violet
  '#22d3ee', // cyan
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

type OutlineStyle = 'wavy' | 'spikey' | 'bumpy' | 'scallop' | 'rounded'

const OUTLINE_STYLES: OutlineStyle[] = ['wavy', 'spikey', 'bumpy', 'scallop', 'rounded']

/**
 * Generate a wavy closed path - smooth sine-wave bumps
 */
function wavyPath(w: number, h: number, segments: number, amplitude: number, phase: number): string {
  const points: string[] = []
  const wavySide = (x1: number, y1: number, x2: number, y2: number, ox: number, oy: number) => {
    const segLen = 1 / segments
    for (let i = 0; i < segments; i++) {
      const t2 = (i + 0.5) * segLen
      const t3 = (i + 1) * segLen
      const sign = (i % 2 === 0) ? 1 : -0.6
      const mx = x1 + (x2 - x1) * t2 + ox * amplitude * sign * Math.cos((i + phase) * 0.9)
      const my = y1 + (y2 - y1) * t2 + oy * amplitude * sign * Math.cos((i + phase) * 0.9)
      points.push(`Q ${mx.toFixed(1)} ${my.toFixed(1)}, ${(x1 + (x2 - x1) * t3).toFixed(1)} ${(y1 + (y2 - y1) * t3).toFixed(1)}`)
    }
  }
  const pad = 1, x0 = pad, y0 = pad, x1 = w - pad, y1 = h - pad
  points.push(`M ${x0} ${y0}`)
  wavySide(x0, y0, x1, y0, 0, -1)
  wavySide(x1, y0, x1, y1, 1, 0)
  wavySide(x1, y1, x0, y1, 0, 1)
  wavySide(x0, y1, x0, y0, -1, 0)
  points.push('Z')
  return points.join(' ')
}

/**
 * Generate a spikey/zigzag path - sharp triangular teeth
 */
function spikeyPath(w: number, h: number, segments: number, amplitude: number, phase: number): string {
  const points: string[] = []
  const spikeSide = (x1: number, y1: number, x2: number, y2: number, ox: number, oy: number) => {
    const segLen = 1 / segments
    for (let i = 0; i < segments; i++) {
      const t1 = (i + 0.5) * segLen
      const t2 = (i + 1) * segLen
      const sign = (i % 2 === 0) ? 1 : -0.3
      const spikeX = x1 + (x2 - x1) * t1 + ox * amplitude * sign
      const spikeY = y1 + (y2 - y1) * t1 + oy * amplitude * sign
      const endX = x1 + (x2 - x1) * t2
      const endY = y1 + (y2 - y1) * t2
      points.push(`L ${spikeX.toFixed(1)} ${spikeY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`)
    }
  }
  const pad = 1, x0 = pad, y0 = pad, x1 = w - pad, y1 = h - pad
  points.push(`M ${x0} ${y0}`)
  spikeSide(x0, y0, x1, y0, 0, -1)
  spikeSide(x1, y0, x1, y1, 1, 0)
  spikeSide(x1, y1, x0, y1, 0, 1)
  spikeSide(x0, y1, x0, y0, -1, 0)
  points.push('Z')
  return points.join(' ')
}

/**
 * Generate a bumpy/bubble path - circular bumps outward
 */
function bumpyPath(w: number, h: number, segments: number, amplitude: number, phase: number): string {
  const points: string[] = []
  const bumpSide = (x1: number, y1: number, x2: number, y2: number, ox: number, oy: number) => {
    const segLen = 1 / segments
    for (let i = 0; i < segments; i++) {
      const t0 = i * segLen
      const t1 = (i + 0.25) * segLen
      const t2 = (i + 0.5) * segLen
      const t3 = (i + 0.75) * segLen
      const t4 = (i + 1) * segLen
      const amp = amplitude * (0.7 + 0.3 * Math.sin(i + phase))
      // Arc outward
      const cp1x = x1 + (x2 - x1) * t1 + ox * amp * 0.5
      const cp1y = y1 + (y2 - y1) * t1 + oy * amp * 0.5
      const peakX = x1 + (x2 - x1) * t2 + ox * amp
      const peakY = y1 + (y2 - y1) * t2 + oy * amp
      const cp2x = x1 + (x2 - x1) * t3 + ox * amp * 0.5
      const cp2y = y1 + (y2 - y1) * t3 + oy * amp * 0.5
      const endX = x1 + (x2 - x1) * t4
      const endY = y1 + (y2 - y1) * t4
      points.push(`Q ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${peakX.toFixed(1)} ${peakY.toFixed(1)}`)
      points.push(`Q ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`)
    }
  }
  const pad = 1, x0 = pad, y0 = pad, x1 = w - pad, y1 = h - pad
  points.push(`M ${x0} ${y0}`)
  bumpSide(x0, y0, x1, y0, 0, -1)
  bumpSide(x1, y0, x1, y1, 1, 0)
  bumpSide(x1, y1, x0, y1, 0, 1)
  bumpSide(x0, y1, x0, y0, -1, 0)
  points.push('Z')
  return points.join(' ')
}

/**
 * Generate a scalloped path - half-circle indents like lace
 */
function scallopPath(w: number, h: number, segments: number, amplitude: number, phase: number): string {
  const points: string[] = []
  const scallopSide = (x1: number, y1: number, x2: number, y2: number, ox: number, oy: number) => {
    const segLen = 1 / segments
    for (let i = 0; i < segments; i++) {
      const t0 = i * segLen
      const t2 = (i + 0.5) * segLen
      const t4 = (i + 1) * segLen
      // Alternating in/out scallops
      const dir = (i % 2 === 0) ? 1 : -0.5
      const amp = amplitude * dir
      const cpX = x1 + (x2 - x1) * t2 + ox * amp
      const cpY = y1 + (y2 - y1) * t2 + oy * amp
      const endX = x1 + (x2 - x1) * t4
      const endY = y1 + (y2 - y1) * t4
      points.push(`Q ${cpX.toFixed(1)} ${cpY.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`)
    }
  }
  const pad = 1, x0 = pad, y0 = pad, x1 = w - pad, y1 = h - pad
  points.push(`M ${x0} ${y0}`)
  scallopSide(x0, y0, x1, y0, 0, -1)
  scallopSide(x1, y0, x1, y1, 1, 0)
  scallopSide(x1, y1, x0, y1, 0, 1)
  scallopSide(x0, y1, x0, y0, -1, 0)
  points.push('Z')
  return points.join(' ')
}

/**
 * Generate a rounded rectangle with varying corner radii
 */
function roundedPath(w: number, h: number, segments: number, amplitude: number, phase: number): string {
  const pad = 1
  const x0 = pad, y0 = pad, x1 = w - pad, y1 = h - pad
  // Use amplitude to control corner radius (bigger amplitude = rounder)
  const r = Math.min(amplitude * 2, Math.min(x1 - x0, y1 - y0) / 3)
  return `M ${x0 + r} ${y0}
    L ${x1 - r} ${y0} Q ${x1} ${y0}, ${x1} ${y0 + r}
    L ${x1} ${y1 - r} Q ${x1} ${y1}, ${x1 - r} ${y1}
    L ${x0 + r} ${y1} Q ${x0} ${y1}, ${x0} ${y1 - r}
    L ${x0} ${y0 + r} Q ${x0} ${y0}, ${x0 + r} ${y0} Z`
}

/**
 * Generate a path based on style type
 */
function generatePath(
  style: OutlineStyle,
  w: number,
  h: number,
  segments: number,
  amplitude: number,
  phase: number
): string {
  switch (style) {
    case 'wavy': return wavyPath(w, h, segments, amplitude, phase)
    case 'spikey': return spikeyPath(w, h, segments, amplitude, phase)
    case 'bumpy': return bumpyPath(w, h, Math.max(4, Math.floor(segments / 2)), amplitude, phase)
    case 'scallop': return scallopPath(w, h, segments, amplitude, phase)
    case 'rounded': return roundedPath(w, h, segments, amplitude, phase)
    default: return wavyPath(w, h, segments, amplitude, phase)
  }
}

interface VoteOutlinesProps {
  block: CanvasBlock
}

export function VoteOutlines({ block }: VoteOutlinesProps) {
  // Only upvotes earn dancing outlines
  const upvoteCount = block.votersUp?.length ?? 0
  const numOutlines = upvoteCount > 0 ? Math.min(3, Math.max(1, Math.ceil(upvoteCount / 2))) : 0
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  // Always keep ResizeObserver running so dims are ready when votes arrive
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Defer initial measurement to ensure layout is complete
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setDims({ w: Math.round(rect.width), h: Math.round(rect.height) })
      }
    })

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDims({ w: Math.round(width), h: Math.round(height) })
        }
      }
    })
    ro.observe(el)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  const configs = useMemo(() => {
    if (numOutlines === 0) return []
    return Array.from({ length: numOutlines }, (_, i) => {
      const hash = hashStr(block.id + i)
      const hash2 = hashStr(block.id + 'style' + i)
      return {
        style: OUTLINE_STYLES[hash2 % OUTLINE_STYLES.length],
        color: OUTLINE_COLORS[hash % OUTLINE_COLORS.length],
        dashPattern: ['6 4', '3 3', '8 3 2 3', '4 2', '10 5'][hash % 5],
        inset: -(i * 1.5),
        animClass: `dash-dance-${i + 1}`,
        opacity: 0.75 - i * 0.12,
        segments: 8 + i * 2,
        amplitude: 2 + i * 1,
        phase: (hash % 10) * 0.7,
      }
    })
  }, [block.id, numOutlines])

  return (
    <div
      ref={containerRef}
      className="absolute pointer-events-none"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {numOutlines > 0 && dims.w > 0 && dims.h > 0 && configs.map((cfg, i) => {
        const spread = -cfg.inset
        const svgW = dims.w + spread * 2
        const svgH = dims.h + spread * 2
        const path = generatePath(cfg.style, svgW, svgH, cfg.segments, cfg.amplitude, cfg.phase)

        return (
          <svg
            key={i}
            viewBox={`0 0 ${svgW} ${svgH}`}
            width={svgW}
            height={svgH}
            className="absolute pointer-events-none"
            style={{
              top: cfg.inset,
              left: cfg.inset,
              overflow: 'visible',
            }}
          >
            <path
              d={path}
              fill="none"
              stroke={cfg.color}
              strokeWidth={1.5}
              strokeDasharray={cfg.dashPattern}
              strokeOpacity={cfg.opacity}
              strokeLinecap="round"
              className={cfg.animClass}
            />
          </svg>
        )
      })}
    </div>
  )
}
