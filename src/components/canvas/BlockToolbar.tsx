'use client'

import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { isTextBlock, TextBlock } from '@/types/canvas'

export function BlockToolbar() {
  const { isAdmin } = useAuth()
  const {
    blocks,
    selectedBlockId,
    isEditing,
    updateStyle,
    removeBlock,
    bringBlockToFront,
    sendBlockToBack,
  } = useCanvas()

  if (!isAdmin || !selectedBlockId || isEditing) return null

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  if (!selectedBlock) return null

  const isText = isTextBlock(selectedBlock)
  const textBlock = isText ? (selectedBlock as TextBlock) : null

  const fontSizes = [0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4]
  const colors = [
    '#ffffff',
    '#f87171',
    '#fb923c',
    '#facc15',
    '#4ade80',
    '#22d3ee',
    '#818cf8',
    '#e879f9',
  ]

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 border border-white/10 rounded-xl p-2 shadow-xl">
      {/* Text-specific controls */}
      {isText && textBlock && (
        <>
          {/* Font size */}
          <select
            value={textBlock.style.fontSize}
            onChange={(e) => updateStyle(selectedBlockId, { fontSize: parseFloat(e.target.value) })}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm"
          >
            {fontSizes.map((size) => (
              <option key={size} value={size}>
                {size}rem
              </option>
            ))}
          </select>

          {/* Bold toggle */}
          <button
            onClick={() =>
              updateStyle(selectedBlockId, {
                fontWeight: textBlock.style.fontWeight === 'bold' ? 'normal' : 'bold',
              })
            }
            className={`p-2 rounded ${
              textBlock.style.fontWeight === 'bold' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <span className="font-bold">B</span>
          </button>

          {/* Text align */}
          <div className="flex border border-white/20 rounded overflow-hidden">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => updateStyle(selectedBlockId, { textAlign: align })}
                className={`p-2 ${
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
          <div className="flex gap-1">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => updateStyle(selectedBlockId, { color })}
                className={`w-6 h-6 rounded-full border-2 ${
                  textBlock.style.color === color ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-white/20 mx-1" />
        </>
      )}

      {/* Z-index controls */}
      <button
        onClick={() => bringBlockToFront(selectedBlockId)}
        className="p-2 bg-white/10 hover:bg-white/20 rounded"
        title="Bring to front"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <button
        onClick={() => sendBlockToBack(selectedBlockId)}
        className="p-2 bg-white/10 hover:bg-white/20 rounded"
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
        className="p-2 bg-red-600/50 hover:bg-red-600 rounded"
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
