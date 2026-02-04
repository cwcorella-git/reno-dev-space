'use client'

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../firebase'

const COLLECTION_NAME = 'blockEdits'

export interface EditHistoryEntry {
  id: string
  blockId: string
  content: string       // content BEFORE the edit
  editedBy: string
  editedAt: number
}

export async function logContentEdit(
  blockId: string,
  beforeContent: string,
  editedBy: string
): Promise<void> {
  if (!beforeContent?.trim()) return

  const db = getDb()
  await addDoc(collection(db, COLLECTION_NAME), {
    blockId,
    content: beforeContent,
    editedBy,
    editedAt: Date.now(),
  })
}

export function subscribeToBlockEdits(
  blockId: string,
  callback: (entries: EditHistoryEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    const q = query(
      collection(db, COLLECTION_NAME),
      where('blockId', '==', blockId),
      orderBy('editedAt', 'desc')
    )

    return onSnapshot(
      q,
      (snapshot) => {
        const entries: EditHistoryEntry[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<EditHistoryEntry, 'id'>),
        }))
        callback(entries)
      },
      (error) => {
        console.error('[editHistoryStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[editHistoryStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}
