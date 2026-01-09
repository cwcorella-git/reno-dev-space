'use client'

import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { isTextBlock, TextBlock, TEXT_COLORS } from '@/types/canvas'

// Font size presets for quick selection
const FONT_SIZE_PRESETS = [1, 1.5, 2, 3]

// Available fonts
const FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Comic Sans MS', label: 'Comic' },
  { value: 'Impact', label: 'Impact' },
]

export function BlockToolbar() {
  const { user, isAdmin } = useAuth()
  const {
    blocks,
    selectedBlockId,
    updateStyle,
    removeBlock,
    bringBlockToFront,
    sendBlockToBack,
  } = useCanvas()

  if (!selectedBlockId) return null

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  if (!selectedBlock) return null

  const isText = isTextBlock(selectedBlock)
  const textBlock = isText ? (selectedBlock as TextBlock) : null

  // Check if user can edit this block (creator or admin)
  const canEdit = isAdmin || (user && textBlock?.createdBy === user.uid)

  // Common button class for consistent height
  const btnClass = 'h-8 px-2 rounded flex items-center justify-center'

  // Only show toolbar if user can edit this block
  if (!canEdit) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 bg-gray-900 border border-white/10 rounded-xl p-2 shadow-xl max-w-[95vw]">
      {/* Text-specific controls */}
      {isText && textBlock && (
        <>
          {/* Font family */}
          <select
            value={textBlock.style.fontFamily || 'Inter'}
            onChange={(e) => updateStyle(selectedBlockId, { fontFamily: e.target.value })}
            className={`${btnClass} bg-white/10 border border-white/20 text-sm min-w-[80px]`}
          >
            {FONTS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>

          {/* Font size */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.25"
              min="0.5"
              max="8"
              value={textBlock.style.fontSize}
              onChange={(e) => updateStyle(selectedBlockId, { fontSize: parseFloat(e.target.value) || 1 })}
              className="w-14 h-8 px-2 bg-white/10 border border-white/20 rounded text-sm text-center"
            />
            <span className="text-xs text-gray-400">rem</span>
          </div>
          {/* Font size presets */}
          <div className="flex gap-0.5">
            {FONT_SIZE_PRESETS.map((size) => (
              <button
                key={size}
                onClick={() => updateStyle(selectedBlockId, { fontSize: size })}
                className={`w-7 h-7 text-xs rounded ${
                  textBlock.style.fontSize === size
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-gray-300'
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Bold toggle */}
          <button
            onClick={() =>
              updateStyle(selectedBlockId, {
                fontWeight: textBlock.style.fontWeight === 'bold' ? 'normal' : 'bold',
              })
            }
            className={`${btnClass} w-8 ${
              textBlock.style.fontWeight === 'bold' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
            title="Bold"
          >
            <span className="font-bold text-sm">B</span>
          </button>

          {/* Italic toggle */}
          <button
            onClick={() =>
              updateStyle(selectedBlockId, {
                fontStyle: textBlock.style.fontStyle === 'italic' ? 'normal' : 'italic',
              })
            }
            className={`${btnClass} w-8 ${
              textBlock.style.fontStyle === 'italic' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
            title="Italic"
          >
            <span className="italic text-sm">I</span>
          </button>

          {/* Underline toggle */}
          <button
            onClick={() =>
              updateStyle(selectedBlockId, {
                textDecoration: textBlock.style.textDecoration === 'underline' ? 'none' : 'underline',
              })
            }
            className={`${btnClass} w-8 ${
              textBlock.style.textDecoration === 'underline' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
            title="Underline"
          >
            <span className="underline text-sm">U</span>
          </button>

          {/* Strikethrough toggle */}
          <button
            onClick={() =>
              updateStyle(selectedBlockId, {
                textDecoration: textBlock.style.textDecoration === 'line-through' ? 'none' : 'line-through',
              })
            }
            className={`${btnClass} w-8 ${
              textBlock.style.textDecoration === 'line-through' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
            title="Strikethrough"
          >
            <span className="line-through text-sm">S</span>
          </button>

          {/* Text align */}
          <div className="flex border border-white/20 rounded overflow-hidden h-8">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => updateStyle(selectedBlockId, { textAlign: align })}
                className={`w-8 h-full flex items-center justify-center ${
                  textBlock.style.textAlign === align ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {align === 'left' && (
                    <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
                  )}
                  {align === 'center' && (
                    <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
                  )}
                  {align === 'right' && (
                    <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
                  )}
                </svg>
              </button>
            ))}
          </div>

          {/* Color picker */}
          <div className="flex gap-1 items-center">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => updateStyle(selectedBlockId, { color })}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  textBlock.style.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-white/20 mx-1" />

          {/* Marquee toggle */}
          <button
            onClick={() => updateStyle(selectedBlockId, { marquee: !textBlock.style.marquee })}
            className={`${btnClass} px-3 text-sm font-medium whitespace-nowrap ${
              textBlock.style.marquee
                ? 'bg-indigo-600 text-white'
                : 'bg-white/10 hover:bg-white/20 text-gray-300'
            }`}
            title={textBlock.style.marquee ? 'Stop scrolling' : 'Scroll text'}
          >
            Marquee
          </button>

          <div className="w-px h-6 bg-white/20 mx-1" />
        </>
      )}

      {/* Z-index controls */}
      <button
        onClick={() => bringBlockToFront(selectedBlockId)}
        className={`${btnClass} w-8 bg-white/10 hover:bg-white/20`}
        title="Bring to front"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <button
        onClick={() => sendBlockToBack(selectedBlockId)}
        className={`${btnClass} w-8 bg-white/10 hover:bg-white/20`}
        title="Send to back"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className="w-px h-6 bg-white/20 mx-1" />

      {/* Delete */}
      <button
        onClick={() => removeBlock(selectedBlockId)}
        className={`${btnClass} w-8 bg-red-600/50 hover:bg-red-600`}
        title="Delete"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  )
}
