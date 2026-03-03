'use client'

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
  getDocs,
} from 'firebase/firestore'
import { getDb } from '../firebase'

const COLLECTION_NAME = 'emailHistory'

export type EmailTemplateId = 'campaign-success' | 'campaign-ended' | 'campaign-update' | 'test'

export interface EmailHistoryEntry {
  id: string
  templateId: EmailTemplateId
  sentAt: number
  sentBy: string           // admin UID
  recipientCount: number
  recipients: string[]     // email addresses
  variables: Record<string, string>
  status: 'success' | 'partial' | 'failed'
  errorMessage?: string
}

/**
 * Log an email send to history
 */
export async function logEmailSend(
  entry: Omit<EmailHistoryEntry, 'id'>
): Promise<string> {
  const db = getDb()
  const docRef = await addDoc(collection(db, COLLECTION_NAME), entry)
  return docRef.id
}

/**
 * Subscribe to recent email history with real-time updates
 */
export function subscribeToEmailHistory(
  callback: (entries: EmailHistoryEntry[]) => void,
  maxEntries: number = 10,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('sentAt', 'desc'),
      limit(maxEntries)
    )

    return onSnapshot(
      q,
      (snapshot) => {
        const entries: EmailHistoryEntry[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as EmailHistoryEntry))
        callback(entries)
      },
      (error) => {
        console.error('[emailHistoryStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[emailHistoryStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}

/**
 * Get recent email history (one-time fetch)
 */
export async function getRecentEmailHistory(
  maxEntries: number = 10
): Promise<EmailHistoryEntry[]> {
  const db = getDb()
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('sentAt', 'desc'),
    limit(maxEntries)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  } as EmailHistoryEntry))
}

/**
 * Format relative time for display
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return new Date(timestamp).toLocaleDateString()
}

/**
 * Get template display name
 */
export function getTemplateDisplayName(templateId: EmailTemplateId): string {
  const names: Record<EmailTemplateId, string> = {
    'campaign-success': 'Campaign Success',
    'campaign-ended': 'Campaign Ended',
    'campaign-update': 'Campaign Update',
    'test': 'Test Email'
  }
  return names[templateId] || templateId
}
