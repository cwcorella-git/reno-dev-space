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
 * Alternating in/out bumps for organic wave feel.
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
  wavySide(x0, y0, x1, y0, 0, -1)
  wavySide(x1, y0, x1, y1, 1, 0)
  wavySide(x1, y1, x0, y1, 0, 1)
  wavySide(x0, y1, x0, y0, -1, 0)
  points.push('Z')

  return points.join(' ')
}

interface VoteOutlinesProps {
  block: CanvasBlock
}

export function VoteOutlines({ block }: VoteOutlinesProps) {
  const voteCount = block.voters?.length ?? 0
  const numOutlines = voteCount > 0 ? Math.min(3, Math.max(1, Math.ceil(voteCount / 2))) : 0
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
      return {
        color: OUTLINE_COLORS[hash % OUTLINE_COLORS.length],
        dashPattern: ['6 4', '3 3', '8 3 2 3'][i % 3],
        inset: -(1 + i * 2),
        animClass: `dash-dance-${i + 1}`,
        opacity: 0.75 - i * 0.12,
        segments: 8 + i * 2,
        amplitude: 4 + i * 2,
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
        const path = wavyRectPath(svgW, svgH, cfg.segments, cfg.amplitude, cfg.phase)

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
