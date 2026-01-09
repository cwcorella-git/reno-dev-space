'use client'

import { useCallback } from 'react'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { isTextBlock, TextBlock, TEXT_COLORS } from '@/types/canvas'
import { filterEditableBlocks } from '@/lib/permissions'

const FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Comic Sans MS', label: 'Comic' },
  { value: 'Impact', label: 'Impact' },
]

export function EditorTab() {
  const { user, isAdmin } = useAuth()
  const {
    blocks,
    selectedBlockId,
    selectedBlockIds,
    updateStyle,
    removeBlock,
  } = useCanvas()

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

  // Handle delete
  const handleDelete = useCallback(() => {
    editableBlockIds.forEach(id => removeBlock(id))
  }, [editableBlockIds, removeBlock])

  // No block selected
  if (!selectedBlockId) {
    return (
      <div className="px-4 py-6 text-center text-gray-500 text-sm">
        Select a text block to edit
      </div>
    )
  }

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  if (!selectedBlock) return null

  const isText = isTextBlock(selectedBlock)
  const textBlock = isText ? (selectedBlock as TextBlock) : null

  // Can't edit this block
  const canEdit = isAdmin || (user && selectedBlock.createdBy === user.uid)
  if (!canEdit) {
    return (
      <div className="px-4 py-6 text-center text-gray-500 text-sm">
        You can only edit your own blocks
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
          Delete Block
        </button>
      </div>
    )
  }

  const hasMultiple = selectedBlockIds.length > 1

  return (
    <div className="space-y-2">
      {/* Selection count */}
      {hasMultiple && (
        <div className="px-3 pt-2 text-xs text-gray-400">
          {selectedBlockIds.length} selected
          {editableTextBlockIds.length < selectedBlockIds.length && (
            <span className="text-gray-500"> ({editableTextBlockIds.length} editable)</span>
          )}
        </div>
      )}

      {/* Row 1: Controls */}
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
        {/* Font dropdown + Size */}
        <select
          value={textBlock.style.fontFamily || 'Inter'}
          onChange={(e) => applyStyle({ fontFamily: e.target.value })}
          className="h-8 px-2 bg-white/10 border border-white/20 rounded text-sm w-24"
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
          value={textBlock.style.fontSize}
          onChange={(e) => applyStyle({ fontSize: parseFloat(e.target.value) || 1 })}
          className="w-14 h-8 px-2 bg-white/10 border border-white/20 rounded text-sm text-center"
        />

        <div className="w-px h-6 bg-white/20" />

        {/* B I U S */}
        <div className="flex gap-0.5">
          <button
            onClick={() => applyStyle({ fontWeight: textBlock.style.fontWeight === 'bold' ? 'normal' : 'bold' })}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm font-bold ${
              textBlock.style.fontWeight === 'bold' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            B
          </button>
          <button
            onClick={() => applyStyle({ fontStyle: textBlock.style.fontStyle === 'italic' ? 'normal' : 'italic' })}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm italic ${
              textBlock.style.fontStyle === 'italic' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            I
          </button>
          <button
            onClick={() => applyStyle({ textDecoration: textBlock.style.textDecoration === 'underline' ? 'none' : 'underline' })}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm underline ${
              textBlock.style.textDecoration === 'underline' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            U
          </button>
          <button
            onClick={() => applyStyle({ textDecoration: textBlock.style.textDecoration === 'line-through' ? 'none' : 'line-through' })}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm line-through ${
              textBlock.style.textDecoration === 'line-through' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            S
          </button>
        </div>

        <div className="w-px h-6 bg-white/20" />

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

        <div className="flex-1" />

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-7 h-7 rounded flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-white/10"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Row 2: Color swatches */}
      <div className="flex gap-1 px-3 pb-2 flex-wrap">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => applyStyle({ color })}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${
              textBlock.style.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}
