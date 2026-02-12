import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { getDb } from '../firebase'

const COLLECTION_NAME = 'settings'
const DOCUMENT_ID = 'propertyGallery'

export interface PropertyGalleryPosition {
  x: number         // percentage 0-100 (centered in mobile zone)
  y: number         // percentage 0-100 (relative to canvas height)
  updatedAt: number
  updatedBy: string
}

export const DEFAULT_POSITION: PropertyGalleryPosition = {
  x: 38.2,  // 340px gallery centered in 375px mobile zone: (720-170)/1440*100
  y: 66.7,  // Two-thirds down canvas
  updatedAt: Date.now(),
  updatedBy: ''
}

/**
 * Subscribe to real-time gallery position updates from Firestore
 * @param callback - Called with position data whenever it changes
 * @param onError - Optional error handler
 * @returns Unsubscribe function to stop listening
 */
export function subscribeToGalleryPosition(
  callback: (position: PropertyGalleryPosition) => void,
  onError?: (error: Error) => void
): () => void {
  const db = getDb()
  const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID)

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as PropertyGalleryPosition)
      } else {
        // Document doesn't exist yet, use default
        callback(DEFAULT_POSITION)
      }
    },
    onError
  )
}

/**
 * Migrate old gallery positions to new coordinate system (admin-only, one-time)
 * Old system used x=21.9% (incorrect calculation)
 * New system uses x=38.2% (properly centered in 375px mobile zone)
 */
export async function migrateGalleryPositionIfNeeded(userId: string): Promise<void> {
  const db = getDb()
  const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID)

  const snapshot = await getDoc(docRef)
  if (snapshot.exists()) {
    const position = snapshot.data() as PropertyGalleryPosition

    // Only migrate if position is using old coordinate system
    if (position.x < 35) {
      console.log('[PropertyGallery] Migrating old position from', position.x, 'to', DEFAULT_POSITION.x)
      await setDoc(docRef, {
        ...position,
        x: DEFAULT_POSITION.x,
        updatedAt: Date.now(),
        updatedBy: userId,
      })
    }
  }
}

/**
 * Update the gallery position in Firestore (admin-only)
 * @param x - X position percentage (0-100)
 * @param y - Y position percentage (0-100)
 * @param updatedBy - UID of admin who moved the gallery
 */
export async function updateGalleryPosition(
  x: number,
  y: number,
  updatedBy: string
): Promise<void> {
  const db = getDb()
  const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID)

  await setDoc(docRef, {
    x,
    y,
    updatedAt: Date.now(),
    updatedBy,
  })
}
