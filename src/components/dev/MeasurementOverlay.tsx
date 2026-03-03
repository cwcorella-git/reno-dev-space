'use client'

/**
 * MeasurementOverlay - Dev Visual Debugging
 *
 * Renders over the canvas to visualize:
 * - Bounding boxes (blue)
 * - Proximity zones (amber dashed)
 * - Character boxes (green, expensive)
 * - Collision state at cursor (red/green dot)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useCanvas } from '@/contexts/CanvasContext'
import {
  measurementService,
  collisionDetector,
  CanvasRect,
  ProximityZone,
  CharacterMeasurement,
  MeasurementDebugConfig,
  DEFAULT_DEBUG_CONFIG,
} from '@/lib/measurement'

interface MeasurementOverlayProps {
  canvasRef: React.RefObject<HTMLElement | null>
  canvasHeightPercent: number
  config?: Partial<MeasurementDebugConfig>
}

export function MeasurementOverlay({
  canvasRef,
  canvasHeightPercent,
  config: configOverride,
}: MeasurementOverlayProps) {
  const { blocks } = useCanvas()
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [collisionState, setCollisionState] = useState<boolean>(false)

  const config = useMemo(
    () => ({ ...DEFAULT_DEBUG_CONFIG, ...configOverride }),
    [configOverride]
  )

  // Track cursor position in canvas percentage coordinates
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !config.enabled) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeightPercent
      setCursorPos({ x, y })
    }

    const handleMouseLeave = () => {
      setCursorPos(null)
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [canvasRef, canvasHeightPercent, config.enabled])

  // Check collision state at cursor
  useEffect(() => {
    if (!cursorPos || !config.showCollisionState) {
      setCollisionState(false)
      return
    }

    // Check if a small rect at cursor would collide
    const result = collisionDetector.checkAddTextCollision(
      cursorPos.x,
      cursorPos.y,
      8, // preview width (small test area)
      4, // preview height
      blocks,
      canvasHeightPercent
    )

    setCollisionState(result.collides)
  }, [cursorPos, blocks, canvasHeightPercent, config.showCollisionState])

  // Get proximity zones for all blocks
  const proximityZones = useMemo(() => {
    if (!config.enabled || !config.showProximityZones) return []
    return collisionDetector.getProximityZones(blocks)
  }, [blocks, config.enabled, config.showProximityZones])

  // Get bounding boxes
  const boundingBoxes = useMemo(() => {
    if (!config.enabled || !config.showBoundingBoxes) return []
    return blocks.map(block => ({
      blockId: block.id,
      rect: measurementService.getBoundingBox(block),
    }))
  }, [blocks, config.enabled, config.showBoundingBoxes])

  // Get character boxes (expensive - only when enabled)
  const characterBoxes = useMemo(() => {
    if (!config.enabled || !config.showCharacterBoxes) return []
    const allChars: { blockId: string; char: CharacterMeasurement }[] = []
    for (const block of blocks) {
      const chars = measurementService.getCharacterMeasurements(block)
      chars.forEach(char => allChars.push({ blockId: block.id, char }))
    }
    return allChars
  }, [blocks, config.enabled, config.showCharacterBoxes])

  if (!config.enabled) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 9999 }}
    >
      {/* Proximity Zones (amber dashed) */}
      {proximityZones.map(zone => (
        <div
          key={`proximity-${zone.blockId}`}
          className="absolute border-2 border-dashed border-amber-400/60"
          style={rectToStyle(zone.outer, canvasHeightPercent)}
        />
      ))}

      {/* Bounding Boxes (blue solid) */}
      {boundingBoxes.map(({ blockId, rect }) => (
        <div
          key={`bbox-${blockId}`}
          className="absolute border-2 border-blue-500/80"
          style={rectToStyle(rect, canvasHeightPercent)}
        >
          {/* Block ID label */}
          <span className="absolute -top-5 left-0 text-[10px] text-blue-400 bg-gray-900/80 px-1 rounded">
            {blockId.slice(0, 8)}
          </span>
        </div>
      ))}

      {/* Character Boxes (green) */}
      {characterBoxes.map(({ blockId, char }, i) => (
        <div
          key={`char-${blockId}-${i}`}
          className="absolute border border-green-400/40 bg-green-400/10"
          style={rectToStyle(char.rect, canvasHeightPercent)}
        />
      ))}

      {/* Collision State Indicator (cursor dot) */}
      {config.showCollisionState && cursorPos && (
        <div
          className={`absolute w-4 h-4 rounded-full border-2 ${
            collisionState
              ? 'bg-red-500/60 border-red-400'
              : 'bg-green-500/60 border-green-400'
          }`}
          style={{
            left: `${cursorPos.x}%`,
            top: `${(cursorPos.y / canvasHeightPercent) * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}

      {/* Stats Panel */}
      <div className="absolute top-2 right-2 bg-gray-900/90 text-white text-xs p-2 rounded border border-white/20">
        <div className="font-bold mb-1 text-amber-400">Measurement Debug</div>
        <div>Blocks: {blocks.length}</div>
        <div>Cache: {measurementService.getCacheStats().size}</div>
        {cursorPos && (
          <div className="mt-1 pt-1 border-t border-white/20">
            <div>
              Cursor: {cursorPos.x.toFixed(1)}%, {cursorPos.y.toFixed(1)}%
            </div>
            <div className={collisionState ? 'text-red-400' : 'text-green-400'}>
              {collisionState ? '⊘ Collision' : '✓ Clear'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Convert CanvasRect to CSS style object.
 */
function rectToStyle(
  rect: CanvasRect,
  canvasHeightPercent: number
): React.CSSProperties {
  return {
    left: `${rect.x}%`,
    top: `${(rect.y / canvasHeightPercent) * 100}%`,
    width: `${rect.width}%`,
    height: `${(rect.height / canvasHeightPercent) * 100}%`,
  }
}

/**
 * Dev Controls Component - Toggles for the overlay.
 */
interface MeasurementControlsProps {
  config: MeasurementDebugConfig
  onChange: (config: MeasurementDebugConfig) => void
}

export function MeasurementControls({ config, onChange }: MeasurementControlsProps) {
  const toggle = useCallback(
    (key: keyof MeasurementDebugConfig) => {
      onChange({ ...config, [key]: !config[key] })
    },
    [config, onChange]
  )

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={() => toggle('enabled')}
          className="rounded"
        />
        Enable Overlay
      </label>

      {config.enabled && (
        <div className="pl-4 space-y-1 text-xs text-gray-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showBoundingBoxes}
              onChange={() => toggle('showBoundingBoxes')}
              className="rounded"
            />
            <span className="text-blue-400">■</span> Bounding Boxes
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showProximityZones}
              onChange={() => toggle('showProximityZones')}
              className="rounded"
            />
            <span className="text-amber-400">▢</span> Proximity Zones
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showCharacterBoxes}
              onChange={() => toggle('showCharacterBoxes')}
              className="rounded"
            />
            <span className="text-green-400">■</span> Character Boxes
            <span className="text-gray-500">(slow)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showCollisionState}
              onChange={() => toggle('showCollisionState')}
              className="rounded"
            />
            <span className="text-green-400">●</span>
            <span className="text-red-400">●</span> Collision State
          </label>
        </div>
      )}
    </div>
  )
}
