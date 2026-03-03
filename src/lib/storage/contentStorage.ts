'use client'

import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../firebase'

const COLLECTION_NAME = 'siteContent'

export interface ContentEntry {
  id: string
  value: string
  category: string
  description?: string
  updatedAt: number
  updatedBy: string
}

// Subscribe to all site content with real-time updates
export function subscribeToContent(
  callback: (content: Map<string, ContentEntry>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()

    return onSnapshot(
      collection(db, COLLECTION_NAME),
      (snapshot) => {
        const contentMap = new Map<string, ContentEntry>()
        snapshot.docs.forEach((doc) => {
          const data = doc.data() as Omit<ContentEntry, 'id'>
          contentMap.set(doc.id, { id: doc.id, ...data })
        })
        callback(contentMap)
      },
      (error) => {
        console.error('[contentStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[contentStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}

// Update or create content entry
export async function updateContent(
  id: string,
  value: string,
  category: string,
  updatedBy: string,
  description?: string
): Promise<void> {
  console.log('[contentStorage] updateContent called:', { id, value, category, updatedBy })

  try {
    const db = getDb()
    console.log('[contentStorage] Got db instance, writing to collection:', COLLECTION_NAME)

    const docRef = doc(db, COLLECTION_NAME, id)
    const data = {
      value,
      category,
      description: description || null,
      updatedAt: Date.now(),
      updatedBy,
    }

    console.log('[contentStorage] Writing document:', { docRef: docRef.path, data })
    await setDoc(docRef, data)
    console.log('[contentStorage] ✓ Write successful')
  } catch (error) {
    console.error('[contentStorage] ✗ Write failed:', error)
    throw error
  }
}
