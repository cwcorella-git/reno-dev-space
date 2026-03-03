'use client'

import { useCallback, useRef, RefObject } from 'react'

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

interface UseDragResizeOptions {
  canvasRef: RefObject<HTMLDivElement | null>
  enabled: boolean
  onDragEnd: (position: Position) => void
  onResizeEnd: (size: Size) => void
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

export function useDragResize({
  canvasRef,
  enabled,
  onDragEnd,
  onResizeEnd,
}: UseDragResizeOptions) {
  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const resizeHandle = useRef<ResizeHandle | null>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const startBlockPos = useRef({ x: 0, y: 0 })
  const startBlockSize = useRef({ width: 0, height: 0 })
  const currentPos = useRef({ x: 0, y: 0 })
  const currentSize = useRef({ width: 0, height: 0 })

  // Convert pixel position to percentage of canvas
  const pixelsToPercent = useCallback(
    (px: number, dimension: 'x' | 'y'): number => {
      if (!canvasRef.current) return 0
      const rect = canvasRef.current.getBoundingClientRect()
      const containerSize = dimension === 'x' ? rect.width : rect.height
      return (px / containerSize) * 100
    },
    [canvasRef]
  )

  // Get mouse position relative to canvas in percentages
  const getRelativePosition = useCallback(
    (e: MouseEvent | React.MouseEvent): Position => {
      if (!canvasRef.current) return { x: 0, y: 0 }
      const rect = canvasRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
    },
    [canvasRef]
  )

  // Start dragging
  const handleDragStart = useCallback(
    (e: React.MouseEvent, blockX: number, blockY: number) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()

      isDragging.current = true
      startPos.current = getRelativePosition(e)
      startBlockPos.current = { x: blockX, y: blockY }
      currentPos.current = { x: blockX, y: blockY }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return

        const pos = getRelativePosition(moveEvent)
        const deltaX = pos.x - startPos.current.x
        const deltaY = pos.y - startPos.current.y

        currentPos.current = {
          x: Math.max(0, Math.min(100, startBlockPos.current.x + deltaX)),
          y: Math.max(0, Math.min(100, startBlockPos.current.y + deltaY)),
        }

        // Update visual position during drag (via CSS transform)
        const target = e.currentTarget as HTMLElement
        if (target) {
          target.style.left = `${currentPos.current.x}%`
          target.style.top = `${currentPos.current.y}%`
        }
      }

      const handleMouseUp = () => {
        if (isDragging.current) {
          isDragging.current = false
          onDragEnd(currentPos.current)
        }
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [enabled, getRelativePosition, onDragEnd]
  )

  // Start resizing
  const handleResizeStart = useCallback(
    (
      e: React.MouseEvent,
      handle: ResizeHandle,
      blockX: number,
      blockY: number,
      blockWidth: number,
      blockHeight: number
    ) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()

      isResizing.current = true
      resizeHandle.current = handle
      startPos.current = getRelativePosition(e)
      startBlockPos.current = { x: blockX, y: blockY }
      startBlockSize.current = { width: blockWidth, height: blockHeight || 10 }
      currentSize.current = { width: blockWidth, height: blockHeight || 10 }
      currentPos.current = { x: blockX, y: blockY }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current || !resizeHandle.current) return

        const pos = getRelativePosition(moveEvent)
        const deltaX = pos.x - startPos.current.x
        const deltaY = pos.y - startPos.current.y
        const h = resizeHandle.current

        let newWidth = startBlockSize.current.width
        let newHeight = startBlockSize.current.height
        let newX = startBlockPos.current.x
        let newY = startBlockPos.current.y

        // Handle horizontal resize
        if (h.includes('e')) {
          newWidth = Math.max(5, startBlockSize.current.width + deltaX)
        }
        if (h.includes('w')) {
          const widthDelta = -deltaX
          newWidth = Math.max(5, startBlockSize.current.width + widthDelta)
          newX = startBlockPos.current.x - widthDelta
        }

        // Handle vertical resize
        if (h.includes('s')) {
          newHeight = Math.max(5, startBlockSize.current.height + deltaY)
        }
        if (h.includes('n')) {
          const heightDelta = -deltaY
          newHeight = Math.max(5, startBlockSize.current.height + heightDelta)
          newY = startBlockPos.current.y - heightDelta
        }

        currentSize.current = { width: newWidth, height: newHeight }
        currentPos.current = { x: newX, y: newY }
      }

      const handleMouseUp = () => {
        if (isResizing.current) {
          isResizing.current = false
          resizeHandle.current = null
          onResizeEnd(currentSize.current)
          // Also update position if it changed (for nw, ne, sw, se handles)
          if (
            currentPos.current.x !== startBlockPos.current.x ||
            currentPos.current.y !== startBlockPos.current.y
          ) {
            onDragEnd(currentPos.current)
          }
        }
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [enabled, getRelativePosition, onResizeEnd, onDragEnd]
  )

  return {
    handleDragStart,
    handleResizeStart,
    isDragging: isDragging.current,
    isResizing: isResizing.current,
  }
}
