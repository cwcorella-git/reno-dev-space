'use client'

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from './firebase'

const COLLECTION_NAME = 'bannedEmails'

export interface BannedEmailEntry {
  email: string
  bannedAt: number
  bannedBy: string
  reason?: string
}

// Check if an email is banned (for sign-up blocking)
export async function isEmailBanned(email: string): Promise<boolean> {
  const db = getDb()
  const docRef = doc(db, COLLECTION_NAME, email.toLowerCase())
  const docSnap = await getDoc(docRef)
  return docSnap.exists()
}

// Ban an email
export async function banEmail(
  email: string,
  bannedBy: string,
  reason?: string
): Promise<void> {
  const db = getDb()
  const normalizedEmail = email.toLowerCase()
  await setDoc(doc(db, COLLECTION_NAME, normalizedEmail), {
    email: normalizedEmail,
    bannedAt: Date.now(),
    bannedBy,
    reason: reason || 'Banned by admin',
  })
}

// Unban an email
export async function unbanEmail(email: string): Promise<void> {
  const db = getDb()
  await deleteDoc(doc(db, COLLECTION_NAME, email.toLowerCase()))
}

// Subscribe to banned emails list (for admin display)
export function subscribeToBannedEmails(
  callback: (emails: Set<string>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    return onSnapshot(
      collection(db, COLLECTION_NAME),
      (snapshot) => {
        const emails = new Set<string>()
        snapshot.docs.forEach((doc) => {
          emails.add(doc.id.toLowerCase())
        })
        callback(emails)
      },
      (error) => {
        console.error('[bannedEmailsStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[bannedEmailsStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}
