'use client'

import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { useCanvas, DESIGN_WIDTH } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { CanvasBlock } from './CanvasBlock'
import { UnifiedPanel } from '@/components/panel/UnifiedPanel'
import { IntroHint } from '@/components/IntroHint'
import { CampaignBanner } from '@/components/CampaignBanner'
import { incrementPageViews } from '@/lib/campaignStorage'

// Mobile safe zone width (for admin visual guide)
const MOBILE_SAFE_ZONE = 375

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
  const [isAddTextMode, setIsAddTextMode] = useState(false)
  const isMarqueeActive = useRef(false)

  // Scale factor for viewport < DESIGN_WIDTH
  const [scale, setScale] = useState(1)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  // Calculate canvas height based on lowest block + one page of empty space
  const canvasHeight = useMemo(() => {
    if (blocks.length === 0) return 100 // Default to 100% (one viewport height)

    // Find the lowest block (highest y value + estimated height)
    // Using y + 10 as rough estimate for block height in percentage
    const lowestBottom = Math.max(...blocks.map(b => b.y + 10))

    // Ensure at least one full page of empty space below lowest content
    // 100 = one full viewport height worth of space
    return Math.max(100, lowestBottom + 100)
  }, [blocks])

  // Track viewport size and update scale
  useEffect(() => {
    const updateScale = () => {
      const viewportWidth = window.innerWidth
      const newScale = Math.min(1, viewportWidth / DESIGN_WIDTH)
      setScale(newScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isMarqueeActive.current) {
        // If in add text mode, place text at click position
        if (isAddTextMode && isAdmin) {
          const canvas = canvasRef.current
          if (canvas) {
            const rect = canvas.getBoundingClientRect()
            // Account for scale when converting coordinates
            // rect.width is the scaled width, divide by scale to get design width
            const x = ((e.clientX - rect.left) / rect.width) * 100
            const y = ((e.clientY - rect.top) / rect.height) * canvasHeight
            addText(x, y)
            setIsAddTextMode(false)
            return
          }
        }
        selectBlock(null)
        setContextMenu(null)
      }
    },
    [selectBlock, isAddTextMode, isAdmin, canvasRef, addText, canvasHeight]
  )

  // Start marquee selection on mouse down (available to everyone)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left click

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      // Convert to percentage of design canvas
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeight

      isMarqueeActive.current = true
      setMarquee({ startX: x, startY: y, currentX: x, currentY: y })
    },
    [canvasRef, canvasHeight]
  )

  // Update marquee and handle selection
  useEffect(() => {
    if (!marquee) return

    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      // Convert to percentage of design canvas
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeight
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
  }, [marquee, blocks, selectBlocks, canvasRef, canvasHeight])

  // Right-click to show context menu (admin only)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!isAdmin) return

      e.preventDefault()

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      // Convert to percentage of design canvas
      const canvasX = ((e.clientX - rect.left) / rect.width) * 100
      const canvasY = ((e.clientY - rect.top) / rect.height) * canvasHeight

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        canvasX,
        canvasY,
      })
    },
    [isAdmin, canvasRef, canvasHeight]
  )

  const handleAddText = useCallback(() => {
    if (contextMenu) {
      addText(contextMenu.canvasX, contextMenu.canvasY)
      setContextMenu(null)
    }
  }, [contextMenu, addText])

  // Keyboard shortcuts: Escape, Ctrl+A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A or Cmd+A - select all blocks
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        // Only intercept if not in a text input
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return
        }
        e.preventDefault()
        const allIds = blocks.map((b) => b.id)
        if (allIds.length > 0) {
          selectBlocks(allIds)
        }
        return
      }

      // Escape - clear selection and cancel modes
      if (e.key === 'Escape') {
        setContextMenu(null)
        setIsAddTextMode(false)
        selectBlock(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [blocks, selectBlocks, selectBlock])

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

  // Calculate the height of the scroll container wrapper to account for scale
  const scaledCanvasHeight = `calc(${canvasHeight}vh * ${scale})`

  return (
    <>
      {/* Scroll container - wraps the scaled design canvas */}
      <div
        ref={scrollContainerRef}
        className="min-h-screen w-full overflow-y-auto overflow-x-hidden bg-brand-dark"
      >
        {/* Design canvas - fixed width, centered, scaled to fit viewport */}
        <div
          ref={canvasRef}
          className={`relative mx-auto bg-brand-dark ${marquee ? 'select-none' : ''}`}
          style={{
            width: `${DESIGN_WIDTH}px`,
            minHeight: `${canvasHeight}vh`,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
        >
          {/* Mobile safe zone overlay (admin only) */}
          {isAdmin && (
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-full border-x-2 border-dashed border-white/15 pointer-events-none z-[5]"
              style={{ width: `${MOBILE_SAFE_ZONE}px` }}
              title="Mobile safe zone (375px)"
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-white/30 whitespace-nowrap">
                mobile view
              </div>
            </div>
          )}

          {/* Render all blocks */}
          {blocks.map((block) => (
            <CanvasBlock key={block.id} block={block} canvasHeight={canvasHeight} />
          ))}

          {/* Marquee selection rectangle */}
          {marquee && (
            <div
              className="absolute border-2 border-indigo-500 bg-indigo-500/20 pointer-events-none z-50"
              style={{
                left: `${Math.min(marquee.startX, marquee.currentX)}%`,
                top: `${(Math.min(marquee.startY, marquee.currentY) / canvasHeight) * 100}%`,
                width: `${Math.abs(marquee.currentX - marquee.startX)}%`,
                height: `${(Math.abs(marquee.currentY - marquee.startY) / canvasHeight) * 100}%`,
              }}
            />
          )}

          {/* Empty state for admin */}
          {isAdmin && blocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">Your canvas is empty</p>
                <p className="text-sm">Tap the + button or right-click to add text</p>
              </div>
            </div>
          )}

          {/* Add text mode indicator */}
          {isAddTextMode && (
            <div className="absolute inset-0 pointer-events-none z-40">
              <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
                Tap anywhere to place text
              </div>
            </div>
          )}

        </div>
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

      {/* Unified panel with editor + chat tabs */}
      <UnifiedPanel />

      {/* Intro hint for non-logged-in users */}
      {!user && <IntroHint />}

      {/* Campaign banner at top */}
      <CampaignBanner />

      {/* Add Text button for admin (mobile-friendly) */}
      {isAdmin && (
        <button
          onClick={() => setIsAddTextMode(!isAddTextMode)}
          className={`fixed bottom-20 left-4 z-50 p-3 rounded-full shadow-lg transition-all hover:scale-105 ${
            isAddTextMode
              ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-brand-dark'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title={isAddTextMode ? 'Cancel' : 'Add Text'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isAddTextMode ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            )}
          </svg>
        </button>
      )}
    </>
  )
}
