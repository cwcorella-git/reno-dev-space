import { doc, setDoc, deleteDoc, onSnapshot, query, collection, where, Timestamp, serverTimestamp } from 'firebase/firestore'
import { getDb } from '../firebase'

const COLLECTION_NAME = 'presence'

export interface PresenceData {
  userId: string
  displayName: string
  cursorX: number // percentage 0-100
  cursorY: number // percentage 0-100
  lastSeen: Timestamp
}

/**
 * Update or create presence for the current user
 * Should be throttled (200ms) to avoid excessive writes
 */
export async function updatePresence(
  userId: string,
  displayName: string,
  cursorX: number,
  cursorY: number
): Promise<void> {
  const db = getDb()
  const docRef = doc(db, COLLECTION_NAME, userId)

  await setDoc(docRef, {
    userId,
    displayName,
    cursorX,
    cursorY,
    lastSeen: serverTimestamp(),
  })
}

/**
 * Remove presence when user disconnects or goes inactive
 */
export async function removePresence(userId: string): Promise<void> {
  const db = getDb()
  const docRef = doc(db, COLLECTION_NAME, userId)
  await deleteDoc(docRef)
}

/**
 * Subscribe to all active presence (excluding current user)
 * Filters out stale presence (>30s old) on the client side
 */
export function subscribeToPresence(
  currentUserId: string,
  onUpdate: (presenceList: PresenceData[]) => void
): () => void {
  const db = getDb()
  const presenceRef = collection(db, COLLECTION_NAME)
  const q = query(presenceRef, where('userId', '!=', currentUserId))

  return onSnapshot(q, (snapshot) => {
    const now = Date.now()
    const TTL_MS = 30000 // 30 seconds

    const activePresence: PresenceData[] = []
    snapshot.forEach((doc) => {
      const data = doc.data() as PresenceData
      // Filter out stale presence (lastSeen is a Firestore Timestamp)
      const lastSeenMs = data.lastSeen?.toMillis() || 0
      if (now - lastSeenMs < TTL_MS) {
        activePresence.push(data)
      }
    })

    onUpdate(activePresence)
  })
}
