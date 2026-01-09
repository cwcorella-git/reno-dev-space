'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { CanvasBlock } from './CanvasBlock'
import { BlockToolbar } from './BlockToolbar'
import { IntroHint } from '@/components/IntroHint'
import { FloatingAccount } from '@/components/FloatingAccount'
import { CampaignBanner } from '@/components/CampaignBanner'
import { AdminPanel } from '@/components/AdminPanel'
import { incrementPageViews } from '@/lib/campaignStorage'

interface ContextMenuState {
  x: number // screen position
  y: number // screen position
  canvasX: number // percentage position on canvas
  canvasY: number // percentage position on canvas
}

interface MarqueeState {
  startX: number // percentage
  startY: number // percentage
  currentX: number // percentage
  currentY: number // percentage
}

export function Canvas() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { blocks, canvasRef, selectedBlockIds, loading: canvasLoading, selectBlock, selectBlocks, addText } = useCanvas()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const isMarqueeActive = useRef(false)

  const handleCanvasClick = useCallback(() => {
    if (!isMarqueeActive.current) {
      selectBlock(null)
      setContextMenu(null)
    }
  }, [selectBlock])

  // Start marquee selection on mouse down (available to everyone)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left click

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      isMarqueeActive.current = true
      setMarquee({ startX: x, startY: y, currentX: x, currentY: y })
    },
    [canvasRef]
  )

  // Update marquee and handle selection
  useEffect(() => {
    if (!marquee) return

    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      setMarquee((prev) => prev ? { ...prev, currentX: x, currentY: y } : null)
    }

    const handleMouseUp = () => {
      if (!marquee) return

      // Calculate selection rectangle bounds
      const left = Math.min(marquee.startX, marquee.currentX)
      const right = Math.max(marquee.startX, marquee.currentX)
      const top = Math.min(marquee.startY, marquee.currentY)
      const bottom = Math.max(marquee.startY, marquee.currentY)

      // Only select if dragged a meaningful distance
      const width = right - left
      const height = bottom - top
      if (width > 2 || height > 2) {
        // Find blocks within the selection rectangle
        const selectedIds = blocks
          .filter((block) => {
            // Check if block intersects with selection
            const blockLeft = block.x
            const blockTop = block.y
            // Approximate block size for hit testing
            const blockRight = block.x + (block.width || 10)
            const blockBottom = block.y + 5 // Approximate height

            return !(blockRight < left || blockLeft > right || blockBottom < top || blockTop > bottom)
          })
          .map((block) => block.id)

        if (selectedIds.length > 0) {
          selectBlocks(selectedIds)
        }
      }

      setMarquee(null)
      // Reset after a short delay to prevent click handler from deselecting
      setTimeout(() => {
        isMarqueeActive.current = false
      }, 50)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [marquee, blocks, selectBlocks, canvasRef])

  // Right-click to show context menu (admin only)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!isAdmin) return

      e.preventDefault()

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const canvasX = ((e.clientX - rect.left) / rect.width) * 100
      const canvasY = ((e.clientY - rect.top) / rect.height) * 100

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        canvasX,
        canvasY,
      })
    },
    [isAdmin, canvasRef]
  )

  const handleAddText = useCallback(() => {
    if (contextMenu) {
      addText(contextMenu.canvasX, contextMenu.canvasY)
      setContextMenu(null)
    }
  }, [contextMenu, addText])

  // Close context menu on escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Track page views (once per browser session)
  useEffect(() => {
    const viewKey = 'reno-dev-space-viewed'
    if (!localStorage.getItem(viewKey)) {
      incrementPageViews()
      localStorage.setItem(viewKey, Date.now().toString())
    }
  }, [])

  if (authLoading || canvasLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  return (
    <>
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="min-h-screen w-full bg-brand-dark relative overflow-hidden"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
        {/* Mobile safe zone overlay (admin only) */}
        {isAdmin && (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-[375px] border-x-2 border-dashed border-white/15 pointer-events-none z-[5]"
            title="Mobile safe zone (375px)"
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-white/30 whitespace-nowrap">
              mobile view
            </div>
          </div>
        )}

        {/* Render all blocks */}
        {blocks.map((block) => (
          <CanvasBlock key={block.id} block={block} />
        ))}

        {/* Marquee selection rectangle */}
        {marquee && (
          <div
            className="absolute border-2 border-indigo-500 bg-indigo-500/20 pointer-events-none z-50"
            style={{
              left: `${Math.min(marquee.startX, marquee.currentX)}%`,
              top: `${Math.min(marquee.startY, marquee.currentY)}%`,
              width: `${Math.abs(marquee.currentX - marquee.startX)}%`,
              height: `${Math.abs(marquee.currentY - marquee.startY)}%`,
            }}
          />
        )}

        {/* Empty state for admin */}
        {isAdmin && blocks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Your canvas is empty</p>
              <p className="text-sm">Right-click anywhere to add text</p>
            </div>
          </div>
        )}

      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-900 border border-white/20 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleAddText}
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Text
          </button>
        </div>
      )}

      {/* Block toolbar */}
      <BlockToolbar />

      {/* Intro hint for non-logged-in users */}
      {!user && <IntroHint />}

      {/* Campaign banner at top */}
      <CampaignBanner />

      {/* Admin panel */}
      <AdminPanel />

      {/* Floating account button */}
      <FloatingAccount />
    </>
  )
}
