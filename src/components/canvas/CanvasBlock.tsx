'use client'

import { useCallback, useRef, useState } from 'react'
import { CanvasBlock as CanvasBlockType, isTextBlock, isVoteBlock } from '@/types/canvas'
import { TextBlockRenderer } from './TextBlockRenderer'
import { VoteBlockRenderer } from './VoteBlockRenderer'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'

interface CanvasBlockProps {
  block: CanvasBlockType
}

interface DragState {
  x: number
  y: number
}

export function CanvasBlock({ block }: CanvasBlockProps) {
  const { isAdmin } = useAuth()
  const {
    selectedBlockId,
    isEditing,
    canvasRef,
    selectBlock,
    setIsEditing,
    moveBlock,
    resizeBlock,
    updateContent,
    removeBlock,
  } = useCanvas()

  const isSelected = selectedBlockId === block.id
  const blockRef = useRef<HTMLDivElement>(null)

  // Local drag state for immediate visual feedback
  const [dragPos, setDragPos] = useState<DragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isAdmin) {
        selectBlock(block.id)
      }
    },
    [isAdmin, selectBlock, block.id]
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
      if (!isAdmin || !isSelected) return

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
    [isAdmin, isSelected, isEditing, removeBlock, block.id, selectBlock]
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
      if (!isAdmin || !isSelected || isEditing) return
      if (e.button !== 0) return // Only left click

      e.preventDefault()
      e.stopPropagation()

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

  // Handle resize
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

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
        let newWidth = startWidth

        if (handle.includes('e')) {
          newWidth = Math.max(5, startWidth + deltaX)
        }
        if (handle.includes('w')) {
          newWidth = Math.max(5, startWidth - deltaX)
        }

        // For now, just update width on mouse up
      }

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        const deltaX = ((upEvent.clientX - startX) / rect.width) * 100
        let newWidth = startWidth

        if (handle.includes('e')) {
          newWidth = Math.max(5, startWidth + deltaX)
        }
        if (handle.includes('w')) {
          newWidth = Math.max(5, startWidth - deltaX)
        }

        if (newWidth !== block.width) {
          resizeBlock(block.id, newWidth, block.height)
        }
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
    if (isVoteBlock(block)) {
      return <VoteBlockRenderer block={block} />
    }
    return null
  }

  // Use drag position if dragging, otherwise use block position
  const displayX = dragPos?.x ?? block.x
  const displayY = dragPos?.y ?? block.y

  const blockStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${displayX}%`,
    top: `${displayY}%`,
    width: block.width > 0 ? `${block.width}%` : 'auto',
    minWidth: '50px',
    minHeight: '30px',
    zIndex: block.zIndex,
    transition: isDragging ? 'none' : 'left 0.15s ease-out, top 0.15s ease-out',
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={blockRef}
      style={blockStyle}
      className={`
        ${isAdmin ? 'cursor-move' : ''}
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-transparent' : ''}
        ${isDragging ? 'shadow-lg shadow-indigo-500/30' : ''}
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      tabIndex={isAdmin ? 0 : -1}
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
