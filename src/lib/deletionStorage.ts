'use client'

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from './firebase'
import { CanvasBlock } from '@/types/canvas'

const COLLECTION_NAME = 'deletedBlocks'

export type DeletionReason = 'self' | 'admin' | 'vote' | 'cascade' | 'report'

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
  // Skip empty blocks (e.g. newly created blocks with no content)
  if (!block.content?.trim()) return

  const db = getDb()
  await addDoc(collection(db, COLLECTION_NAME), {
    originalId: block.id,
    block: { ...block },
    reason,
    deletedBy,
    deletedAt: Date.now(),
  })
}

// Delete a history entry permanently
export async function deleteHistoryEntry(entryId: string): Promise<void> {
  const db = getDb()
  await deleteDoc(doc(db, COLLECTION_NAME, entryId))
}

// Remove report entries for a specific block+user from history
export async function removeReportEntry(
  blockId: string,
  reportedBy: string
): Promise<void> {
  const db = getDb()
  // Simpler query: just get all entries for this block, filter in JS
  const q = query(
    collection(db, COLLECTION_NAME),
    where('originalId', '==', blockId)
  )
  const snapshot = await getDocs(q)
  const toDelete = snapshot.docs.filter((d) => {
    const data = d.data()
    return data.reason === 'report' && data.deletedBy === reportedBy
  })
  await Promise.all(toDelete.map((d) => deleteDoc(doc(db, COLLECTION_NAME, d.id))))
}

// Remove ALL report entries for a block (used when admin dismisses)
export async function removeAllReportEntries(blockId: string): Promise<void> {
  const db = getDb()
  const q = query(
    collection(db, COLLECTION_NAME),
    where('originalId', '==', blockId)
  )
  const snapshot = await getDocs(q)
  const toDelete = snapshot.docs.filter((d) => d.data().reason === 'report')
  await Promise.all(toDelete.map((d) => deleteDoc(doc(db, COLLECTION_NAME, d.id))))
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
