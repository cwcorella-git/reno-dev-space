'use client'

import { useRef, useState } from 'react'

interface GalleryPositionSliderProps {
  currentY: number              // Current Y position (0-canvasHeightPercent)
  canvasHeightPercent: number   // Total canvas height percentage
  onChange: (newY: number) => void
  visible: boolean              // Desktop only
}

/**
 * Vertical slider for controlling PropertyGallery Y position (desktop only).
 * Positioned to the right of the mobile safe zone in the desktop focus area.
 */
export function GalleryPositionSlider({
  currentY,
  canvasHeightPercent,
  onChange,
  visible,
}: GalleryPositionSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  if (!visible) return null

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const track = trackRef.current
    if (!track) return

    const rect = track.getBoundingClientRect()

    const updatePosition = (clientY: number) => {
      const y = (clientY - rect.top) / rect.height
      const clampedY = Math.max(0, Math.min(1, y))
      const newY = clampedY * canvasHeightPercent
      onChange(newY)
    }

    // Immediately update on mouse down
    updatePosition(e.clientY)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updatePosition(moveEvent.clientY)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Calculate thumb position as percentage of track height
  const thumbPositionPercent = (currentY / canvasHeightPercent) * 100

  return (
    <div
      className="fixed z-[45]"
      style={{
        // Position: right of mobile safe zone (375px centered) + 20px spacing
        // Mobile zone ends at: (1440/2 + 375/2) = 907.5px
        // As percentage: 907.5 / 1440 * 100 = 63%
        // Plus spacing: 63% + (20/1440*100) = 64.4%
        left: '64.4%',
        top: '10%',
        height: '80%',
      }}
    >
      {/* Track */}
      <div
        ref={trackRef}
        className="relative w-0.5 h-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
        onMouseDown={handleMouseDown}
      >
        {/* Thumb */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all ${
            isDragging
              ? 'bg-indigo-400 scale-125 shadow-lg shadow-indigo-500/50'
              : 'bg-indigo-500 hover:bg-indigo-400 hover:scale-110'
          }`}
          style={{
            top: `${thumbPositionPercent}%`,
          }}
        />
      </div>

      {/* Label (optional, shown on hover) */}
      <div
        className="absolute left-6 top-0 text-xs text-gray-400 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
        style={{ top: `${thumbPositionPercent}%`, transform: 'translateY(-50%)' }}
      >
        {Math.round(currentY)}%
      </div>
    </div>
  )
}
