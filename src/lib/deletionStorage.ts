'use client'

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from './firebase'
import { CanvasBlock } from '@/types/canvas'

const COLLECTION_NAME = 'deletedBlocks'

export type DeletionReason = 'self' | 'admin' | 'vote' | 'cascade'

export interface DeletionEntry {
  id: string
  originalId: string
  block: CanvasBlock
  reason: DeletionReason
  deletedBy: string
  deletedAt: number
}

export async function logDeletion(
  block: CanvasBlock,
  reason: DeletionReason,
  deletedBy: string
): Promise<void> {
  const db = getDb()
  await addDoc(collection(db, COLLECTION_NAME), {
    originalId: block.id,
    block: { ...block },
    reason,
    deletedBy,
    deletedAt: Date.now(),
  })
}

export function subscribeToDeletions(
  callback: (entries: DeletionEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()

    return onSnapshot(
      query(collection(db, COLLECTION_NAME), orderBy('deletedAt', 'desc')),
      (snapshot) => {
        const entries: DeletionEntry[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<DeletionEntry, 'id'>),
        }))
        callback(entries)
      },
      (error) => {
        console.error('[deletionStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[deletionStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}
