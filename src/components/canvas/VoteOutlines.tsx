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

/**
 * Generate a wavy closed path around a rectangle.
 * Uses quadratic bezier curves with alternating outward/inward bumps.
 */
function wavyRectPath(
  w: number,
  h: number,
  segments: number,
  amplitude: number,
  phase: number = 0
): string {
  const points: string[] = []

  const wavySide = (
    x1: number, y1: number,
    x2: number, y2: number,
    outwardX: number, outwardY: number
  ) => {
    const segLen = 1 / segments
    for (let i = 0; i < segments; i++) {
      const t2 = (i + 0.5) * segLen
      const t3 = (i + 1) * segLen

      // Alternating in/out bumps for a true wavy feel
      const sign = (i % 2 === 0) ? 1 : -0.6
      const mx = x1 + (x2 - x1) * t2 + outwardX * amplitude * sign * Math.cos((i + phase) * 0.9)
      const my = y1 + (y2 - y1) * t2 + outwardY * amplitude * sign * Math.cos((i + phase) * 0.9)

      const ex = x1 + (x2 - x1) * t3
      const ey = y1 + (y2 - y1) * t3

      points.push(`Q ${mx.toFixed(1)} ${my.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`)
    }
  }

  const pad = 1
  const x0 = pad, y0 = pad
  const x1 = w - pad, y1 = h - pad

  points.push(`M ${x0} ${y0}`)
  wavySide(x0, y0, x1, y0, 0, -1) // top
  wavySide(x1, y0, x1, y1, 1, 0)  // right
  wavySide(x1, y1, x0, y1, 0, 1)  // bottom
  wavySide(x0, y1, x0, y0, -1, 0) // left
  points.push('Z')

  return points.join(' ')
}

interface VoteOutlinesProps {
  block: CanvasBlock
}

export function VoteOutlines({ block }: VoteOutlinesProps) {
  const voteCount = block.voters?.length ?? 0
  const numOutlines = Math.min(3, Math.max(1, Math.ceil(voteCount / 2)))
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  // Observe actual pixel size so SVG viewBox matches 1:1 with CSS pixels
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setSize({ w: Math.round(width), h: Math.round(height) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const configs = useMemo(() => {
    return Array.from({ length: numOutlines }, (_, i) => {
      const hash = hashStr(block.id + i)
      return {
        color: OUTLINE_COLORS[hash % OUTLINE_COLORS.length],
        dashPattern: ['6 4', '3 3', '8 3 2 3'][i % 3],
        inset: -(1 + i * 2), // tighter: -1px, -3px, -5px
        animClass: `dash-dance-${i + 1}`,
        opacity: 0.75 - i * 0.12,
        segments: 8 + i * 2,      // more undulations
        amplitude: 4 + i * 2,     // more pronounced waves
        phase: (hash % 10) * 0.7,
      }
    })
  }, [block.id, numOutlines])

  if (voteCount === 0) return null

  return (
    <div ref={wrapperRef} className="absolute inset-0 pointer-events-none">
      {size && configs.map((cfg, i) => {
        // Compute the actual SVG dimensions including the spread
        const spread = -cfg.inset
        const svgW = size.w + spread * 2
        const svgH = size.h + spread * 2
        const path = wavyRectPath(svgW, svgH, cfg.segments, cfg.amplitude, cfg.phase)

        return (
          <svg
            key={i}
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="absolute pointer-events-none"
            style={{
              top: cfg.inset,
              left: cfg.inset,
              width: svgW,
              height: svgH,
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
