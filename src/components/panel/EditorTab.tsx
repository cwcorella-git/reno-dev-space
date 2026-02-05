'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { isTextBlock, TextBlock, TEXT_COLORS } from '@/types/canvas'
import { filterEditableBlocks } from '@/lib/permissions'
import {
  getSelectedBlockElement,
  wrapSelectionWithTag,
  wrapSelectionWithStyle,
  wrapSelectionWithLink,
} from '@/lib/selectionFormat'
import { sanitizeHtml } from '@/lib/sanitize'
import { EditableText } from '@/components/EditableText'
import { useContent } from '@/contexts/ContentContext'
import { checkDOMOverlap, estimateRectAfterFontSizeChange } from '@/lib/overlapDetection'

// Fonts loaded via Next.js Google Fonts (see layout.tsx)
// Using CSS variable names that resolve to the actual font-family
const FONTS = [
  { value: 'var(--font-inter)', label: 'Inter' },
  { value: 'var(--font-jetbrains-mono)', label: 'JetBrains' },
  { value: 'var(--font-space-grotesk)', label: 'Space' },
  { value: 'var(--font-exo-2)', label: 'Exo' },
  { value: 'var(--font-orbitron)', label: 'Orbitron' },
  { value: 'var(--font-quicksand)', label: 'Quicksand' },
  { value: 'var(--font-playfair)', label: 'Playfair' },
  { value: 'var(--font-lora)', label: 'Lora' },
  { value: 'var(--font-oswald)', label: 'Oswald' },
  { value: 'var(--font-anton)', label: 'Anton' },
  { value: 'var(--font-bebas-neue)', label: 'Bebas' },
  { value: 'var(--font-caveat)', label: 'Caveat' },
]

export function EditorTab() {
  const { user, isAdmin } = useAuth()
  const { getText } = useContent()
  const {
    blocks,
    selectedBlockId,
    selectedBlockIds,
    updateStyle,
    updateContent,
    removeBlock,
  } = useCanvas()
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  // Get selected block info first (needed for callbacks)
  const selectedBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) : null
  const isText = selectedBlock ? isTextBlock(selectedBlock) : false
  const textBlock = isText ? (selectedBlock as TextBlock) : null

  // Local state for font size input to allow clearing while typing
  const [fontSizeInput, setFontSizeInput] = useState(textBlock?.style.fontSize?.toString() || '1')

  // Sync local state when block changes
  const currentFontSize = textBlock?.style.fontSize
  useEffect(() => {
    if (currentFontSize !== undefined) {
      setFontSizeInput(currentFontSize.toString())
    }
  }, [currentFontSize, selectedBlockId])

  // Get editable block IDs
  const editableBlockIds = filterEditableBlocks(
    selectedBlockIds,
    blocks,
    user?.uid,
    isAdmin
  )
  const editableTextBlockIds = editableBlockIds.filter(id => {
    const b = blocks.find(x => x.id === id)
    return b && isTextBlock(b)
  })

  // Apply style to all selected editable text blocks
  const applyStyle = useCallback(
    (style: Partial<TextBlock['style']>) => {
      editableTextBlockIds.forEach(id => updateStyle(id, style))
    },
    [editableTextBlockIds, updateStyle]
  )

  // Check if increasing font size would cause any selected block to overlap
  const wouldFontSizeOverlap = useCallback(
    (newFontSize: number): boolean => {
      return editableTextBlockIds.some(id => {
        const b = blocks.find(x => x.id === id)
        if (!b || !isTextBlock(b)) return false
        const tb = b as TextBlock
        const oldFontSize = tb.style.fontSize ?? 1
        // Only check when increasing — shrinking can't create new overlaps
        if (newFontSize <= oldFontSize) return false

        const blockEl = document.querySelector<HTMLElement>(`[data-block-id="${id}"]`)
        if (!blockEl) return false

        const estimatedRect = estimateRectAfterFontSizeChange(
          blockEl, oldFontSize, newFontSize, b.width
        )
        return checkDOMOverlap(id, estimatedRect)
      })
    },
    [editableTextBlockIds, blocks]
  )

  // Apply inline formatting with tag (b, i, u) to selection, or fall back to block style
  const applyInlineTag = useCallback(
    (tag: 'b' | 'i' | 'u', blockStyleKey: keyof TextBlock['style'], activeValue: string, normalValue: string) => {
      const container = getSelectedBlockElement()
      if (container && wrapSelectionWithTag(tag, container)) {
        // Inline formatting applied
        return true
      }
      // No selection, apply block-level style
      const currentValue = textBlock?.style[blockStyleKey]
      applyStyle({ [blockStyleKey]: currentValue === activeValue ? normalValue : activeValue })
      return false
    },
    [applyStyle, textBlock]
  )

  // Apply inline color to selection, or fall back to block style
  const applyInlineColor = useCallback(
    (color: string) => {
      const container = getSelectedBlockElement()
      if (container && wrapSelectionWithStyle({ color }, container)) {
        return true
      }
      applyStyle({ color })
      return false
    },
    [applyStyle]
  )

  // Apply link to selection
  // prompt() destroys the selection and triggers blur, so we save the Range
  // beforehand, restore it after, apply the link, then manually persist.
  const applyLink = useCallback(() => {
    const container = getSelectedBlockElement()
    if (!container) {
      alert(getText('editor.alert.selectText', 'Select some text first'))
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      alert(getText('editor.alert.selectText', 'Select some text first'))
      return
    }

    // Save the range before prompt() steals focus and destroys it
    const savedRange = selection.getRangeAt(0).cloneRange()

    const url = prompt(getText('editor.prompt.enterUrl', 'Enter URL:'))
    if (!url) return

    // Restore the selection (DOM still exists due to React batching)
    try {
      selection.removeAllRanges()
      selection.addRange(savedRange)
    } catch {
      return
    }

    // Apply the link to the restored selection
    if (!wrapSelectionWithLink(url, container)) return

    // Persist: blur already saved old content, overwrite with linked version
    const blockEl = container.closest('[data-block-id]')
    const blockId = blockEl?.getAttribute('data-block-id')
    if (blockId) {
      updateContent(blockId, sanitizeHtml(container.innerHTML))
    }
  }, [getText, updateContent])

  // Close color picker on click outside
  useEffect(() => {
    if (!showColorPicker) return
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColorPicker])

  // Handle delete
  const handleDelete = useCallback(() => {
    editableBlockIds.forEach(id => removeBlock(id))
  }, [editableBlockIds, removeBlock])

  // No block selected
  if (!selectedBlockId || !selectedBlock) {
    return (
      <div className="px-4 py-6 text-center text-gray-500 text-sm">
        <EditableText id="editor.hint.select" defaultValue="Select a text block to edit" category="editor" />
      </div>
    )
  }

  // Can't edit this block
  const canEdit = isAdmin || (user && selectedBlock.createdBy === user.uid)
  if (!canEdit) {
    return (
      <div className="px-4 py-6 text-center text-gray-500 text-sm">
        <EditableText id="editor.hint.ownBlocks" defaultValue="You can only edit your own blocks" category="editor" />
      </div>
    )
  }

  if (!isText || !textBlock) {
    return (
      <div className="px-4 py-4 text-center text-gray-500 text-sm">
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 bg-red-600/50 hover:bg-red-600 rounded text-white text-sm"
        >
          <EditableText id="editor.button.delete" defaultValue="Delete Block" category="editor" />
        </button>
      </div>
    )
  }

  const hasMultiple = selectedBlockIds.length > 1

  return (
    <div className="px-3 py-2">
      {/* Selection count */}
      {hasMultiple && (
        <div className="text-xs text-gray-400 mb-2">
          {selectedBlockIds.length} selected
          {editableTextBlockIds.length < selectedBlockIds.length && (
            <span className="text-gray-500"> ({editableTextBlockIds.length} editable)</span>
          )}
        </div>
      )}

      {/* Single responsive row with flex-wrap */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        {/* Font + Size group */}
        <div className="flex items-center gap-1.5">
          <select
            value={textBlock.style.fontFamily || 'Inter'}
            onChange={(e) => applyStyle({ fontFamily: e.target.value })}
            className="h-7 px-1.5 bg-white/10 border border-white/20 rounded text-sm w-[5.5rem] sm:w-[6.5rem]"
          >
            {FONTS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            step="0.25"
            min="0.5"
            max="8"
            value={fontSizeInput}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              if (!isNaN(val) && val >= 0.5 && val <= 8) {
                if (wouldFontSizeOverlap(val)) {
                  // Revert — would overlap another block
                  return
                }
                setFontSizeInput(e.target.value)
                applyStyle({ fontSize: val })
              } else {
                setFontSizeInput(e.target.value)
              }
            }}
            onBlur={() => {
              const val = parseFloat(fontSizeInput)
              if (isNaN(val) || val < 0.5) {
                if (!wouldFontSizeOverlap(0.5)) {
                  setFontSizeInput('0.5')
                  applyStyle({ fontSize: 0.5 })
                }
              } else if (val > 8) {
                if (!wouldFontSizeOverlap(8)) {
                  setFontSizeInput('8')
                  applyStyle({ fontSize: 8 })
                } else {
                  setFontSizeInput((textBlock?.style.fontSize ?? 1).toString())
                }
              }
            }}
            className="w-10 h-7 px-1 bg-white/10 border border-white/20 rounded text-sm text-center"
          />
        </div>

        <div className="w-px h-6 bg-white/20 hidden sm:block" />

        {/* B I U S - use onMouseDown to preserve text selection */}
        <div className="flex gap-0.5">
          <button
            onMouseDown={(e) => {
              e.preventDefault() // Prevent losing selection
              applyInlineTag('b', 'fontWeight', 'bold', 'normal')
            }}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm font-bold ${
              textBlock.style.fontWeight === 'bold' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            B
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              applyInlineTag('i', 'fontStyle', 'italic', 'normal')
            }}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm italic ${
              textBlock.style.fontStyle === 'italic' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            I
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              applyInlineTag('u', 'textDecoration', 'underline', 'none')
            }}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm underline ${
              textBlock.style.textDecoration === 'underline' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            U
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              // Strikethrough uses <s> tag but we'll use style for consistency
              const container = getSelectedBlockElement()
              if (container && wrapSelectionWithStyle({ 'text-decoration': 'line-through' }, container)) {
                return
              }
              applyStyle({ textDecoration: textBlock.style.textDecoration === 'line-through' ? 'none' : 'line-through' })
            }}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm line-through ${
              textBlock.style.textDecoration === 'line-through' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            S
          </button>
        </div>

        <div className="w-px h-6 bg-white/20 hidden sm:block" />

        {/* Link */}
        <button
          onMouseDown={(e) => {
            e.preventDefault()
            applyLink()
          }}
          className="w-7 h-7 rounded flex items-center justify-center bg-white/10 hover:bg-white/20"
          title="Add link"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>

        <div className="w-px h-6 bg-white/20 hidden sm:block" />

        {/* Alignment */}
        <div className="flex border border-white/20 rounded overflow-hidden">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              onClick={() => applyStyle({ textAlign: align })}
              className={`w-7 h-7 flex items-center justify-center ${
                textBlock.style.textAlign === align ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {align === 'left' && <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />}
                {align === 'center' && <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />}
                {align === 'right' && <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />}
              </svg>
            </button>
          ))}
        </div>

        {/* Color swatch picker */}
        <div className="relative" ref={colorPickerRef}>
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              setShowColorPicker(!showColorPicker)
            }}
            className="w-7 h-7 rounded flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/20 relative"
            title="Text color"
          >
            <div
              className="w-4 h-4 rounded-full border border-white/30"
              style={{ backgroundColor: textBlock.style.color || '#ffffff' }}
            />
          </button>
          {showColorPicker && (
            <div className="absolute bottom-full mb-1 right-0 bg-gray-900 border border-white/20 rounded-lg p-1.5 shadow-xl z-50">
              <div className="flex gap-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      applyInlineColor(color)
                      setShowColorPicker(false)
                    }}
                    className={`w-6 h-6 rounded-full border-2 shrink-0 transition-transform ${
                      textBlock.style.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
