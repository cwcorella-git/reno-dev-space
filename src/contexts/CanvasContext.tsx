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
import { CanvasBlock, TextBlock } from '@/types/canvas'

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
} from '@/lib/canvasStorage'
import { useAuth } from './AuthContext'

interface CanvasContextType {
  blocks: CanvasBlock[]
  selectedBlockId: string | null
  selectedBlockIds: string[]
  isEditing: boolean
  canvasRef: RefObject<HTMLDivElement | null>
  loading: boolean

  // Selection
  selectBlock: (id: string | null) => void
  selectBlocks: (ids: string[]) => void
  setIsEditing: (editing: boolean) => void

  // Block operations (admin only)
  addText: (x: number, y: number) => Promise<string | null>
  moveBlock: (id: string, x: number, y: number) => Promise<void>
  moveBlocks: (moves: { id: string; x: number; y: number }[]) => Promise<void>
  resizeBlock: (id: string, width: number, height: number) => Promise<void>
  updateContent: (id: string, content: string) => Promise<void>
  updateStyle: (id: string, style: Partial<TextBlock['style']>) => Promise<void>
  removeBlock: (id: string) => Promise<void>
  bringBlockToFront: (id: string) => Promise<void>
  sendBlockToBack: (id: string) => Promise<void>

  // Voting (any logged-in user)
  vote: (id: string, direction: 'up' | 'down') => Promise<boolean>
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined)

export function CanvasProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth()
  const [blocks, setBlocks] = useState<CanvasBlock[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLDivElement | null>(null)

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

  // Get max z-index for new blocks
  const getMaxZIndex = useCallback(() => {
    return Math.max(...blocks.map((b) => b.zIndex), 0)
  }, [blocks])

  // Admin operations
  const addText = useCallback(
    async (x: number, y: number): Promise<string | null> => {
      if (!isAdmin || !user) return null
      try {
        const id = await addTextBlock(x, y, user.uid, '', getMaxZIndex())
        setSelectedBlockId(id)
        return id
      } catch (error) {
        console.error('[CanvasContext] Failed to add text:', error)
        return null
      }
    },
    [isAdmin, user, getMaxZIndex]
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
        await updateTextContent(id, content)
      } catch (error) {
        console.error('[CanvasContext] Failed to update content:', error)
      }
    },
    [isAdmin]
  )

  const updateStyle = useCallback(
    async (id: string, style: Partial<TextBlock['style']>): Promise<void> => {
      if (!isAdmin) return
      try {
        await updateTextStyle(id, style)
      } catch (error) {
        console.error('[CanvasContext] Failed to update style:', error)
      }
    },
    [isAdmin]
  )

  const removeBlock = useCallback(
    async (id: string): Promise<void> => {
      if (!isAdmin) return
      try {
        await deleteBlock(id)
        if (selectedBlockId === id) {
          setSelectedBlockId(null)
        }
      } catch (error) {
        console.error('[CanvasContext] Failed to remove block:', error)
      }
    },
    [isAdmin, selectedBlockId]
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
        const wasDeleted = await voteBrightness(id, user.uid, direction)
        if (wasDeleted && selectedBlockId === id) {
          setSelectedBlockId(null)
        }
        return wasDeleted
      } catch (error) {
        console.error('[CanvasContext] Failed to vote:', error)
        return false
      }
    },
    [user, selectedBlockId]
  )

  return (
    <CanvasContext.Provider
      value={{
        blocks,
        selectedBlockId,
        selectedBlockIds,
        isEditing,
        canvasRef,
        loading,
        selectBlock,
        selectBlocks,
        setIsEditing,
        addText,
        moveBlock,
        moveBlocks,
        resizeBlock,
        updateContent,
        updateStyle,
        removeBlock,
        bringBlockToFront,
        sendBlockToBack,
        vote,
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
