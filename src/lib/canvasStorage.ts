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
  getDoc,
  getDocs,
} from 'firebase/firestore'
import { getDb } from './firebase'
import {
  CanvasBlock,
  TextBlock,
  DEFAULT_TEXT_STYLE,
  DEFAULT_BRIGHTNESS,
  VOTE_BRIGHTNESS_CHANGE,
  getRandomColor,
} from '@/types/canvas'
import { arrayUnion } from 'firebase/firestore'

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
  createdBy: string,
  content: string = '',
  maxZIndex: number = 0
): Promise<string> {
  const db = getDb()
  const now = Date.now()

  const block: Omit<TextBlock, 'id'> = {
    type: 'text',
    x,
    y,
    width: 0, // auto width - fits content
    height: 0, // auto height
    zIndex: maxZIndex + 1,
    content,
    style: { ...DEFAULT_TEXT_STYLE, color: getRandomColor() },
    createdBy,
    brightness: DEFAULT_BRIGHTNESS,
    voters: [],
    createdAt: now,
    updatedAt: now,
  }

  const docRef = await addDoc(collection(db, COLLECTION_NAME), block)
  return docRef.id
}

// Vote on a block (brightness-based)
// Space = brighten (+), Alt = dim (-)
// Returns true if block was deleted (brightness hit 0)
export async function voteBrightness(
  id: string,
  odId: string,
  direction: 'up' | 'down'
): Promise<boolean> {
  const db = getDb()
  const docRef = doc(db, COLLECTION_NAME, id)

  // Get current block data
  const docSnap = await getDoc(docRef)
  if (!docSnap.exists()) return false

  const block = docSnap.data() as TextBlock

  // Check if user already voted
  if (block.voters?.includes(odId)) {
    return false // Already voted
  }

  // Calculate new brightness
  const change = direction === 'up' ? VOTE_BRIGHTNESS_CHANGE : -VOTE_BRIGHTNESS_CHANGE
  const newBrightness = Math.max(0, Math.min(100, (block.brightness ?? DEFAULT_BRIGHTNESS) + change))

  // If brightness hits 0, delete the block
  if (newBrightness <= 0) {
    await deleteDoc(docRef)
    return true // Block was deleted
  }

  // Update brightness and add voter
  await updateDoc(docRef, {
    brightness: newBrightness,
    voters: arrayUnion(odId),
    updatedAt: Date.now(),
  })

  return false
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

// Reset brightness for all blocks to default (admin only)
export async function resetAllBrightness(): Promise<number> {
  const db = getDb()
  const snapshot = await getDocs(collection(db, COLLECTION_NAME))

  const promises: Promise<void>[] = []
  snapshot.forEach((docSnapshot) => {
    promises.push(
      updateDoc(doc(db, COLLECTION_NAME, docSnapshot.id), {
        brightness: DEFAULT_BRIGHTNESS,
        voters: [],
        updatedAt: Date.now(),
      })
    )
  })

  await Promise.all(promises)
  return snapshot.size
}
