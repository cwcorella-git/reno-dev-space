'use client'

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from './firebase'
import { CanvasBlock, TextBlock, VoteBlock, DEFAULT_TEXT_STYLE } from '@/types/canvas'

const COLLECTION_NAME = 'canvasBlocks'

// Subscribe to all canvas blocks with real-time updates
export function subscribeToCanvas(
  callback: (blocks: CanvasBlock[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('zIndex', 'asc')
    )

    return onSnapshot(
      q,
      (snapshot) => {
        const blocks = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CanvasBlock[]
        callback(blocks)
      },
      (error) => {
        console.error('[canvasStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[canvasStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {} // Return empty unsubscribe function
  }
}

// Add a new text block
export async function addTextBlock(
  x: number,
  y: number,
  content: string = '',
  maxZIndex: number = 0
): Promise<string> {
  const db = getDb()
  const now = Date.now()

  const block: Omit<TextBlock, 'id'> = {
    type: 'text',
    x,
    y,
    width: 20,
    height: 0, // auto
    zIndex: maxZIndex + 1,
    content,
    style: { ...DEFAULT_TEXT_STYLE },
    createdAt: now,
    updatedAt: now,
  }

  const docRef = await addDoc(collection(db, COLLECTION_NAME), block)
  return docRef.id
}

// Add a new vote block
export async function addVoteBlock(
  x: number,
  y: number,
  proposalId: string,
  maxZIndex: number = 0
): Promise<string> {
  const db = getDb()
  const now = Date.now()

  const block: Omit<VoteBlock, 'id'> = {
    type: 'vote',
    x,
    y,
    width: 25,
    height: 0, // auto
    zIndex: maxZIndex + 1,
    proposalId,
    createdAt: now,
    updatedAt: now,
  }

  const docRef = await addDoc(collection(db, COLLECTION_NAME), block)
  return docRef.id
}

// Update block position
export async function updateBlockPosition(
  id: string,
  x: number,
  y: number
): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    x,
    y,
    updatedAt: Date.now(),
  })
}

// Update block size
export async function updateBlockSize(
  id: string,
  width: number,
  height: number
): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    width,
    height,
    updatedAt: Date.now(),
  })
}

// Update text block content
export async function updateTextContent(
  id: string,
  content: string
): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    content,
    updatedAt: Date.now(),
  })
}

// Update text block style
export async function updateTextStyle(
  id: string,
  style: Partial<TextBlock['style']>
): Promise<void> {
  const db = getDb()

  // Build the update object with dot notation for nested fields
  const updates: Record<string, unknown> = { updatedAt: Date.now() }
  for (const [key, value] of Object.entries(style)) {
    updates[`style.${key}`] = value
  }

  await updateDoc(doc(db, COLLECTION_NAME, id), updates)
}

// Update block z-index
export async function updateBlockZIndex(
  id: string,
  zIndex: number
): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    zIndex,
    updatedAt: Date.now(),
  })
}

// Delete a block
export async function deleteBlock(id: string): Promise<void> {
  const db = getDb()
  await deleteDoc(doc(db, COLLECTION_NAME, id))
}

// Bring block to front (set highest z-index)
export async function bringToFront(
  id: string,
  blocks: CanvasBlock[]
): Promise<void> {
  const maxZ = Math.max(...blocks.map((b) => b.zIndex), 0)
  await updateBlockZIndex(id, maxZ + 1)
}

// Send block to back (set lowest z-index)
export async function sendToBack(
  id: string,
  blocks: CanvasBlock[]
): Promise<void> {
  const minZ = Math.min(...blocks.map((b) => b.zIndex), 0)
  await updateBlockZIndex(id, minZ - 1)
}
