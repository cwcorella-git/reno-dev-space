'use client'

import { useRef, useEffect } from 'react'
import { TextBlock, DEFAULT_BRIGHTNESS } from '@/types/canvas'
import { sanitizeHtml } from '@/lib/sanitize'
import { wrapSelectionWithTag } from '@/lib/selectionFormat'
import { getVoteEffects, getUpvoteCount } from '@/lib/voteEffects'

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
  // Check if empty (strip HTML tags to check for actual text content)
  const textContent = block.content?.replace(/<[^>]*>/g, '').trim() || ''
  const isEmpty = !textContent

  // Calculate opacity from brightness (0-100 -> 0.2-1.0)
  const brightness = block.brightness ?? DEFAULT_BRIGHTNESS
  const opacity = 0.2 + (brightness / 100) * 0.8

  // Map legacy font names and old CSS variables to new ones for backwards compatibility
  const getFontFamily = (font: string | undefined): string => {
    if (!font) return 'var(--font-inter)'

    // Map old CSS variable names to new ones
    const variableMap: Record<string, string> = {
      'var(--font-roboto-mono)': 'var(--font-jetbrains-mono)',
      'var(--font-press-start)': 'var(--font-exo-2)',
      'var(--font-pixelify-sans)': 'var(--font-exo-2)',
      'var(--font-silkscreen)': 'var(--font-exo-2)',
      'var(--font-vt323)': 'var(--font-jetbrains-mono)',
      'var(--font-russo-one)': 'var(--font-oswald)',
      'var(--font-bangers)': 'var(--font-anton)',
      'var(--font-permanent-marker)': 'var(--font-caveat)',
      'var(--font-creepster)': 'var(--font-playfair)',
    }
    if (font.startsWith('var(')) {
      return variableMap[font] || font
    }

    // Legacy system font name mapping
    const legacyMap: Record<string, string> = {
      'Inter': 'var(--font-inter)',
      'Monaco': 'var(--font-jetbrains-mono)',
      'Courier New': 'var(--font-jetbrains-mono)',
      'Georgia': 'var(--font-lora)',
      'Comic Sans MS': 'var(--font-quicksand)',
      'Impact': 'var(--font-bebas-neue)',
      'Times New Roman': 'var(--font-playfair)',
      'Arial Black': 'var(--font-anton)',
      'Trebuchet MS': 'var(--font-space-grotesk)',
      'Verdana': 'var(--font-inter)',
      'Palatino': 'var(--font-lora)',
      'Garamond': 'var(--font-playfair)',
    }
    return legacyMap[font] || 'var(--font-inter)'
  }

  // Vote-driven text effects (glow, shimmer, etc.)
  const upvotes = getUpvoteCount(block)
  const voteEffects = getVoteEffects(upvotes, block.style.color)

  const style = {
    fontSize: `${block.style.fontSize}rem`,
    fontWeight: block.style.fontWeight,
    fontStyle: block.style.fontStyle || 'normal',
    textDecoration: block.style.textDecoration || 'none',
    fontFamily: getFontFamily(block.style.fontFamily),
    color: block.style.color,
    textAlign: block.style.textAlign as 'left' | 'center' | 'right',
    backgroundColor: block.style.backgroundColor || 'transparent',
    opacity,
    ...voteEffects.style,
  }

  // Focus and set initial content when entering edit mode
  useEffect(() => {
    if (isEditing && editorRef.current) {
      // Set innerHTML to preserve any existing formatting
      editorRef.current.innerHTML = block.content || ''
      editorRef.current.focus()
      // Move cursor to end
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(editorRef.current)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
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
          // Get innerHTML and sanitize to keep only safe formatting
          const rawHtml = e.currentTarget.innerHTML || ''
          const newContent = sanitizeHtml(rawHtml)
          onContentChange?.(newContent)
          onEditComplete?.()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.currentTarget.blur()
            return
          }

          // Ctrl/Cmd + B/I/U for formatting
          if (e.ctrlKey || e.metaKey) {
            const key = e.key.toLowerCase()
            if (key === 'b' || key === 'i' || key === 'u') {
              e.preventDefault()
              wrapSelectionWithTag(key, editorRef.current)
            }
          }
        }}
      />
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
    <div
      className={`whitespace-pre-wrap break-words ${voteEffects.className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  )
}
