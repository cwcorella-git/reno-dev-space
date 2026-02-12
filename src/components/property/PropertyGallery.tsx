'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RentalProperty } from '@/types/property'
import { subscribeToProperties } from '@/lib/storage/propertyStorage'
import { useAuth } from '@/contexts/AuthContext'
import { useCanvas } from '@/contexts/CanvasContext'
import { PropertyCarousel } from './PropertyCarousel'
import {
  subscribeToGalleryPosition,
  updateGalleryPosition,
  DEFAULT_POSITION,
  PropertyGalleryPosition,
} from '@/lib/storage/propertyGalleryStorage'
import { displacOverlappingBlocks } from '@/lib/overlapDetection'

interface PropertyGalleryProps {
  onAddPropertyClick: () => void
  canvasHeightPercent: number
}

export function PropertyGallery({ onAddPropertyClick, canvasHeightPercent }: PropertyGalleryProps) {
  const [properties, setProperties] = useState<RentalProperty[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const { user, isAdmin } = useAuth()
  const { blocks, moveBlocks, recordHistory } = useCanvas()

  // Gallery position state
  const [firestorePos, setFirestorePos] = useState<PropertyGalleryPosition>(DEFAULT_POSITION)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null)

  // Subscribe to properties
  useEffect(() => {
    const unsubscribe = subscribeToProperties(
      (props) => {
        setProperties(props)
        setLoading(false)
      },
      (error) => {
        console.error('[PropertyGallery] Error:', error)
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  // Subscribe to gallery position from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToGalleryPosition(
      setFirestorePos,
      (error) => console.error('[PropertyGallery] Position error:', error)
    )
    return () => unsubscribe()
  }, [])

  // Jitter prevention: clear dragPos when Firestore confirms new position
  useEffect(() => {
    if (pendingPosRef.current && !isDragging) {
      const tolerance = 0.01
      const xMatches = Math.abs(firestorePos.x - pendingPosRef.current.x) < tolerance
      const yMatches = Math.abs(firestorePos.y - pendingPosRef.current.y) < tolerance
      if (xMatches && yMatches) {
        pendingPosRef.current = null
        setDragPos(null)
      }
    }
  }, [firestorePos, isDragging])

  // Random initial index when properties load
  useEffect(() => {
    if (properties.length > 0 && currentIndex === 0) {
      const randomIndex = Math.floor(Math.random() * properties.length)
      setCurrentIndex(randomIndex)
    }
  }, [properties.length, currentIndex])

  // Drag handlers (admin-only)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isAdmin) return
      e.preventDefault()
      e.stopPropagation() // Prevent marquee selection from triggering

      const canvas = document.querySelector('[data-canvas-container]') as HTMLElement
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const startX = e.clientX
      const startY = e.clientY
      const startPos = dragPos ?? firestorePos

      setIsDragging(true)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
        const deltaY = ((moveEvent.clientY - startY) / rect.height) * canvasHeightPercent

        // Gallery dimensions in percentage
        const GALLERY_WIDTH = 25.0 // 360px / 1440px * 100
        const GALLERY_HEIGHT = 22   // Estimated height (increased with bigger cards)
        // Mobile zone: 375px centered in 1440px = 532.5px to 907.5px
        const MOBILE_ZONE_LEFT = 37.0  // 532.5 / 1440 * 100
        const MOBILE_ZONE_RIGHT = 63.0 // 907.5 / 1440 * 100

        // Constrain X to mobile safe zone (gallery must fit within zone)
        const newX = Math.max(
          MOBILE_ZONE_LEFT,
          Math.min(MOBILE_ZONE_RIGHT - GALLERY_WIDTH, startPos.x + deltaX)
        )

        // Constrain Y to canvas bounds
        const newY = Math.max(0, Math.min(canvasHeightPercent - GALLERY_HEIGHT, startPos.y + deltaY))

        setDragPos({ x: newX, y: newY })
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        if (!dragPos) {
          setIsDragging(false)
          return
        }

        // Check for overlapping blocks and displace them
        const GALLERY_WIDTH = 25.0  // 360px / 1440px * 100
        const GALLERY_HEIGHT = 22
        const galleryRect = {
          x: dragPos.x,
          y: dragPos.y,
          width: GALLERY_WIDTH,
          height: GALLERY_HEIGHT,
        }

        const displacements = displacOverlappingBlocks(galleryRect, blocks)

        if (displacements.length > 0) {
          // Record history for displaced blocks (undo-able)
          recordHistory('move', displacements.map((d) => d.id))

          // Move displaced blocks to new positions
          moveBlocks(displacements.map((d) => ({ id: d.id, x: d.newX, y: d.newY })))
        }

        // Save gallery position to Firestore
        if (user) {
          updateGalleryPosition(dragPos.x, dragPos.y, user.uid)
          pendingPosRef.current = dragPos
        }

        setIsDragging(false)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [isAdmin, dragPos, firestorePos, blocks, moveBlocks, recordHistory, canvasHeightPercent, user]
  )

  // Mobile touch handlers (admin-only, 300ms hold-to-drag)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [isHolding, setIsHolding] = useState(false)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isAdmin) return
      e.stopPropagation() // Prevent canvas touch handlers from interfering

      const touch = e.touches[0]
      const canvas = document.querySelector('[data-canvas-container]') as HTMLElement
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const startX = touch.clientX
      const startY = touch.clientY
      const startPos = dragPos ?? firestorePos

      // 300ms hold timer
      holdTimerRef.current = setTimeout(() => {
        setIsHolding(true)
        setIsDragging(true)

        // Haptic feedback (if available)
        if ('vibrate' in navigator) {
          navigator.vibrate(50)
        }
      }, 300)

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (!isHolding) return
        moveEvent.preventDefault()

        const moveTouch = moveEvent.touches[0]
        const deltaX = ((moveTouch.clientX - startX) / rect.width) * 100
        const deltaY = ((moveTouch.clientY - startY) / rect.height) * canvasHeightPercent

        const GALLERY_WIDTH = 25.0 // 360px / 1440px * 100
        const GALLERY_HEIGHT = 22
        const MOBILE_ZONE_LEFT = 37.0  // 532.5 / 1440 * 100
        const MOBILE_ZONE_RIGHT = 63.0 // 907.5 / 1440 * 100

        const newX = Math.max(
          MOBILE_ZONE_LEFT,
          Math.min(MOBILE_ZONE_RIGHT - GALLERY_WIDTH, startPos.x + deltaX)
        )
        const newY = Math.max(0, Math.min(canvasHeightPercent - GALLERY_HEIGHT, startPos.y + deltaY))

        setDragPos({ x: newX, y: newY })
      }

      const handleTouchEnd = () => {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)

        if (!isHolding) {
          setIsHolding(false)
          return
        }

        setIsHolding(false)

        if (!dragPos) {
          setIsDragging(false)
          return
        }

        // Displace overlapping blocks
        const GALLERY_WIDTH = 25.0  // 360px / 1440px * 100
        const GALLERY_HEIGHT = 22
        const galleryRect = {
          x: dragPos.x,
          y: dragPos.y,
          width: GALLERY_WIDTH,
          height: GALLERY_HEIGHT,
        }

        const displacements = displacOverlappingBlocks(galleryRect, blocks)

        if (displacements.length > 0) {
          recordHistory('move', displacements.map((d) => d.id))
          moveBlocks(displacements.map((d) => ({ id: d.id, x: d.newX, y: d.newY })))
        }

        // Save to Firestore
        if (user) {
          updateGalleryPosition(dragPos.x, dragPos.y, user.uid)
          pendingPosRef.current = dragPos
        }

        setIsDragging(false)
      }

      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
    },
    [isAdmin, dragPos, firestorePos, blocks, moveBlocks, recordHistory, canvasHeightPercent, user, isHolding]
  )

  // Current display position: use drag position if dragging, else Firestore position
  const displayPos = dragPos ?? firestorePos

  if (loading) {
    return (
      <div
        className={`absolute border border-white/10 rounded-lg bg-gray-900/80 backdrop-blur-sm ${
          isAdmin ? 'cursor-move hover:border-indigo-400/40' : ''
        }`}
        style={{
          left: `${displayPos.x}%`,
          top: `${(displayPos.y / canvasHeightPercent) * 100}%`,
          width: '360px',
          boxShadow: isDragging ? '0 8px 32px rgba(99, 102, 241, 0.5)' : undefined,
        }}
        onMouseDown={isAdmin ? handleMouseDown : undefined}
        onTouchStart={isAdmin ? handleTouchStart : undefined}
      >
        <div className="px-5 py-5 text-center text-gray-400">
          <p className="text-sm">Loading properties...</p>
        </div>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <>
        <div
          className={`absolute border border-white/10 rounded-lg bg-gray-900/80 backdrop-blur-sm ${
            isAdmin ? 'cursor-move hover:border-indigo-400/40' : ''
          }`}
          style={{
            left: `${displayPos.x}%`,
            top: `${(displayPos.y / canvasHeightPercent) * 100}%`,
            width: '360px',
            boxShadow: isDragging ? '0 8px 32px rgba(99, 102, 241, 0.5)' : undefined,
          }}
          onMouseDown={isAdmin ? handleMouseDown : undefined}
          onTouchStart={isAdmin ? handleTouchStart : undefined}
        >
          <div className="px-5 py-5">
            {/* Header */}
            <h3 className="text-lg font-bold text-white mb-3 text-center">Potential Spaces</h3>

            <p className="text-sm text-gray-400 mb-4 text-center">
              {user
                ? "No rental properties yet. Be the first to suggest one!"
                : "No rental properties yet. Sign in to suggest one!"}
            </p>

            {user && (
              <button
                onClick={onAddPropertyClick}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + Add Property
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div
        className={`absolute border border-white/10 rounded-lg bg-gray-900/80 backdrop-blur-sm ${
          isAdmin ? 'cursor-move hover:border-indigo-400/40' : ''
        }`}
        style={{
          left: `${displayPos.x}%`,
          top: `${(displayPos.y / canvasHeightPercent) * 100}%`,
          width: '360px',
          boxShadow: isDragging ? '0 8px 32px rgba(99, 102, 241, 0.5)' : undefined,
        }}
        onMouseDown={isAdmin ? handleMouseDown : undefined}
        onTouchStart={isAdmin ? handleTouchStart : undefined}
      >
        <div className="px-5 py-5">
          {/* Header */}
          <h3 className="text-lg font-bold text-white mb-4 text-center">Potential Spaces</h3>

          {/* Carousel */}
          <PropertyCarousel
            properties={properties}
            currentIndex={currentIndex}
            onIndexChange={setCurrentIndex}
          />

          {/* Add Property button (below carousel) */}
          {user && (
            <button
              onClick={onAddPropertyClick}
              className="w-full mt-3 px-4 py-2 bg-white/5 hover:bg-white/10 text-indigo-400 hover:text-indigo-300 text-sm font-medium rounded-lg transition-colors border border-white/10"
            >
              + Add Property
            </button>
          )}
        </div>
      </div>
    </>
  )
}
