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
import { CanvasBlock, TextBlock, DEFAULT_TEXT_STYLE } from '@/types/canvas'
import { arrayUnion, arrayRemove } from 'firebase/firestore'

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

// Toggle whether a block is voteable
export async function toggleBlockVoteable(
  id: string,
  voteable: boolean
): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    voteable,
    // Initialize vote arrays if enabling
    ...(voteable ? { upvotes: [], downvotes: [] } : {}),
    updatedAt: Date.now(),
  })
}

// Vote on a block (upvote or downvote)
export async function voteOnBlock(
  id: string,
  odId: string,
  voteType: 'up' | 'down'
): Promise<void> {
  const db = getDb()
  const docRef = doc(db, COLLECTION_NAME, id)

  if (voteType === 'up') {
    // Remove from downvotes, add to upvotes
    await updateDoc(docRef, {
      upvotes: arrayUnion(odId),
      downvotes: arrayRemove(odId),
      updatedAt: Date.now(),
    })
  } else {
    // Remove from upvotes, add to downvotes
    await updateDoc(docRef, {
      downvotes: arrayUnion(odId),
      upvotes: arrayRemove(odId),
      updatedAt: Date.now(),
    })
  }
}

// Remove vote from a block
export async function removeBlockVote(
  id: string,
  odId: string
): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    upvotes: arrayRemove(odId),
    downvotes: arrayRemove(odId),
    updatedAt: Date.now(),
  })
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
