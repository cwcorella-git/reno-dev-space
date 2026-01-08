'use client'

import { useCallback, useRef, useState } from 'react'
import { CanvasBlock as CanvasBlockType, isTextBlock } from '@/types/canvas'
import { TextBlockRenderer } from './TextBlockRenderer'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'

interface CanvasBlockProps {
  block: CanvasBlockType
}

interface DragState {
  x: number
  y: number
}

interface ResizeState {
  width: number
}

export function CanvasBlock({ block }: CanvasBlockProps) {
  const { user, isAdmin } = useAuth()
  const {
    selectedBlockId,
    selectedBlockIds,
    isEditing,
    canvasRef,
    selectBlock,
    setIsEditing,
    moveBlock,
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

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      // Anyone can select a block (for voting focus)
      // Admin can also edit/drag after selecting
      if (user) {
        selectBlock(block.id)
      }
    },
    [user, selectBlock, block.id]
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
      if (!isSelected) return

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

      // Admin-only actions
      if (!isAdmin) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isEditing) {
          e.preventDefault()
          removeBlock(block.id)
        }
      }
      if (e.key === 'Escape') {
        selectBlock(null)
      }
    },
    [isAdmin, isSelected, isEditing, removeBlock, block.id, selectBlock, user, vote]
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

      setIsDragging(true)
      setDragPos({ x: block.x, y: block.y })

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
        const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100

        const newX = Math.max(0, Math.min(95, startBlockX + deltaX))
        const newY = Math.max(0, Math.min(95, startBlockY + deltaY))

        setDragPos({ x: newX, y: newY })
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        setIsDragging(false)

        // Save final position to Firestore
        if (dragPos) {
          // Use the latest position from the ref pattern
        }
        // Get current drag position from state
        setDragPos((currentPos) => {
          if (currentPos && (currentPos.x !== block.x || currentPos.y !== block.y)) {
            moveBlock(block.id, currentPos.x, currentPos.y)
          }
          return null
        })
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [isAdmin, isSelected, isEditing, canvasRef, block, moveBlock, dragPos]
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

  const isInteracting = isDragging || isResizing

  const blockStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${displayX}%`,
    top: `${displayY}%`,
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
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
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
