'use client'

import { useRef, useEffect } from 'react'
import { TextBlock } from '@/types/canvas'

const PLACEHOLDER_TEXT = 'Click to edit'

interface TextBlockRendererProps {
  block: TextBlock
  isEditing: boolean
  onContentChange?: (content: string) => void
  onEditComplete?: () => void
}

export function TextBlockRenderer({
  block,
  isEditing,
  onContentChange,
  onEditComplete,
}: TextBlockRendererProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isEmpty = !block.content || block.content.trim() === ''

  const style = {
    fontSize: `${block.style.fontSize}rem`,
    fontWeight: block.style.fontWeight,
    color: block.style.color,
    textAlign: block.style.textAlign as 'left' | 'center' | 'right',
    backgroundColor: block.style.backgroundColor || 'transparent',
  }

  // Focus and select all when entering edit mode
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus()
      // Select all text if there's content
      if (block.content) {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(editorRef.current)
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    }
  }, [isEditing, block.content])

  if (isEditing) {
    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="w-full h-full outline-none min-h-[1.5em] whitespace-pre-wrap break-words"
        style={style}
        onBlur={(e) => {
          const newContent = e.currentTarget.textContent || ''
          onContentChange?.(newContent.trim())
          onEditComplete?.()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.currentTarget.blur()
          }
        }}
      >
        {block.content}
      </div>
    )
  }

  // Show placeholder if empty
  if (isEmpty) {
    return (
      <div
        className="w-full h-full whitespace-pre-wrap break-words opacity-40 italic"
        style={style}
      >
        {PLACEHOLDER_TEXT}
      </div>
    )
  }

  return (
    <div
      className="w-full h-full whitespace-pre-wrap break-words"
      style={style}
    >
      {block.content}
    </div>
  )
}
