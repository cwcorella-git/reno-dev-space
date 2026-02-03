'use client'

import { useMemo } from 'react'
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

/**
 * Generate a wavy/zigzag closed path around a rectangle.
 * The wave runs along the perimeter with `segments` bumps per side.
 * amplitude controls how far the wave deviates from the edge.
 */
function wavyRectPath(
  w: number,
  h: number,
  segments: number,
  amplitude: number,
  phase: number = 0
): string {
  const points: string[] = []

  // Helper: add a wavy line from (x1,y1) to (x2,y2) with bumps perpendicular
  const wavySide = (
    x1: number, y1: number,
    x2: number, y2: number,
    outwardX: number, outwardY: number
  ) => {
    const segLen = 1 / segments
    for (let i = 0; i < segments; i++) {
      const t1 = i * segLen
      const t2 = (i + 0.5) * segLen
      const t3 = (i + 1) * segLen

      // Midpoint bumps outward
      const mx = x1 + (x2 - x1) * t2 + outwardX * amplitude * Math.sin((i + phase) * 1.3)
      const my = y1 + (y2 - y1) * t2 + outwardY * amplitude * Math.sin((i + phase) * 1.3)

      const ex = x1 + (x2 - x1) * t3
      const ey = y1 + (y2 - y1) * t3

      // Quadratic bezier through the bumped midpoint
      points.push(`Q ${mx.toFixed(1)} ${my.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`)
    }
  }

  const pad = 1 // small inset
  const x0 = pad, y0 = pad
  const x1 = w - pad, y1 = h - pad

  points.push(`M ${x0} ${y0}`)

  // Top edge (bumps go outward = up = -Y)
  wavySide(x0, y0, x1, y0, 0, -1)
  // Right edge (bumps go outward = right = +X)
  wavySide(x1, y0, x1, y1, 1, 0)
  // Bottom edge (bumps go outward = down = +Y)
  wavySide(x1, y1, x0, y1, 0, 1)
  // Left edge (bumps go outward = left = -X)
  wavySide(x0, y1, x0, y0, -1, 0)

  points.push('Z')
  return points.join(' ')
}

interface VoteOutlinesProps {
  block: CanvasBlock
}

export function VoteOutlines({ block }: VoteOutlinesProps) {
  const voteCount = block.voters?.length ?? 0
  const numOutlines = Math.min(3, Math.max(1, Math.ceil(voteCount / 2)))

  const configs = useMemo(() => {
    return Array.from({ length: numOutlines }, (_, i) => {
      const hash = hashStr(block.id + i)
      return {
        color: OUTLINE_COLORS[hash % OUTLINE_COLORS.length],
        dashPattern: [
          '6 4',
          '3 3',
          '8 3 2 3',
        ][i % 3],
        inset: -(3 + i * 3),
        animClass: `dash-dance-${i + 1}`,
        opacity: 0.75 - i * 0.12,
        segments: 6 + i * 2,
        amplitude: 2.5 + i * 1.5,
        phase: (hash % 10) * 0.7,
      }
    })
  }, [block.id, numOutlines])

  if (voteCount === 0) return null

  return (
    <>
      {configs.map((cfg, i) => {
        const spread = -cfg.inset
        // SVG viewBox size: block size + 2*spread
        const svgW = 200 // Use a fixed viewBox, scale with CSS
        const svgH = 80
        const path = wavyRectPath(svgW, svgH, cfg.segments, cfg.amplitude, cfg.phase)

        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              top: cfg.inset,
              left: cfg.inset,
              right: cfg.inset,
              bottom: cfg.inset,
            }}
          >
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
              style={{ overflow: 'visible' }}
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
          </div>
        )
      })}
    </>
  )
}
