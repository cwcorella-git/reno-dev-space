'use client'

import { useEffect, useState } from 'react'
import { useCanvas } from '@/contexts/CanvasContext'

interface BlockDebugInfo {
  id: string
  content: string
  percentageBox: { x: number; y: number; width: number; height: number }
  actualBox: DOMRect | null
  heightError: number // percentage error between estimated and actual
}

/**
 * Bounding Box Debugger
 *
 * Visualizes the difference between:
 * 1. Percentage-based bounding box estimates (used in overlap detection)
 * 2. Actual DOM bounding boxes (from getBoundingClientRect)
 *
 * Press Shift+D to toggle this debugger.
 */
export function BoundingBoxDebugger() {
  const { blocks } = useCanvas()
  const [enabled, setEnabled] = useState(false)
  const [debugInfo, setDebugInfo] = useState<BlockDebugInfo[]>([])

  // Toggle with Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setEnabled((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Collect debug info when enabled
  useEffect(() => {
    if (!enabled || blocks.length === 0) {
      setDebugInfo([])
      return
    }

    const info: BlockDebugInfo[] = []
    const canvas = document.querySelector('[data-canvas-container]') as HTMLElement
    if (!canvas) return

    const canvasRect = canvas.getBoundingClientRect()
    const canvasHeightPercent = 100 // Simplified for calculation

    blocks.forEach((block) => {
      const element = document.querySelector(`[data-block-id="${block.id}"]`)
      if (!element) return

      const actualRect = element.getBoundingClientRect()

      // Calculate what the percentage-based system thinks the height is
      const estimatedHeightPercent = 1 // Hardcoded in overlapDetection.ts
      const actualHeightPercent = ((actualRect.height / canvasRect.height) * canvasHeightPercent)

      // Calculate error
      const heightError = Math.abs(actualHeightPercent - estimatedHeightPercent)
      const errorPercent = (heightError / actualHeightPercent) * 100

      info.push({
        id: block.id,
        content: block.content.substring(0, 30) + (block.content.length > 30 ? '...' : ''),
        percentageBox: {
          x: block.x,
          y: block.y,
          width: block.width || 5,
          height: estimatedHeightPercent,
        },
        actualBox: actualRect,
        heightError: errorPercent,
      })
    })

    setDebugInfo(info.sort((a, b) => b.heightError - a.heightError))
  }, [enabled, blocks])

  if (!enabled) return null

  const majorIssues = debugInfo.filter((info) => info.heightError > 50)
  const minorIssues = debugInfo.filter((info) => info.heightError >= 20 && info.heightError <= 50)

  return (
    <div className="fixed top-20 right-4 z-[300] w-80 max-h-[80vh] overflow-y-auto bg-gray-900 border border-amber-500/50 rounded-lg shadow-2xl">
      {/* Header */}
      <div className="sticky top-0 bg-gray-800 border-b border-amber-500/50 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-amber-400 font-bold text-sm">Bounding Box Debugger</h3>
          <p className="text-xs text-gray-400 mt-0.5">Press Shift+D to close</p>
        </div>
        <button
          onClick={() => setEnabled(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 bg-gray-800/50 border-b border-white/10">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-400">Total Blocks</div>
            <div className="text-white font-bold">{debugInfo.length}</div>
          </div>
          <div>
            <div className="text-red-400">Major Issues</div>
            <div className="text-white font-bold">{majorIssues.length}</div>
          </div>
          <div>
            <div className="text-yellow-400">Minor Issues</div>
            <div className="text-white font-bold">{minorIssues.length}</div>
          </div>
        </div>
      </div>

      {/* Block List */}
      <div className="p-3 space-y-2">
        {debugInfo.length === 0 && (
          <p className="text-gray-400 text-xs text-center py-4">No blocks found</p>
        )}

        {debugInfo.map((info) => (
          <div
            key={info.id}
            className={`p-2 rounded border ${
              info.heightError > 50
                ? 'bg-red-900/20 border-red-500/50'
                : info.heightError >= 20
                ? 'bg-yellow-900/20 border-yellow-500/50'
                : 'bg-green-900/20 border-green-500/50'
            }`}
          >
            {/* Content Preview */}
            <div className="text-xs text-white font-mono mb-1 truncate">
              &ldquo;{info.content}&rdquo;
            </div>

            {/* Height Comparison */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <div className="text-gray-400">Estimated (code)</div>
                <div className="text-white font-bold">
                  {info.percentageBox.height.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-gray-400">Actual (DOM)</div>
                <div className="text-white font-bold">
                  {info.actualBox
                    ? ((info.actualBox.height / document.documentElement.clientHeight) * 100).toFixed(1) + '%'
                    : 'N/A'}
                </div>
              </div>
            </div>

            {/* Error Indicator */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-700 rounded overflow-hidden">
                <div
                  className={`h-full ${
                    info.heightError > 50
                      ? 'bg-red-500'
                      : info.heightError >= 20
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, info.heightError)}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-gray-300 w-12 text-right">
                {info.heightError.toFixed(0)}% off
              </div>
            </div>

            {/* Position Info */}
            <div className="mt-1 text-[9px] text-gray-500 font-mono">
              Position: ({info.percentageBox.x.toFixed(1)}, {info.percentageBox.y.toFixed(1)}) |
              Width: {info.percentageBox.width.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* Help Text */}
      <div className="sticky bottom-0 px-4 py-2 bg-gray-800 border-t border-white/10 text-[10px] text-gray-400">
        <strong className="text-amber-400">Issue:</strong> Overlap detection uses fixed 1% height,
        but actual text can be 10-15% when wrapped.
      </div>
    </div>
  )
}
