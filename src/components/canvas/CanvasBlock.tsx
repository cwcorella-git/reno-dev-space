'use client'

import { useCallback, useRef } from 'react'
import { CanvasBlock as CanvasBlockType, isTextBlock, isVoteBlock } from '@/types/canvas'
import { TextBlockRenderer } from './TextBlockRenderer'
import { VoteBlockRenderer } from './VoteBlockRenderer'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { useDragResize } from '@/hooks/useDragResize'

interface CanvasBlockProps {
  block: CanvasBlockType
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

  const { handleDragStart, handleResizeStart } = useDragResize({
    canvasRef,
    enabled: isAdmin && isSelected && !isEditing,
    onDragEnd: (pos) => moveBlock(block.id, pos.x, pos.y),
    onResizeEnd: (size) => resizeBlock(block.id, size.width, size.height),
  })

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

  const blockStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${block.x}%`,
    top: `${block.y}%`,
    width: block.width > 0 ? `${block.width}%` : 'auto',
    minWidth: '50px',
    minHeight: '30px',
    zIndex: block.zIndex,
  }

  return (
    <div
      ref={blockRef}
      style={blockStyle}
      className={`
        ${isAdmin ? 'cursor-move' : ''}
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-transparent' : ''}
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => {
        if (isAdmin && isSelected && !isEditing) {
          handleDragStart(e, block.x, block.y)
        }
      }}
      tabIndex={isAdmin ? 0 : -1}
    >
      {renderContent()}

      {/* Resize handles (admin only, selected) */}
      {isAdmin && isSelected && !isEditing && (
        <>
          <div
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-500 cursor-se-resize rounded-sm"
            onMouseDown={(e) =>
              handleResizeStart(e, 'se', block.x, block.y, block.width, block.height)
            }
          />
          <div
            className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-500 cursor-sw-resize rounded-sm"
            onMouseDown={(e) =>
              handleResizeStart(e, 'sw', block.x, block.y, block.width, block.height)
            }
          />
          <div
            className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 cursor-ne-resize rounded-sm"
            onMouseDown={(e) =>
              handleResizeStart(e, 'ne', block.x, block.y, block.width, block.height)
            }
          />
          <div
            className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-500 cursor-nw-resize rounded-sm"
            onMouseDown={(e) =>
              handleResizeStart(e, 'nw', block.x, block.y, block.width, block.height)
            }
          />
        </>
      )}
    </div>
  )
}
