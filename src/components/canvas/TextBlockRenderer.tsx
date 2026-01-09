'use client'

import { useRef, useEffect } from 'react'
import { TextBlock, DEFAULT_BRIGHTNESS } from '@/types/canvas'

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

  // Calculate opacity from brightness (0-100 -> 0.2-1.0)
  const brightness = block.brightness ?? DEFAULT_BRIGHTNESS
  const opacity = 0.2 + (brightness / 100) * 0.8

  const style = {
    fontSize: `${block.style.fontSize}rem`,
    fontWeight: block.style.fontWeight,
    fontStyle: block.style.fontStyle || 'normal',
    textDecoration: block.style.textDecoration || 'none',
    fontFamily: block.style.fontFamily || 'Inter',
    color: block.style.color,
    textAlign: block.style.textAlign as 'left' | 'center' | 'right',
    backgroundColor: block.style.backgroundColor || 'transparent',
    opacity,
  }

  // Focus when entering edit mode (cursor positioned naturally by browser)
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus()
    }
  }, [isEditing])

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

  // Marquee wrapper for scrolling text effect
  const MarqueeWrapper = ({ children }: { children: React.ReactNode }) => {
    if (!block.style.marquee) return <>{children}</>
    return (
      <div className="overflow-hidden">
        <div className="animate-marquee whitespace-nowrap">
          {children}
        </div>
      </div>
    )
  }

  // Show placeholder if empty
  if (isEmpty) {
    return (
      <div
        className="whitespace-nowrap opacity-40 italic"
        style={style}
      >
        {PLACEHOLDER_TEXT}
      </div>
    )
  }

  return (
    <MarqueeWrapper>
      <div
        className="whitespace-pre-wrap break-words"
        style={style}
      >
        {block.content}
      </div>
    </MarqueeWrapper>
  )
}
