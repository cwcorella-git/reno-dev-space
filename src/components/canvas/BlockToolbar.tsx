'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { isTextBlock, TextBlock, TEXT_COLORS } from '@/types/canvas'
import { filterEditableBlocks } from '@/lib/permissions'

// Available fonts
const FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Comic Sans MS', label: 'Comic' },
  { value: 'Impact', label: 'Impact' },
]

// Quick colors for collapsed mode (subset of full palette)
const QUICK_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7']

type ToolbarMode = 'collapsed' | 'half' | 'full'

export function BlockToolbar() {
  const { user, isAdmin } = useAuth()
  const {
    blocks,
    selectedBlockId,
    selectedBlockIds,
    updateStyle,
    removeBlock,
    bringBlockToFront,
    sendBlockToBack,
  } = useCanvas()

  const [mode, setMode] = useState<ToolbarMode>('collapsed')
  const [touchStartY, setTouchStartY] = useState<number | null>(null)

  // Get editable block IDs (user can edit their own blocks, admin can edit all)
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
  const hasMultipleSelected = selectedBlockIds.length > 1

  // Apply style to all selected editable text blocks
  const applyStyleToSelection = useCallback(
    (style: Partial<TextBlock['style']>) => {
      editableTextBlockIds.forEach(id => updateStyle(id, style))
    },
    [editableTextBlockIds, updateStyle]
  )

  // Set default mode based on screen size
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 640
      // Only set initial mode, don't override user's choice
      if (mode === 'collapsed' && !isMobile) {
        setMode('half')
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cycle through modes on click
  const cycleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === 'collapsed') return 'half'
      if (prev === 'half') return 'full'
      return 'collapsed'
    })
  }, [])

  // Touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY)
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY === null) return
      const deltaY = touchStartY - e.changedTouches[0].clientY

      if (deltaY > 50) {
        // Swipe up - expand
        setMode((prev) => (prev === 'collapsed' ? 'half' : prev === 'half' ? 'full' : 'full'))
      } else if (deltaY < -50) {
        // Swipe down - collapse
        setMode((prev) => (prev === 'full' ? 'half' : prev === 'half' ? 'collapsed' : 'collapsed'))
      }
      setTouchStartY(null)
    },
    [touchStartY]
  )

  if (!selectedBlockId) return null

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  if (!selectedBlock) return null

  const isText = isTextBlock(selectedBlock)
  const textBlock = isText ? (selectedBlock as TextBlock) : null

  // Check if user can edit this block (creator or admin)
  const canEdit = isAdmin || (user && textBlock?.createdBy === user.uid)
  if (!canEdit) return null

  // Height classes based on mode
  const heightClass =
    mode === 'collapsed' ? 'h-14' : mode === 'half' ? 'h-auto max-h-[280px]' : 'h-auto max-h-[380px]'

  // Position classes - centered pill when collapsed, full width when expanded
  const positionClass =
    mode === 'collapsed'
      ? 'left-1/2 -translate-x-1/2 w-auto'
      : 'left-2 right-2 sm:left-4 sm:right-4'

  return (
    <div
      className={`fixed bottom-2 sm:bottom-4 z-50 bg-gray-900/95 backdrop-blur-sm border border-white/10 shadow-xl transition-all duration-300 ease-out overflow-hidden ${heightClass} ${positionClass} ${
        mode === 'collapsed' ? 'rounded-full' : 'rounded-2xl'
      }`}
    >
      {/* Header with drag handle and close button */}
      <div
        className="flex items-center justify-between px-3 py-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Spacer for balance */}
        <div className="w-8" />

        {/* Drag handle */}
        <div
          className="flex-1 flex justify-center cursor-pointer py-1"
          onClick={cycleMode}
        >
          <div className="w-10 h-1 bg-white/30 rounded-full" />
        </div>

        {/* Close button (visible when expanded) */}
        {mode !== 'collapsed' ? (
          <button
            onClick={() => setMode('collapsed')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white"
            title="Collapse toolbar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* Selection count indicator */}
      {hasMultipleSelected && mode !== 'collapsed' && (
        <div className="px-4 pb-2 text-xs text-gray-400">
          {selectedBlockIds.length} blocks selected
          {editableTextBlockIds.length < selectedBlockIds.length && (
            <span className="text-gray-500"> ({editableTextBlockIds.length} editable)</span>
          )}
        </div>
      )}

      {/* Collapsed row - quick actions */}
      <div className="flex items-center justify-center gap-2 px-4 pb-2">
        {/* Quick color picker */}
        {isText && textBlock && (
          <div className="flex gap-1">
            {QUICK_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => applyStyleToSelection({ color })}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  textBlock.style.color === color ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}

        {/* B I U toggles */}
        {isText && textBlock && (
          <>
            <div className="w-px h-5 bg-white/20" />
            <div className="flex gap-1">
              <button
                onClick={() =>
                  applyStyleToSelection({
                    fontWeight: textBlock.style.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
                className={`w-8 h-8 rounded flex items-center justify-center ${
                  textBlock.style.fontWeight === 'bold' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <span className="font-bold text-sm">B</span>
              </button>
              <button
                onClick={() =>
                  applyStyleToSelection({
                    fontStyle: textBlock.style.fontStyle === 'italic' ? 'normal' : 'italic',
                  })
                }
                className={`w-8 h-8 rounded flex items-center justify-center ${
                  textBlock.style.fontStyle === 'italic' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <span className="italic text-sm">I</span>
              </button>
              <button
                onClick={() =>
                  applyStyleToSelection({
                    textDecoration: textBlock.style.textDecoration === 'underline' ? 'none' : 'underline',
                  })
                }
                className={`w-8 h-8 rounded flex items-center justify-center ${
                  textBlock.style.textDecoration === 'underline' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <span className="underline text-sm">U</span>
              </button>
            </div>
          </>
        )}

        {/* Expand indicator */}
        <div className="w-px h-5 bg-white/20" />
        <button
          onClick={cycleMode}
          className="w-8 h-8 rounded flex items-center justify-center bg-white/10 hover:bg-white/20"
        >
          <svg
            className={`w-4 h-4 transition-transform ${mode !== 'collapsed' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Expanded content */}
      {mode !== 'collapsed' && isText && textBlock && (
        <div className="px-4 pb-4 space-y-3 overflow-y-auto">
          {/* Typography section */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Typography</span>
            <div className="flex flex-wrap gap-2">
              {/* Font family */}
              <select
                value={textBlock.style.fontFamily || 'Inter'}
                onChange={(e) => applyStyleToSelection({ fontFamily: e.target.value })}
                className="h-8 px-2 bg-white/10 border border-white/20 rounded text-sm flex-1 min-w-[100px]"
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
                  onChange={(e) => applyStyleToSelection({ fontSize: parseFloat(e.target.value) || 1 })}
                  className="w-16 h-8 px-2 bg-white/10 border border-white/20 rounded text-sm text-center"
                />
                <span className="text-xs text-gray-400">rem</span>
              </div>
            </div>
          </div>

          {/* Style section */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Style</span>
            <div className="flex flex-wrap gap-2">
              {/* Text style buttons */}
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    applyStyleToSelection({
                      fontWeight: textBlock.style.fontWeight === 'bold' ? 'normal' : 'bold',
                    })
                  }
                  className={`w-8 h-8 rounded flex items-center justify-center ${
                    textBlock.style.fontWeight === 'bold' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <span className="font-bold text-sm">B</span>
                </button>
                <button
                  onClick={() =>
                    applyStyleToSelection({
                      fontStyle: textBlock.style.fontStyle === 'italic' ? 'normal' : 'italic',
                    })
                  }
                  className={`w-8 h-8 rounded flex items-center justify-center ${
                    textBlock.style.fontStyle === 'italic' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <span className="italic text-sm">I</span>
                </button>
                <button
                  onClick={() =>
                    applyStyleToSelection({
                      textDecoration: textBlock.style.textDecoration === 'underline' ? 'none' : 'underline',
                    })
                  }
                  className={`w-8 h-8 rounded flex items-center justify-center ${
                    textBlock.style.textDecoration === 'underline' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <span className="underline text-sm">U</span>
                </button>
                <button
                  onClick={() =>
                    applyStyleToSelection({
                      textDecoration: textBlock.style.textDecoration === 'line-through' ? 'none' : 'line-through',
                    })
                  }
                  className={`w-8 h-8 rounded flex items-center justify-center ${
                    textBlock.style.textDecoration === 'line-through' ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <span className="line-through text-sm">S</span>
                </button>
              </div>

              {/* Alignment */}
              <div className="flex border border-white/20 rounded overflow-hidden h-8">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => applyStyleToSelection({ textAlign: align })}
                    className={`w-8 h-full flex items-center justify-center ${
                      textBlock.style.textAlign === align ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {align === 'left' && <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />}
                      {align === 'center' && <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />}
                      {align === 'right' && <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />}
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Color section */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Color</span>
            <div className="flex flex-wrap gap-1">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => applyStyleToSelection({ color })}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    textBlock.style.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Actions section */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Actions</span>
            <div className="flex flex-wrap gap-2">
              {/* Layer controls */}
              <button
                onClick={() => bringBlockToFront(selectedBlockId)}
                className="h-8 px-2 rounded bg-white/10 hover:bg-white/20 flex items-center gap-1"
                title="Bring to front"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span className="text-xs">Front</span>
              </button>
              <button
                onClick={() => sendBlockToBack(selectedBlockId)}
                className="h-8 px-2 rounded bg-white/10 hover:bg-white/20 flex items-center gap-1"
                title="Send to back"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-xs">Back</span>
              </button>

              {/* Delete */}
              <button
                onClick={() => removeBlock(selectedBlockId)}
                className="h-8 px-3 rounded bg-red-600/50 hover:bg-red-600 flex items-center gap-1"
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
                <span className="text-xs">Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-text block actions */}
      {mode !== 'collapsed' && !isText && (
        <div className="px-4 pb-4 space-y-3">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Actions</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => bringBlockToFront(selectedBlockId)}
                className="h-8 px-3 rounded bg-white/10 hover:bg-white/20 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span className="text-xs">Bring to Front</span>
              </button>
              <button
                onClick={() => sendBlockToBack(selectedBlockId)}
                className="h-8 px-3 rounded bg-white/10 hover:bg-white/20 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-xs">Send to Back</span>
              </button>
              <button
                onClick={() => removeBlock(selectedBlockId)}
                className="h-8 px-3 rounded bg-red-600/50 hover:bg-red-600 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span className="text-xs">Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
