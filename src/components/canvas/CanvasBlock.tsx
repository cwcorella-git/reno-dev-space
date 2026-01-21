'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { CanvasBlock as CanvasBlockType, isTextBlock } from '@/types/canvas'
import { TextBlockRenderer } from './TextBlockRenderer'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { filterEditableBlocks } from '@/lib/permissions'

interface CanvasBlockProps {
  block: CanvasBlockType
  canvasHeightPercent: number // Dynamic canvas height as percentage (100 = DESIGN_HEIGHT)
}

interface DragState {
  x: number
  y: number
}

interface ResizeState {
  width: number
}

const TOUCH_HOLD_DURATION = 300 // ms to hold before drag activates

// Overflow thresholds - allow blocks to extend past canvas edges
// Positive values = percentage past 0% (left) and 100% (right)
export const OVERFLOW_LEFT = 10   // Allow blocks to go 10% past left edge
export const OVERFLOW_RIGHT = 10  // Allow blocks to go 10% past right edge (110% total)

export function CanvasBlock({ block, canvasHeightPercent }: CanvasBlockProps) {
  const { user, isAdmin } = useAuth()
  const {
    blocks,
    selectedBlockId,
    selectedBlockIds,
    isEditing,
    canvasRef,
    selectBlock,
    selectBlocks,
    setIsEditing,
    moveBlock,
    moveBlocks,
    resizeBlock,
    updateContent,
    removeBlock,
    vote,
  } = useCanvas()

  const isSelected = selectedBlockId === block.id
  const isInSelection = selectedBlockIds.includes(block.id)
  const blockRef = useRef<HTMLDivElement>(null)

  // Local drag state for immediate visual feedback
  const [dragPos, setDragPos] = useState<DragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Local resize state for immediate visual feedback
  const [resizeWidth, setResizeWidth] = useState<ResizeState | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  // Touch-and-hold state
  const [isHolding, setIsHolding] = useState(false)
  const touchHoldTimer = useRef<NodeJS.Timeout | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const isTouchDragging = useRef(false)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!user) return

      // Ctrl/Cmd+Click = toggle in selection
      if (e.ctrlKey || e.metaKey) {
        if (selectedBlockIds.includes(block.id)) {
          // Remove from selection
          const newIds = selectedBlockIds.filter(id => id !== block.id)
          selectBlocks(newIds)
        } else {
          // Add to selection
          selectBlocks([...selectedBlockIds, block.id])
        }
        return
      }

      // Normal click = single select
      selectBlock(block.id)
    },
    [user, block.id, selectedBlockIds, selectBlock, selectBlocks]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isAdmin && isTextBlock(block)) {
        setIsEditing(true)
      }
    },
    [isAdmin, block, setIsEditing]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isSelected && !isInSelection) return

      // Voting: Space = brighten (up), Alt = dim (down)
      if (e.key === ' ' && user && !isEditing) {
        e.preventDefault()
        vote(block.id, 'up')
        return
      }
      if (e.key === 'Alt' && user && !isEditing) {
        e.preventDefault()
        vote(block.id, 'down')
        return
      }

      // Delete - remove all selected blocks user can edit
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isEditing && selectedBlockIds.length > 0) {
          e.preventDefault()
          // Only delete blocks user owns (admin can delete all)
          const deletableIds = filterEditableBlocks(
            selectedBlockIds,
            blocks,
            user?.uid,
            isAdmin
          )
          deletableIds.forEach(id => removeBlock(id))
        }
      }

      if (e.key === 'Escape') {
        selectBlock(null)
      }
    },
    [isAdmin, isSelected, isInSelection, isEditing, selectedBlockIds, blocks, removeBlock, selectBlock, user, vote, block.id]
  )

  const handleContentChange = useCallback(
    (content: string) => {
      if (isTextBlock(block)) {
        updateContent(block.id, content)
      }
    },
    [block, updateContent]
  )

  // Handle drag with local state for immediate feedback
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left click

      // Always stop propagation to prevent canvas marquee from starting
      e.stopPropagation()

      // Only admin can drag selected blocks
      if (!isAdmin || !isSelected || isEditing) return

      e.preventDefault()

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const startX = e.clientX
      const startY = e.clientY
      const startBlockX = block.x
      const startBlockY = block.y

      // Get all movable blocks (those user can edit) and their starting positions
      const movableBlockIds = filterEditableBlocks(
        selectedBlockIds,
        blocks,
        user?.uid,
        isAdmin
      )
      const startPositions = new Map(
        movableBlockIds.map(id => {
          const b = blocks.find(x => x.id === id)
          return [id, { x: b?.x ?? 0, y: b?.y ?? 0 }]
        })
      )

      setIsDragging(true)
      setDragPos({ x: block.x, y: block.y })

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // x is percentage of width (0-100)
        // y is percentage of canvasHeightPercent (which may be > 100)
        const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
        const deltaY = ((moveEvent.clientY - startY) / rect.height) * canvasHeightPercent

        // Allow X to overflow past edges by threshold amounts
        const newX = Math.max(-OVERFLOW_LEFT, Math.min(100 + OVERFLOW_RIGHT - 5, startBlockX + deltaX))
        // Allow y to go up to canvasHeightPercent - 5 (leaving some margin)
        const newY = Math.max(0, Math.min(canvasHeightPercent - 5, startBlockY + deltaY))

        setDragPos({ x: newX, y: newY })
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        setIsDragging(false)

        // Get current drag position and calculate delta
        setDragPos((currentPos) => {
          if (currentPos && (currentPos.x !== block.x || currentPos.y !== block.y)) {
            const deltaX = currentPos.x - startBlockX
            const deltaY = currentPos.y - startBlockY

            // Move all selected movable blocks by the same delta
            if (movableBlockIds.length > 1) {
              const moves = movableBlockIds.map(id => {
                const startPos = startPositions.get(id) ?? { x: 0, y: 0 }
                return {
                  id,
                  x: Math.max(-OVERFLOW_LEFT, Math.min(100 + OVERFLOW_RIGHT - 5, startPos.x + deltaX)),
                  y: Math.max(0, Math.min(canvasHeightPercent - 5, startPos.y + deltaY)),
                }
              })
              moveBlocks(moves)
            } else {
              // Single block move
              moveBlock(block.id, currentPos.x, currentPos.y)
            }
          }
          return null
        })
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [isAdmin, isSelected, isEditing, canvasRef, block, moveBlock, moveBlocks, selectedBlockIds, blocks, user?.uid, canvasHeightPercent]
  )

  // Handle resize with local state for immediate feedback
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: string) => {
      if (!isAdmin || !isSelected || isEditing) return
      e.preventDefault()
      e.stopPropagation()

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const startX = e.clientX
      const startWidth = block.width

      setIsResizing(true)
      setResizeWidth({ width: block.width })

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
        let newWidth = startWidth

        if (handle.includes('e')) {
          newWidth = Math.max(5, startWidth + deltaX)
        }
        if (handle.includes('w')) {
          newWidth = Math.max(5, startWidth - deltaX)
        }

        setResizeWidth({ width: newWidth })
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        setIsResizing(false)

        // Save final width to Firestore
        setResizeWidth((currentWidth) => {
          if (currentWidth && currentWidth.width !== block.width) {
            resizeBlock(block.id, currentWidth.width, block.height)
          }
          return null
        })
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [isAdmin, isSelected, isEditing, canvasRef, block, resizeBlock]
  )

  // Clear touch hold timer on unmount
  useEffect(() => {
    return () => {
      if (touchHoldTimer.current) {
        clearTimeout(touchHoldTimer.current)
      }
    }
  }, [])

  // Touch start - begin hold timer
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isAdmin || !isSelected || isEditing) return

      const touch = e.touches[0]
      touchStartPos.current = { x: touch.clientX, y: touch.clientY }
      isTouchDragging.current = false

      // Start hold timer
      touchHoldTimer.current = setTimeout(() => {
        setIsHolding(true)
        isTouchDragging.current = true

        // Vibrate if supported (haptic feedback)
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }, TOUCH_HOLD_DURATION)
    },
    [isAdmin, isSelected, isEditing]
  )

  // Touch move - drag if hold completed
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartPos.current) return

      const touch = e.touches[0]
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x)
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y)

      // If moved too much before hold completed, cancel the hold
      if (!isTouchDragging.current && (deltaX > 10 || deltaY > 10)) {
        if (touchHoldTimer.current) {
          clearTimeout(touchHoldTimer.current)
          touchHoldTimer.current = null
        }
        setIsHolding(false)
        return
      }

      // If drag mode is active, handle the drag
      if (isTouchDragging.current) {
        e.preventDefault() // Prevent scrolling while dragging

        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const startX = touchStartPos.current.x
        const startY = touchStartPos.current.y

        // x is percentage of width (0-100)
        // y is percentage of canvasHeightPercent (which may be > 100)
        const deltaXPercent = ((touch.clientX - startX) / rect.width) * 100
        const deltaYPercent = ((touch.clientY - startY) / rect.height) * canvasHeightPercent

        // Allow X to overflow past edges by threshold amounts
        const newX = Math.max(-OVERFLOW_LEFT, Math.min(100 + OVERFLOW_RIGHT - 5, block.x + deltaXPercent))
        const newY = Math.max(0, Math.min(canvasHeightPercent - 5, block.y + deltaYPercent))

        setDragPos({ x: newX, y: newY })
        setIsDragging(true)

        // Update start position for continuous dragging
        touchStartPos.current = { x: touch.clientX, y: touch.clientY }
      }
    },
    [canvasRef, block.x, block.y, canvasHeightPercent]
  )

  // Touch end - complete drag or cancel
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Clear hold timer
      if (touchHoldTimer.current) {
        clearTimeout(touchHoldTimer.current)
        touchHoldTimer.current = null
      }

      setIsHolding(false)

      // If was dragging, save position
      if (isTouchDragging.current && dragPos) {
        moveBlock(block.id, dragPos.x, dragPos.y)
        setDragPos(null)
        setIsDragging(false)
      }

      isTouchDragging.current = false
      touchStartPos.current = null
    },
    [block.id, dragPos, moveBlock]
  )

  // Render block content based on type
  const renderContent = () => {
    if (isTextBlock(block)) {
      return (
        <TextBlockRenderer
          block={block}
          isEditing={isAdmin && isSelected && isEditing}
          onContentChange={handleContentChange}
          onEditComplete={() => setIsEditing(false)}
        />
      )
    }
    return null
  }

  // Use drag position if dragging, otherwise use block position
  const displayX = dragPos?.x ?? block.x
  const displayY = dragPos?.y ?? block.y
  // Use resize width if resizing, otherwise use block width
  const displayWidth = resizeWidth?.width ?? block.width

  const isInteracting = isDragging || isResizing || isHolding

  // Convert y from canvasHeightPercent-relative to 100%-relative for CSS
  // y is stored as percentage of canvasHeightPercent (e.g., y=50 means 50% of canvasHeightPercent)
  // CSS top needs to be percentage of actual element height
  const displayTopPercent = (displayY / canvasHeightPercent) * 100

  const blockStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${displayX}%`,
    top: `${displayTopPercent}%`,
    width: displayWidth > 0 ? `${displayWidth}%` : 'auto',
    minWidth: '80px',
    zIndex: block.zIndex,
    transition: isInteracting ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out, width 0.15s ease-out',
    opacity: isInteracting ? 0.9 : 1,
    padding: '8px 12px',
  }

  return (
    <div
      ref={blockRef}
      style={blockStyle}
      className={`
        ${isAdmin ? 'cursor-move' : ''}
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-transparent' : ''}
        ${isInSelection && !isSelected ? 'ring-2 ring-indigo-400/50 ring-offset-1 ring-offset-transparent' : ''}
        ${isInteracting ? 'shadow-lg shadow-indigo-500/30' : ''}
        ${isHolding ? 'animate-pulse scale-105' : ''}
        touch-none
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      tabIndex={user ? 0 : -1}
    >
      {renderContent()}

      {/* Resize handles (admin only, selected) */}
      {isAdmin && isSelected && !isEditing && (
        <>
          <div
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-500 cursor-se-resize rounded-sm"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />
          <div
            className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-500 cursor-sw-resize rounded-sm"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div
            className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 cursor-ne-resize rounded-sm"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div
            className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-500 cursor-nw-resize rounded-sm"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
        </>
      )}
    </div>
  )
}
