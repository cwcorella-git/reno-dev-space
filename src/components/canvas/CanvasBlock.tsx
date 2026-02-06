'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { CanvasBlock as CanvasBlockType, isTextBlock } from '@/types/canvas'
import { TextBlockRenderer } from './TextBlockRenderer'
import { CelebrationOverlay } from './CelebrationOverlay'
import { useCanvas, DESIGN_HEIGHT } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { filterEditableBlocks } from '@/lib/permissions'
import { wouldBlockOverlap, checkDOMOverlap } from '@/lib/overlapDetection'

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
    isGroupDragging,
    canvasRef,
    selectBlock,
    selectBlocks,
    setIsEditing,
    setIsGroupDragging,
    moveBlock,
    moveBlocks,
    resizeBlock,
    updateContent,
    removeBlock,
    vote,
    celebratingBlockId,
    celebratingEffect,
    clearCelebration,
    report,
    dismissReport,
    recordHistory,
  } = useCanvas()

  const isSelected = selectedBlockId === block.id
  const isInSelection = selectedBlockIds.includes(block.id)
  const blockRef = useRef<HTMLDivElement>(null)

  // Local drag state for immediate visual feedback
  const [dragPos, setDragPos] = useState<DragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isOverlapping, setIsOverlapping] = useState(false)
  // Track the position we're waiting for Firestore to confirm
  const pendingPosRef = useRef<DragState | null>(null)

  // Clear dragPos when Firestore confirms the new position (prevents jitter)
  useEffect(() => {
    if (pendingPosRef.current && !isDragging) {
      const tolerance = 0.01 // Small tolerance for floating point comparison
      const xMatches = Math.abs(block.x - pendingPosRef.current.x) < tolerance
      const yMatches = Math.abs(block.y - pendingPosRef.current.y) < tolerance
      if (xMatches && yMatches) {
        // Firestore has confirmed the position, safe to clear local state
        pendingPosRef.current = null
        setDragPos(null)
      }
    }
  }, [block.x, block.y, isDragging])

  // Local resize state for immediate visual feedback
  const [resizeWidth, setResizeWidth] = useState<ResizeState | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [isResizeOverlapping, setIsResizeOverlapping] = useState(false)

  // Touch-and-hold state
  const [isHolding, setIsHolding] = useState(false)
  const touchHoldTimer = useRef<NodeJS.Timeout | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const touchStartBlockPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const isTouchDragging = useRef(false)

  // Check overlap during resize (runs after DOM re-renders with new width)
  useEffect(() => {
    if (!isResizing || !blockRef.current) {
      setIsResizeOverlapping(false)
      return
    }
    const overlaps = checkDOMOverlap(block.id)
    setIsResizeOverlapping(overlaps)
  }, [resizeWidth, isResizing, block.id])

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

      if (e.key === 'Escape') {
        selectBlock(null)
      }
    },
    [isSelected, isInSelection, isEditing, selectBlock, user, vote, block.id]
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
      setIsOverlapping(false)

      // Signal group dragging when multiple blocks selected
      if (movableBlockIds.length > 1) {
        setIsGroupDragging(true)
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // x is percentage of width (0-100)
        // y is percentage of canvasHeightPercent (which may be > 100)
        const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
        const deltaY = ((moveEvent.clientY - startY) / rect.height) * canvasHeightPercent

        // Allow X to overflow past edges by threshold amounts
        const newX = Math.max(-OVERFLOW_LEFT, Math.min(100 + OVERFLOW_RIGHT - 5, startBlockX + deltaX))
        // Allow y to go up to canvasHeightPercent - 5 (leaving some margin)
        const newY = Math.max(0, Math.min(canvasHeightPercent - 5, startBlockY + deltaY))

        // Check if this position would overlap other blocks
        const overlaps = wouldBlockOverlap(block.id, newX, newY, block.width || 12, blocks)
        setIsOverlapping(overlaps)

        setDragPos({ x: newX, y: newY })
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        setIsDragging(false)
        setIsGroupDragging(false)
        setIsOverlapping(false)

        // Get current drag position and calculate delta
        setDragPos((currentPos) => {
          if (currentPos && (currentPos.x !== block.x || currentPos.y !== block.y)) {
            // Check for overlap before saving
            const overlaps = wouldBlockOverlap(block.id, currentPos.x, currentPos.y, block.width || 12, blocks)

            if (overlaps) {
              // Don't save - position will revert when dragPos is cleared
              return null
            }

            const deltaX = currentPos.x - startBlockX
            const deltaY = currentPos.y - startBlockY

            // Record history before moving (captures before positions)
            recordHistory('move', movableBlockIds)

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

            // Keep dragPos until Firestore confirms (prevents jitter)
            pendingPosRef.current = { x: currentPos.x, y: currentPos.y }
            return currentPos
          }
          return null
        })
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [isAdmin, isSelected, isEditing, canvasRef, block, moveBlock, moveBlocks, selectedBlockIds, blocks, user?.uid, canvasHeightPercent, setIsGroupDragging, recordHistory]
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

      // For auto-width blocks (width === 0), measure the actual DOM width
      // so the block doesn't snap to 'auto' at the start of resize
      const measuredWidth = block.width > 0
        ? block.width
        : blockRef.current
          ? (blockRef.current.getBoundingClientRect().width / rect.width) * 100
          : 10
      const startWidth = measuredWidth

      setIsResizing(true)
      setResizeWidth({ width: measuredWidth })

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

        // Save final width to Firestore (blocked if overlapping)
        setResizeWidth((currentWidth) => {
          if (currentWidth && currentWidth.width !== block.width) {
            const overlaps = checkDOMOverlap(block.id)
            if (overlaps) {
              // Revert — don't save to Firestore
              setIsResizeOverlapping(false)
              return null
            }
            recordHistory('resize', [block.id])
            resizeBlock(block.id, currentWidth.width, block.height)
          }
          setIsResizeOverlapping(false)
          return null
        })
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [isAdmin, isSelected, isEditing, canvasRef, block, resizeBlock, recordHistory]
  )

  // Touch move handler (document-level for smooth dragging)
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!touchStartPos.current || !isTouchDragging.current) return

      e.preventDefault() // Prevent scrolling while dragging

      const touch = e.touches[0]
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()

      // Calculate delta from original touch position (not updating reference)
      const deltaXPercent = ((touch.clientX - touchStartPos.current.x) / rect.width) * 100
      const deltaYPercent = ((touch.clientY - touchStartPos.current.y) / rect.height) * canvasHeightPercent

      // Apply delta to original block position
      const newX = Math.max(-OVERFLOW_LEFT, Math.min(100 + OVERFLOW_RIGHT - 5, touchStartBlockPos.current.x + deltaXPercent))
      const newY = Math.max(0, Math.min(canvasHeightPercent - 5, touchStartBlockPos.current.y + deltaYPercent))

      setDragPos({ x: newX, y: newY })
      setIsDragging(true)
    },
    [canvasRef, canvasHeightPercent]
  )

  // Touch end handler (document-level)
  const handleTouchEnd = useCallback(
    () => {
      // Remove document-level listeners
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)

      // Clear hold timer
      if (touchHoldTimer.current) {
        clearTimeout(touchHoldTimer.current)
        touchHoldTimer.current = null
      }

      setIsHolding(false)

      // If was dragging, save position
      if (isTouchDragging.current) {
        setDragPos((currentPos) => {
          if (currentPos) {
            recordHistory('move', [block.id])
            moveBlock(block.id, currentPos.x, currentPos.y)
            // Keep dragPos until Firestore confirms (prevents jitter)
            pendingPosRef.current = { x: currentPos.x, y: currentPos.y }
            return currentPos
          }
          return null
        })
        setIsDragging(false)
      }

      isTouchDragging.current = false
      touchStartPos.current = null
    },
    [block.id, moveBlock, handleTouchMove, recordHistory]
  )

  // Touch start - begin hold timer
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isAdmin || !isSelected || isEditing) return

      const touch = e.touches[0]
      touchStartPos.current = { x: touch.clientX, y: touch.clientY }
      touchStartBlockPos.current = { x: block.x, y: block.y }
      isTouchDragging.current = false

      // Start hold timer
      touchHoldTimer.current = setTimeout(() => {
        setIsHolding(true)
        isTouchDragging.current = true

        // Add document-level listeners for smooth dragging
        document.addEventListener('touchmove', handleTouchMove, { passive: false })
        document.addEventListener('touchend', handleTouchEnd)
        document.addEventListener('touchcancel', handleTouchEnd)

        // Vibrate if supported (haptic feedback)
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }, TOUCH_HOLD_DURATION)
    },
    [isAdmin, isSelected, isEditing, block.x, block.y, handleTouchMove, handleTouchEnd]
  )

  // Cancel hold if user moves too much before hold completes
  const handleTouchMoveBeforeHold = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartPos.current || isTouchDragging.current) return

      const touch = e.touches[0]
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x)
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y)

      // If moved too much before hold completed, cancel the hold
      if (deltaX > 10 || deltaY > 10) {
        if (touchHoldTimer.current) {
          clearTimeout(touchHoldTimer.current)
          touchHoldTimer.current = null
        }
        setIsHolding(false)
        touchStartPos.current = null
      }
    },
    []
  )

  // Cancel hold on touch end before hold completes
  const handleTouchEndBeforeHold = useCallback(
    () => {
      if (touchHoldTimer.current) {
        clearTimeout(touchHoldTimer.current)
        touchHoldTimer.current = null
      }
      setIsHolding(false)
      touchStartPos.current = null
    },
    []
  )

  // Clear touch hold timer and document listeners on unmount
  useEffect(() => {
    const moveHandler = handleTouchMove
    const endHandler = handleTouchEnd
    return () => {
      if (touchHoldTimer.current) {
        clearTimeout(touchHoldTimer.current)
      }
      // Clean up document-level listeners if component unmounts during drag
      document.removeEventListener('touchmove', moveHandler)
      document.removeEventListener('touchend', endHandler)
      document.removeEventListener('touchcancel', endHandler)
    }
  }, [handleTouchMove, handleTouchEnd])

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

  // Convert y to absolute pixels within the design canvas.
  // block.y is stored as percentage of canvasHeightPercent (100 = one DESIGN_HEIGHT).
  // Using pixels instead of percentages decouples block positions from canvas height,
  // so blocks never shift when the canvas grows or shrinks.
  const displayTopPx = (displayY / 100) * DESIGN_HEIGHT

  const blockStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${displayX}%`,
    top: `${displayTopPx}px`,
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
      data-block-id={block.id}
      style={blockStyle}
      className={`group
        ${isAdmin ? 'cursor-move' : ''}
        ${(isOverlapping || isResizeOverlapping)
          ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-transparent'
          : isSelected
            ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-transparent'
            : ''}
        ${isInSelection && !isSelected && !isOverlapping && !isResizeOverlapping
          ? isGroupDragging
            ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-transparent'
            : 'ring-2 ring-indigo-400/50 ring-offset-1 ring-offset-transparent'
          : ''}
        ${(isOverlapping || isResizeOverlapping) ? 'shadow-lg shadow-red-500/40' : (isInteracting || (isGroupDragging && isInSelection)) ? 'shadow-lg shadow-indigo-500/30' : ''}
        ${isHolding ? 'animate-pulse scale-105' : ''}
        touch-none
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMoveBeforeHold}
      onTouchEnd={handleTouchEndBeforeHold}
      tabIndex={user ? 0 : -1}
    >
      {renderContent()}

      {/* One-shot celebration overlay (visible only to voter) */}
      {celebratingBlockId === block.id && celebratingEffect && (
        <CelebrationOverlay
          effect={celebratingEffect}
          color={isTextBlock(block) ? block.style.color : '#818cf8'}
          onComplete={clearCelebration}
          showLabel={isAdmin}
        />
      )}

      {/* Vote arrows - right side, shown on hover for logged-in users */}
      {user && !isEditing && !isDragging && (
        <div
          className={`absolute -right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 transition-opacity z-10 ${
            isSelected || isInSelection ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const votedUp = block.votersUp?.includes(user.uid) ?? false
            const votedDown = block.votersDown?.includes(user.uid) ?? false
            const isLegacyVoter = (block.voters?.includes(user.uid) ?? false) && !votedUp && !votedDown
            const hasVoted = votedUp || votedDown || isLegacyVoter
            return (
              <>
                <button
                  className={`w-6 h-6 flex items-center justify-center transition-colors ${
                    votedUp ? 'text-green-400' : hasVoted ? 'opacity-30 text-gray-400' : 'text-gray-400 hover:text-green-400'
                  }`}
                  disabled={votedUp || isLegacyVoter}
                  onClick={(e) => { e.stopPropagation(); vote(block.id, 'up') }}
                  title={votedUp ? 'Voted' : votedDown ? 'Remove vote' : 'Brighten'}
                >
                  <svg className="w-3.5 h-3.5" fill={votedUp ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <span className="text-[9px] text-gray-500 font-mono leading-none">{block.brightness ?? 50}</span>
                <button
                  className={`w-6 h-6 flex items-center justify-center transition-colors ${
                    votedDown ? 'text-red-400' : hasVoted ? 'opacity-30 text-gray-400' : 'text-gray-400 hover:text-red-400'
                  }`}
                  disabled={votedDown || isLegacyVoter}
                  onClick={(e) => { e.stopPropagation(); vote(block.id, 'down') }}
                  title={votedDown ? 'Voted' : votedUp ? 'Remove vote' : 'Dim'}
                >
                  <svg className="w-3.5 h-3.5" fill={votedDown ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </>
            )
          })()}
        </div>
      )}

      {/* Report button - left side, shown on hover for logged-in users (not own blocks, not dismissed) */}
      {user && !isEditing && !isDragging && block.createdBy !== user.uid && !(block.dismissedReporters?.includes(user.uid)) && (
        <div
          className={`absolute -left-8 top-1/2 -translate-y-1/2 transition-opacity z-10 ${
            isSelected || isInSelection ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`w-6 h-6 flex items-center justify-center transition-colors ${
              block.reportedBy?.includes(user.uid)
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-gray-500 hover:text-amber-400'
            }`}
            onClick={(e) => { e.stopPropagation(); report(block.id) }}
            title={block.reportedBy?.includes(user.uid) ? 'Unreport' : 'Report'}
          >
            <svg className="w-4 h-4" fill={block.reportedBy?.includes(user.uid) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </button>
        </div>
      )}

      {/* Reported indicator - yellow border + dismiss button visible to admins */}
      {isAdmin && (block.reportedBy?.length ?? 0) > 0 && (
        <>
          <div className="absolute inset-0 border-2 border-amber-400/60 rounded pointer-events-none" />
          <button
            className={`absolute -left-8 bottom-1 w-6 h-6 flex items-center justify-center text-emerald-400 hover:text-emerald-300 transition-opacity z-10 ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            onClick={(e) => { e.stopPropagation(); dismissReport(block.id) }}
            onMouseDown={(e) => e.stopPropagation()}
            title={`Dismiss ${block.reportedBy?.length} report(s)`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </>
      )}

      {/* Overlap warning message */}
      {((isOverlapping && isDragging) || (isResizeOverlapping && isResizing)) && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg z-20">
          Can&apos;t place here – overlapping
        </div>
      )}

      {/* Delete button (own blocks always, admin only if reported) */}
      {isSelected && !isEditing && (
        (user && block.createdBy === user.uid) ||
        (isAdmin && (block.reportedBy?.length ?? 0) > 0)
      ) && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-md transition-colors z-10"
          onClick={(e) => {
            e.stopPropagation()
            removeBlock(block.id)
          }}
          title="Delete"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

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
