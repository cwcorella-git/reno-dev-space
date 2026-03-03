'use client'

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
  getDoc,
  getDocs,
  where,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore'
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { getDb, getStorageClient } from '../firebase'
import {
  RentalProperty,
  DEFAULT_BRIGHTNESS,
  VOTE_BRIGHTNESS_CHANGE,
  ARCHIVE_THRESHOLD,
} from '@/types/property'

const COLLECTION_NAME = 'rentalProperties'

/**
 * Subscribe to all rental properties with real-time updates
 */
export function subscribeToProperties(
  callback: (properties: RentalProperty[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    )

    return onSnapshot(
      q,
      (snapshot) => {
        const properties = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RentalProperty[]
        callback(properties)
      },
      (error) => {
        console.error('[propertyStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[propertyStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {} // Return empty unsubscribe function
  }
}

/**
 * Upload property image to Firebase Storage
 */
async function uploadPropertyImage(file: File, propertyId: string): Promise<string> {
  const storage = getStorageClient()
  const storageRef = ref(storage, `properties/${propertyId}/main.jpg`)

  await uploadBytes(storageRef, file)
  return await getDownloadURL(storageRef)
}

/**
 * Add a new rental property
 */
export async function addProperty(
  imageFile: File,
  address: string,
  cost: number | null,
  description: string,
  createdBy: string,
  phone?: string | null,
  companyName?: string | null
): Promise<string> {
  const db = getDb()
  const now = Date.now()

  // Generate property ID first (so we can use it for storage path)
  const propertyRef = doc(collection(db, COLLECTION_NAME))
  const propertyId = propertyRef.id

  // Upload image to Firebase Storage
  const imageUrl = await uploadPropertyImage(imageFile, propertyId)
  const imageStoragePath = `properties/${propertyId}/main.jpg`

  const property: Omit<RentalProperty, 'id'> = {
    imageUrl,
    imageStoragePath,
    address,
    cost,
    description,
    phone: phone || null,
    companyName: companyName || null,
    brightness: DEFAULT_BRIGHTNESS,
    voters: [],
    votersUp: [],
    votersDown: [],
    createdBy,
    createdAt: now,
    updatedAt: now,
  }

  await setDoc(propertyRef, property)
  return propertyId
}

/**
 * Vote on a property (brightness-based with toggle support)
 * Returns true if property was archived (brightness ≤ 20)
 */
export async function voteProperty(
  id: string,
  userId: string,
  direction: 'up' | 'down'
): Promise<boolean> {
  const db = getDb()
  const docRef = doc(db, COLLECTION_NAME, id)

  // Get current property data
  const docSnap = await getDoc(docRef)
  if (!docSnap.exists()) return false

  const property = docSnap.data() as RentalProperty

  const votedUp = property.votersUp?.includes(userId) ?? false
  const votedDown = property.votersDown?.includes(userId) ?? false
  const inLegacyVoters = property.voters?.includes(userId) ?? false

  // Legacy voter (in voters but not in votersUp/votersDown) — no-op (can't toggle unknown direction)
  if (inLegacyVoters && !votedUp && !votedDown) {
    return false
  }

  // Already voted this direction — NO-OP (can only neutralize by voting opposite)
  if ((direction === 'up' && votedUp) || (direction === 'down' && votedDown)) {
    return false
  }

  // Voted the other direction — NEUTRALIZE (remove vote, back to zero)
  if ((direction === 'up' && votedDown) || (direction === 'down' && votedUp)) {
    // Remove existing vote (reverse its effect to return to neutral)
    const reverseChange = votedDown ? VOTE_BRIGHTNESS_CHANGE : -VOTE_BRIGHTNESS_CHANGE
    const newBrightness = Math.max(0, Math.min(100, (property.brightness ?? DEFAULT_BRIGHTNESS) + reverseChange))

    await updateDoc(docRef, {
      brightness: newBrightness,
      voters: arrayRemove(userId),
      ...(votedUp ? { votersUp: arrayRemove(userId) } : { votersDown: arrayRemove(userId) }),
      updatedAt: Date.now(),
    })
    return newBrightness <= ARCHIVE_THRESHOLD
  }

  // New vote (first time voting on this property)
  const change = direction === 'up' ? VOTE_BRIGHTNESS_CHANGE : -VOTE_BRIGHTNESS_CHANGE
  const newBrightness = Math.max(0, Math.min(100, (property.brightness ?? DEFAULT_BRIGHTNESS) + change))

  // Update brightness and add voter
  await updateDoc(docRef, {
    brightness: newBrightness,
    voters: arrayUnion(userId),
    ...(direction === 'up' ? { votersUp: arrayUnion(userId) } : { votersDown: arrayUnion(userId) }),
    updatedAt: Date.now(),
  })

  return newBrightness <= ARCHIVE_THRESHOLD
}

/**
 * Delete a property (admin or creator)
 */
export async function deleteProperty(id: string): Promise<void> {
  const db = getDb()
  const storage = getStorageClient()

  // Get property data to find storage path
  const docRef = doc(db, COLLECTION_NAME, id)
  const docSnap = await getDoc(docRef)

  if (docSnap.exists()) {
    const property = docSnap.data() as RentalProperty

    // Delete image from Storage
    if (property.imageStoragePath) {
      try {
        const storageRef = ref(storage, property.imageStoragePath)
        await deleteObject(storageRef)
      } catch (error) {
        console.error('[propertyStorage] Failed to delete image:', error)
        // Continue with Firestore deletion even if Storage deletion fails
      }
    }

    // Delete Firestore document
    await deleteDoc(docRef)
  }
}

/**
 * Report a property (adds user to reportedBy array)
 */
export async function reportProperty(id: string, userId: string): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    reportedBy: arrayUnion(userId),
    updatedAt: Date.now(),
  })
}

/**
 * Unreport a property (removes user from reportedBy array)
 */
export async function unreportProperty(id: string, userId: string): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    reportedBy: arrayRemove(userId),
    updatedAt: Date.now(),
  })
}

/**
 * Dismiss all reports on a property (admin action)
 */
export async function dismissPropertyReports(id: string, reportedByUsers: string[]): Promise<void> {
  if (reportedByUsers.length === 0) return
  const db = getDb()
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    reportedBy: [],
    dismissedReporters: arrayUnion(...reportedByUsers),
    updatedAt: Date.now(),
  })
}

/**
 * Delete all properties created by a user (cascade deletion)
 */
export async function deleteUserProperties(userId: string): Promise<number> {
  const db = getDb()
  const q = query(collection(db, COLLECTION_NAME), where('createdBy', '==', userId))
  const snapshot = await getDocs(q)

  const promises: Promise<void>[] = []
  snapshot.forEach((docSnapshot) => {
    promises.push(deleteProperty(docSnapshot.id))
  })

  await Promise.all(promises)
  return snapshot.size
}

/**
 * Clear a user's votes from all properties (for account deletion)
 */
export async function clearUserPropertyVotes(userId: string): Promise<number> {
  const db = getDb()
  const snapshot = await getDocs(collection(db, COLLECTION_NAME))

  const promises: Promise<void>[] = []
  snapshot.forEach((docSnapshot) => {
    const property = docSnapshot.data() as RentalProperty

    // Check if user has voted
    const votedUp = property.votersUp?.includes(userId) ?? false
    const votedDown = property.votersDown?.includes(userId) ?? false
    const inLegacyVoters = property.voters?.includes(userId) ?? false

    if (votedUp || votedDown || inLegacyVoters) {
      // Reverse brightness change if we know the direction
      const updates: Record<string, unknown> = {
        voters: arrayRemove(userId),
        updatedAt: Date.now(),
      }

      if (votedUp) {
        updates.votersUp = arrayRemove(userId)
        updates.brightness = increment(-VOTE_BRIGHTNESS_CHANGE)
      }
      if (votedDown) {
        updates.votersDown = arrayRemove(userId)
        updates.brightness = increment(VOTE_BRIGHTNESS_CHANGE)
      }

      promises.push(updateDoc(doc(db, COLLECTION_NAME, docSnapshot.id), updates))
    }
  })

  await Promise.all(promises)
  return promises.length
}
