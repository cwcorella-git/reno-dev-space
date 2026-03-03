'use client'

import { usePresence } from '@/contexts/PresenceContext'
import { useMemo } from 'react'

// Assign consistent colors to users based on their userId
const CURSOR_COLORS = [
  '#f87171', // red
  '#fb923c', // orange
  '#facc15', // yellow
  '#4ade80', // green
  '#22d3ee', // cyan
  '#818cf8', // indigo
  '#e879f9', // pink
  '#f472b6', // rose
]

function getUserColor(userId: string): string {
  // Simple hash to get consistent color for each user
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

interface CursorProps {
  userId: string
  displayName: string
  x: number // percentage 0-100
  y: number // percentage 0-100
}

function Cursor({ userId, displayName, x, y }: CursorProps) {
  const color = useMemo(() => getUserColor(userId), [userId])

  return (
    <div
      className="absolute pointer-events-none z-[200] transition-all duration-200 ease-out"
      style={{
        left: `${x}%`,
        top: `${y}%`,
      }}
    >
      {/* Cursor icon (SVG arrow) */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="drop-shadow-lg"
        style={{ transform: 'translate(-2px, -2px)' }}
      >
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87a.5.5 0 00.35-.85L6.35 2.85a.5.5 0 00-.85.35z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* Name label */}
      <div
        className="absolute top-6 left-2 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap shadow-md"
        style={{
          backgroundColor: color,
          color: '#ffffff',
        }}
      >
        {displayName}
      </div>
    </div>
  )
}

export function CursorPresence() {
  const { otherUsers } = usePresence()

  return (
    <>
      {otherUsers.map((presence) => (
        <Cursor
          key={presence.userId}
          userId={presence.userId}
          displayName={presence.displayName}
          x={presence.cursorX}
          y={presence.cursorY}
        />
      ))}
    </>
  )
}
