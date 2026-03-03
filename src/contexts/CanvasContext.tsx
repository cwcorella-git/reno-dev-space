'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  RefObject,
  useRef,
} from 'react'
import { CanvasBlock, TextBlock, TextEffectName, VOTE_BRIGHTNESS_CHANGE } from '@/types/canvas'
import { getCelebrationEffect, getRandomEffect } from '@/lib/voteEffects'
import { subscribeToEffectsSettings } from '@/lib/storage/effectsStorage'
import { TextEffectsSettings, DEFAULT_EFFECTS_SETTINGS } from '@/types/canvas'
import { measurementService, MeasurementDebugConfig, DEFAULT_DEBUG_CONFIG } from '@/lib/measurement'

// History entry for undo/redo (session-only)
interface HistoryEntry {
  type: 'add' | 'delete' | 'move' | 'resize' | 'style' | 'content' | 'vote'
  timestamp: number
  blockSnapshots: Record<string, CanvasBlock>  // Before state (full blocks)
  afterSnapshots?: Record<string, CanvasBlock>  // After state (populated lazily during undo)
  deletedBlocks?: CanvasBlock[]  // Blocks that were deleted (for undo of delete)
  createdIds?: string[]  // IDs of blocks that were created (for undo of add)
}

const MAX_HISTORY = 50

// Fixed design canvas dimensions - all positioning is relative to these
export const DESIGN_WIDTH = 1440
export const DESIGN_HEIGHT = 900 // Base "one screen" height in pixels
import {
  subscribeToCanvas,
  addTextBlock,
  updateBlockPosition,
  updateBlockSize,
  updateTextContent,
  updateTextStyle,
  deleteBlock,
  bringToFront,
  sendToBack,
  voteBrightness,
  reportBlock as reportBlockStorage,
  unreportBlock as unreportBlockStorage,
  dismissReports as dismissReportsStorage,
  restoreBlock,
  restoreBlocks,
  updateBlockFull,
} from '@/lib/storage/canvasStorage'
import { logDeletion, removeReportEntry, removeAllReportEntries } from '@/lib/storage/deletionStorage'
import { logContentEdit } from '@/lib/storage/editHistoryStorage'
import { subscribeToPledges, Pledge } from '@/lib/storage/pledgeStorage'
import { useAuth } from './AuthContext'

interface CanvasContextType {
  blocks: CanvasBlock[]
  canAddText: boolean
  selectedBlockId: string | null
  selectedBlockIds: string[]
  isEditing: boolean
  isAddTextMode: boolean
  isGroupDragging: boolean
  canvasRef: RefObject<HTMLDivElement | null>
  canvasHeightPercent: number
  setCanvasHeightPercent: (height: number) => void
  loading: boolean

  // Measurement debug overlay
  measurementDebugConfig: MeasurementDebugConfig
  setMeasurementDebugConfig: (config: MeasurementDebugConfig) => void

  // Selection
  selectBlock: (id: string | null) => void
  selectBlocks: (ids: string[]) => void
  setIsEditing: (editing: boolean) => void
  setIsAddTextMode: (mode: boolean) => void
  setIsGroupDragging: (dragging: boolean) => void

  // Block operations (admin only)
  addText: (x: number, y: number, color?: string, fontFamily?: string) => Promise<string | null>
  moveBlock: (id: string, x: number, y: number) => Promise<void>
  moveBlocks: (moves: { id: string; x: number; y: number }[]) => Promise<void>
  resizeBlock: (id: string, width: number, height: number) => Promise<void>
  updateContent: (id: string, content: string) => Promise<void>
  updateStyle: (id: string, style: Partial<TextBlock['style']>) => Promise<void>
  removeBlock: (id: string) => Promise<void>
  removeBlocks: (ids: string[]) => Promise<void>
  bringBlockToFront: (id: string) => Promise<void>
  sendBlockToBack: (id: string) => Promise<void>

  // Voting (any logged-in user)
  vote: (id: string, direction: 'up' | 'down') => Promise<boolean>

  // Celebration (client-side only, fires on upvote)
  celebratingBlockId: string | null
  celebratingEffect: TextEffectName | null
  clearCelebration: () => void

  // Reporting
  report: (id: string) => Promise<void>
  dismissReport: (id: string) => Promise<void>

  // History (session-only)
  recordHistory: (
    type: HistoryEntry['type'],
    affectedBlockIds: string[],
    options?: { deletedBlocks?: CanvasBlock[]; createdIds?: string[] }
  ) => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: boolean
  canRedo: boolean

  // Clipboard (session-only)
  clipboard: CanvasBlock[]
  copyBlocks: () => void
  pasteBlocks: (cursorX: number, cursorY: number) => Promise<void>
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined)

export function CanvasProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth()
  const [blocks, setBlocks] = useState<CanvasBlock[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isAddTextMode, setIsAddTextMode] = useState(false)
  const [isGroupDragging, setIsGroupDragging] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasPledged, setHasPledged] = useState(false)
  const [celebratingBlockId, setCelebratingBlockId] = useState<string | null>(null)
  const [celebratingEffect, setCelebratingEffect] = useState<TextEffectName | null>(null)
  const [effectsSettings, setEffectsSettings] = useState<TextEffectsSettings>(DEFAULT_EFFECTS_SETTINGS)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [canvasHeightPercent, setCanvasHeightPercentState] = useState(100)
  const [measurementDebugConfig, setMeasurementDebugConfig] = useState<MeasurementDebugConfig>(
    DEFAULT_DEBUG_CONFIG
  )

  // History for undo/redo (session-only, stored in ref to avoid re-renders on every action)
  const historyRef = useRef<HistoryEntry[]>([])
  const historyIndexRef = useRef(-1)  // Points to current state in history, -1 = at beginning
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Clipboard for copy/paste (session-only)
  const [clipboard, setClipboard] = useState<CanvasBlock[]>([])

  // Subscribe to canvas blocks
  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false)
      return
    }

    const unsubscribe = subscribeToCanvas(
      (newBlocks) => {
        setBlocks(newBlocks)
        setLoading(false)
      },
      (error) => {
        console.error('[CanvasContext] Error:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Subscribe to effects settings (for test mode)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const unsub = subscribeToEffectsSettings(setEffectsSettings)
    return () => unsub()
  }, [])

  // Initialize measurement service when canvas ref changes
  useEffect(() => {
    measurementService.setCanvas(canvasRef.current, canvasHeightPercent)
  }, [canvasHeightPercent])

  // Setter for canvasHeightPercent that also updates measurement service
  const setCanvasHeightPercent = useCallback((height: number) => {
    setCanvasHeightPercentState(height)
    measurementService.updateCanvasHeight(height)
  }, [])

  // Subscribe to pledges to determine canAddText
  useEffect(() => {
    if (!user) { setHasPledged(false); return }
    const unsub = subscribeToPledges((pledges: Pledge[]) => {
      const p = pledges.find(p => p.odId === user.uid)
      setHasPledged(!!p && p.amount > 0)
    })
    return () => unsub()
  }, [user])

  const canAddText = isAdmin || hasPledged

  // Clear selection when clicking outside
  const selectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id)
    setSelectedBlockIds(id ? [id] : [])
    if (!id) {
      setIsEditing(false)
    }
  }, [])

  // Select multiple blocks (for marquee selection)
  const selectBlocks = useCallback((ids: string[]) => {
    setSelectedBlockIds(ids)
    // Set first block as primary selected
    setSelectedBlockId(ids.length > 0 ? ids[0] : null)
    setIsEditing(false)
  }, [])

  // Helper to update canUndo/canRedo state
  const updateHistoryState = useCallback(() => {
    setCanUndo(historyIndexRef.current >= 0)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  }, [])

  // Record a change to history (call BEFORE making the change)
  const recordHistory = useCallback((
    type: HistoryEntry['type'],
    affectedBlockIds: string[],
    options?: { deletedBlocks?: CanvasBlock[]; createdIds?: string[] }
  ) => {
    // Get snapshots of affected blocks BEFORE the change
    const blockSnapshots: Record<string, CanvasBlock> = {}
    affectedBlockIds.forEach(id => {
      const block = blocks.find(b => b.id === id)
      if (block) {
        blockSnapshots[id] = { ...block }
      }
    })

    const entry: HistoryEntry = {
      type,
      timestamp: Date.now(),
      blockSnapshots,
      deletedBlocks: options?.deletedBlocks,
      createdIds: options?.createdIds,
    }

    // If we're not at the end of history, truncate future entries
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    }

    // Add new entry
    historyRef.current.push(entry)

    // Enforce max history limit
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    } else {
      historyIndexRef.current++
    }

    updateHistoryState()
  }, [blocks, updateHistoryState])

  // Undo last action (deferred afterSnapshot capture for redo support)
  const undo = useCallback(async () => {
    if (historyIndexRef.current < 0) return

    const entry = historyRef.current[historyIndexRef.current]
    if (!entry) return

    try {
      switch (entry.type) {
        case 'add':
          // Undo add = capture created blocks for redo, then delete them
          if (entry.createdIds) {
            entry.deletedBlocks = entry.createdIds
              .map(id => blocks.find(b => b.id === id))
              .filter((b): b is CanvasBlock => !!b)
            await Promise.all(entry.createdIds.map(id => deleteBlock(id)))
          }
          break

        case 'delete':
          // Undo delete = restore the deleted blocks
          if (entry.deletedBlocks) {
            await restoreBlocks(entry.deletedBlocks)
          }
          break

        case 'move':
        case 'resize':
        case 'style':
        case 'content':
        case 'vote': {
          // Check if this vote caused a deletion
          if (entry.type === 'vote' && entry.deletedBlocks && entry.deletedBlocks.length > 0) {
            await restoreBlocks(entry.deletedBlocks)
            break
          }
          // Capture current state as afterSnapshots (for redo)
          if (!entry.afterSnapshots) {
            entry.afterSnapshots = {}
            for (const id of Object.keys(entry.blockSnapshots)) {
              const current = blocks.find(b => b.id === id)
              if (current) entry.afterSnapshots[id] = { ...current }
            }
          }
          // Restore before state
          await Promise.all(
            Object.entries(entry.blockSnapshots).map(([id, snapshot]) =>
              updateBlockFull(id, snapshot)
            )
          )
          break
        }
      }

      historyIndexRef.current--
      updateHistoryState()
    } catch (error) {
      console.error('[CanvasContext] Undo failed:', error)
    }
  }, [blocks, updateHistoryState])

  // Redo last undone action (uses afterSnapshots captured during undo)
  const redo = useCallback(async () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return

    historyIndexRef.current++
    const entry = historyRef.current[historyIndexRef.current]
    if (!entry) return

    try {
      switch (entry.type) {
        case 'add':
          // Redo add = restore blocks captured during undo
          if (entry.deletedBlocks) {
            await restoreBlocks(entry.deletedBlocks)
          }
          break

        case 'delete':
          // Redo delete = delete the blocks again
          if (entry.deletedBlocks) {
            await Promise.all(entry.deletedBlocks.map(block => deleteBlock(block.id)))
          }
          break

        case 'move':
        case 'resize':
        case 'style':
        case 'content':
        case 'vote':
          // Check if this vote caused a deletion
          if (entry.type === 'vote' && entry.deletedBlocks && entry.deletedBlocks.length > 0) {
            await Promise.all(entry.deletedBlocks.map(b => deleteBlock(b.id)))
            break
          }
          // Apply afterSnapshots (captured during undo)
          if (entry.afterSnapshots) {
            await Promise.all(
              Object.entries(entry.afterSnapshots).map(([id, snapshot]) =>
                updateBlockFull(id, snapshot)
              )
            )
          }
          break
      }

      updateHistoryState()
    } catch (error) {
      console.error('[CanvasContext] Redo failed:', error)
      historyIndexRef.current--
      updateHistoryState()
    }
  }, [updateHistoryState])

  // Copy selected blocks to clipboard
  const copyBlocks = useCallback(() => {
    const blocksToCopy = blocks.filter(b => selectedBlockIds.includes(b.id))
    if (blocksToCopy.length > 0) {
      setClipboard(blocksToCopy.map(b => ({ ...b })))
    }
  }, [blocks, selectedBlockIds])

  // Paste blocks from clipboard at cursor position
  const pasteBlocks = useCallback(async (cursorX: number, cursorY: number) => {
    if (clipboard.length === 0 || !user) return

    // Calculate bounding box of copied blocks
    const minX = Math.min(...clipboard.map(b => b.x))
    const minY = Math.min(...clipboard.map(b => b.y))

    // Generate new blocks at cursor position, maintaining relative positions
    const maxZ = Math.max(...blocks.map(b => b.zIndex), 0)
    const newIds: string[] = []

    for (let i = 0; i < clipboard.length; i++) {
      const block = clipboard[i]
      const relX = block.x - minX
      const relY = block.y - minY
      const newX = cursorX + relX
      const newY = cursorY + relY

      // Add the block (only text blocks for now)
      if (block.type === 'text') {
        const id = await addTextBlock(newX, newY, user.uid, block.content, maxZ + i)
        // Update style to match original
        await updateTextStyle(id, block.style)
        newIds.push(id)
      }
    }

    // Record history for the paste operation
    if (newIds.length > 0) {
      recordHistory('add', [], { createdIds: newIds })
      selectBlocks(newIds)
    }
  }, [clipboard, user, blocks, selectBlocks, recordHistory])

  // Get max z-index for new blocks
  const getMaxZIndex = useCallback(() => {
    return Math.max(...blocks.map((b) => b.zIndex), 0)
  }, [blocks])

  // Admin operations
  const addText = useCallback(
    async (x: number, y: number, color?: string, fontFamily?: string): Promise<string | null> => {
      if (!canAddText || !user) return null
      try {
        const id = await addTextBlock(x, y, user.uid, '', getMaxZIndex(), color, fontFamily)
        recordHistory('add', [], { createdIds: [id] })
        setSelectedBlockId(id)
        return id
      } catch (error) {
        console.error('[CanvasContext] Failed to add text:', error)
        return null
      }
    },
    [canAddText, user, getMaxZIndex, recordHistory]
  )

  const moveBlock = useCallback(
    async (id: string, x: number, y: number): Promise<void> => {
      if (!isAdmin) return
      try {
        await updateBlockPosition(id, x, y)
      } catch (error) {
        console.error('[CanvasContext] Failed to move block:', error)
      }
    },
    [isAdmin]
  )

  // Batch move multiple blocks (for group move)
  const moveBlocks = useCallback(
    async (moves: { id: string; x: number; y: number }[]): Promise<void> => {
      if (!isAdmin) return
      try {
        await Promise.all(
          moves.map(({ id, x, y }) => updateBlockPosition(id, x, y))
        )
      } catch (error) {
        console.error('[CanvasContext] Failed to move blocks:', error)
      }
    },
    [isAdmin]
  )

  const resizeBlock = useCallback(
    async (id: string, width: number, height: number): Promise<void> => {
      if (!isAdmin) return
      try {
        await updateBlockSize(id, width, height)
      } catch (error) {
        console.error('[CanvasContext] Failed to resize block:', error)
      }
    },
    [isAdmin]
  )

  const updateContent = useCallback(
    async (id: string, content: string): Promise<void> => {
      if (!isAdmin) return
      try {
        const block = blocks.find((b) => b.id === id)
        if (block && block.content !== content) {
          recordHistory('content', [id])
          if (user) {
            logContentEdit(id, block.content, user.uid).catch(() => {})
          }
        }
        await updateTextContent(id, content)
      } catch (error) {
        console.error('[CanvasContext] Failed to update content:', error)
      }
    },
    [isAdmin, blocks, user, recordHistory]
  )

  const updateStyle = useCallback(
    async (id: string, style: Partial<TextBlock['style']>): Promise<void> => {
      const block = blocks.find((b) => b.id === id)
      const canEdit = isAdmin || (user && block?.createdBy === user.uid)
      if (!canEdit) return
      try {
        await updateTextStyle(id, style)
      } catch (error) {
        console.error('[CanvasContext] Failed to update style:', error)
      }
    },
    [isAdmin, user, blocks]
  )

  const removeBlock = useCallback(
    async (id: string): Promise<void> => {
      const block = blocks.find((b) => b.id === id)
      if (!block) return
      const isOwnBlock = user && block.createdBy === user.uid
      const isReported = (block.reportedBy?.length ?? 0) > 0
      const canDelete = isOwnBlock || (isAdmin && isReported)
      if (!canDelete) return
      try {
        // Record history BEFORE deleting
        recordHistory('delete', [id], { deletedBlocks: [block] })
        const reason = isOwnBlock ? 'self' : 'admin'
        await logDeletion(block, reason, user!.uid)
        await deleteBlock(id)
        if (selectedBlockId === id) {
          setSelectedBlockId(null)
        }
      } catch (error) {
        console.error('[CanvasContext] Failed to remove block:', error)
      }
    },
    [isAdmin, user, blocks, selectedBlockId, recordHistory]
  )

  // Batch delete multiple blocks with a single history entry (for multi-select Delete key)
  const removeBlocks = useCallback(
    async (ids: string[]): Promise<void> => {
      if (!user) return
      const deletableBlocks = ids
        .map(id => blocks.find(b => b.id === id))
        .filter((b): b is CanvasBlock => {
          if (!b) return false
          const isOwnBlock = b.createdBy === user.uid
          const isReported = (b.reportedBy?.length ?? 0) > 0
          return isOwnBlock || (isAdmin && isReported)
        })

      if (deletableBlocks.length === 0) return

      try {
        // One history entry for the entire batch
        recordHistory('delete', deletableBlocks.map(b => b.id), { deletedBlocks: deletableBlocks })

        await Promise.all(
          deletableBlocks.map(async (block) => {
            const reason = block.createdBy === user.uid ? 'self' : 'admin'
            await logDeletion(block, reason, user.uid)
            await deleteBlock(block.id)
          })
        )

        // Clear selection for deleted blocks
        if (selectedBlockId && ids.includes(selectedBlockId)) {
          setSelectedBlockId(null)
        }
      } catch (error) {
        console.error('[CanvasContext] Failed to remove blocks:', error)
      }
    },
    [isAdmin, user, blocks, selectedBlockId, recordHistory]
  )

  const bringBlockToFront = useCallback(
    async (id: string): Promise<void> => {
      if (!isAdmin) return
      try {
        await bringToFront(id, blocks)
      } catch (error) {
        console.error('[CanvasContext] Failed to bring to front:', error)
      }
    },
    [isAdmin, blocks]
  )

  const sendBlockToBack = useCallback(
    async (id: string): Promise<void> => {
      if (!isAdmin) return
      try {
        await sendToBack(id, blocks)
      } catch (error) {
        console.error('[CanvasContext] Failed to send to back:', error)
      }
    },
    [isAdmin, blocks]
  )

  // Voting - any logged-in user can vote
  const vote = useCallback(
    async (id: string, direction: 'up' | 'down'): Promise<boolean> => {
      if (!user) return false
      try {
        const block = blocks.find(b => b.id === id)
        if (!block) return false

        // Test mode: skip actual voting, just trigger random celebration on upvote
        if (effectsSettings.testMode && direction === 'up') {
          const effect = getRandomEffect(effectsSettings)
          setCelebratingBlockId(id)
          setCelebratingEffect(effect)
          return false
        }

        // We must detect no-ops BEFORE recordHistory because recordHistory pushes
        // synchronously. If we recorded first and checked voteBrightness (async) after,
        // the user could Ctrl+Z during the await and undo a phantom entry.
        // No-op detection (mirrors voteBrightness logic to avoid junk history entries)
        const votedUp = block.votersUp?.includes(user.uid) ?? false
        const votedDown = block.votersDown?.includes(user.uid) ?? false
        const isLegacy = (block.voters?.includes(user.uid) ?? false) && !votedUp && !votedDown
        const isNoOp = (direction === 'up' && votedUp) || (direction === 'down' && votedDown) || isLegacy

        if (!isNoOp) {
          // Will this vote delete the block?
          const isUnvote = (direction === 'up' && votedDown) || (direction === 'down' && votedUp)
          const wouldDelete = !isUnvote && direction === 'down' &&
            (block.brightness ?? 50) <= VOTE_BRIGHTNESS_CHANGE
          recordHistory('vote', [id], {
            deletedBlocks: wouldDelete ? [{ ...block }] : undefined,
          })
        }

        const wasDeleted = await voteBrightness(id, user.uid, direction)
        if (wasDeleted) {
          await logDeletion(block, 'vote', user.uid)
          if (selectedBlockId === id) {
            setSelectedBlockId(null)
          }
        } else if (direction === 'up' && !isNoOp) {
          // Trigger one-shot celebration for the voter
          const effect = getCelebrationEffect(id, effectsSettings)
          setCelebratingBlockId(id)
          setCelebratingEffect(effect)
        }
        return wasDeleted
      } catch (error) {
        console.error('[CanvasContext] Failed to vote:', error)
        return false
      }
    },
    [user, blocks, selectedBlockId, recordHistory, effectsSettings]
  )

  const clearCelebration = useCallback(() => {
    setCelebratingBlockId(null)
    setCelebratingEffect(null)
  }, [])

  // Toggle report on a block
  const report = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return
      try {
        const block = blocks.find((b) => b.id === id)
        if (!block) return
        const alreadyReported = block.reportedBy?.includes(user.uid) ?? false
        if (alreadyReported) {
          await unreportBlockStorage(id, user.uid)
          removeReportEntry(id, user.uid).catch((err) =>
            console.warn('[CanvasContext] Failed to remove report entry:', err)
          )
        } else {
          await reportBlockStorage(id, user.uid)
          await logDeletion(block, 'report', user.uid)
        }
      } catch (error) {
        console.error('[CanvasContext] Failed to toggle report:', error)
      }
    },
    [user, blocks]
  )

  // Admin: dismiss all reports on a block (moves reporters to dismissedReporters)
  const dismissReport = useCallback(
    async (id: string): Promise<void> => {
      if (!isAdmin) return
      try {
        const block = blocks.find((b) => b.id === id)
        if (!block) return
        const reporters = block.reportedBy ?? []
        await dismissReportsStorage(id, reporters)
        // Remove all report entries from history feed
        removeAllReportEntries(id).catch((err) =>
          console.warn('[CanvasContext] Failed to remove report entries:', err)
        )
      } catch (error) {
        console.error('[CanvasContext] Failed to dismiss reports:', error)
      }
    },
    [isAdmin, blocks]
  )

  return (
    <CanvasContext.Provider
      value={{
        blocks,
        canAddText,
        selectedBlockId,
        selectedBlockIds,
        isEditing,
        isAddTextMode,
        isGroupDragging,
        canvasRef,
        canvasHeightPercent,
        setCanvasHeightPercent,
        loading,
        measurementDebugConfig,
        setMeasurementDebugConfig,
        selectBlock,
        selectBlocks,
        setIsEditing,
        setIsAddTextMode,
        setIsGroupDragging,
        addText,
        moveBlock,
        moveBlocks,
        resizeBlock,
        updateContent,
        updateStyle,
        removeBlock,
        removeBlocks,
        bringBlockToFront,
        sendBlockToBack,
        vote,
        celebratingBlockId,
        celebratingEffect,
        clearCelebration,
        report,
        dismissReport,
        recordHistory,
        undo,
        redo,
        canUndo,
        canRedo,
        clipboard,
        copyBlocks,
        pasteBlocks,
      }}
    >
      {children}
    </CanvasContext.Provider>
  )
}

export function useCanvas() {
  const context = useContext(CanvasContext)
  if (context === undefined) {
    throw new Error('useCanvas must be used within a CanvasProvider')
  }
  return context
}
