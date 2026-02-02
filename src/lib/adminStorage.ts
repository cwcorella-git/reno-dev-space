'use client'

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from './firebase'

const COLLECTION_NAME = 'admins'

export function subscribeToAdmins(
  callback: (adminEmails: Set<string>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()

    return onSnapshot(
      collection(db, COLLECTION_NAME),
      (snapshot) => {
        const emails = new Set<string>()
        snapshot.docs.forEach((doc) => {
          emails.add(doc.id)
        })
        callback(emails)
      },
      (error) => {
        console.error('[adminStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[adminStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}

export async function addAdmin(email: string): Promise<void> {
  const db = getDb()
  const key = email.toLowerCase()
  await setDoc(doc(db, COLLECTION_NAME, key), {
    email: key,
    addedAt: Date.now(),
  })
}

export async function removeAdmin(email: string): Promise<void> {
  const db = getDb()
  const key = email.toLowerCase()
  await deleteDoc(doc(db, COLLECTION_NAME, key))
}
