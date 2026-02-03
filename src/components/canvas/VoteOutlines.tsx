'use client'

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

const DASH_PATTERNS = [
  '8 4',      // classic dash
  '3 3',      // dots
  '12 4 4 4', // dash-dot
  '6 6',      // even dash
  '2 6',      // sparse dots
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

interface VoteOutlinesProps {
  block: CanvasBlock
}

function getOutlineConfigs(blockId: string, voteCount: number) {
  const numOutlines = Math.min(3, Math.max(1, Math.ceil(voteCount / 2)))
  const configs = []

  for (let i = 0; i < numOutlines; i++) {
    const hash = hashStr(blockId + i)
    configs.push({
      color: OUTLINE_COLORS[hash % OUTLINE_COLORS.length],
      dashPattern: DASH_PATTERNS[(hash >> 3) % DASH_PATTERNS.length],
      inset: -(2 + i * 3), // -2px, -5px, -8px
      animClass: `dash-dance-${i + 1}`,
      opacity: 0.7 - i * 0.15,
    })
  }

  return configs
}

export function VoteOutlines({ block }: VoteOutlinesProps) {
  const voteCount = block.voters?.length ?? 0
  if (voteCount === 0) return null

  const configs = getOutlineConfigs(block.id, voteCount)

  return (
    <>
      {configs.map((cfg, i) => {
        const spread = -cfg.inset
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
              width="100%"
              height="100%"
              className="absolute inset-0"
              style={{ overflow: 'visible' }}
            >
              <rect
                x="0.5"
                y="0.5"
                width={`calc(100% - 1px)`}
                height={`calc(100% - 1px)`}
                rx={4 + spread * 0.3}
                ry={4 + spread * 0.3}
                fill="none"
                stroke={cfg.color}
                strokeWidth={1.5}
                strokeDasharray={cfg.dashPattern}
                strokeOpacity={cfg.opacity}
                className={cfg.animClass}
              />
            </svg>
          </div>
        )
      })}
    </>
  )
}
