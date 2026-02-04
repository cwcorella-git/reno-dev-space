'use client'

import {
  collection,
  doc,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
  arrayRemove,
} from 'firebase/firestore'
import { deleteUser } from 'firebase/auth'
import { getDb, getAuth } from '../firebase'
import { increment } from 'firebase/firestore'
import { VOTE_BRIGHTNESS_CHANGE, DEFAULT_BRIGHTNESS, CanvasBlock } from '@/types/canvas'
import { logDeletion } from './deletionStorage'

const BLOCKS_COLLECTION = 'canvasBlocks'
const USERS_COLLECTION = 'users'
const PLEDGES_COLLECTION = 'pledges'
const CHAT_COLLECTION = 'chatMessages'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  bio?: string
  createdAt: number
}

export interface UserStats {
  blocksCreated: number
  votesGiven: number
  pledgeAmount: number
}

// Subscribe to all users (for admin panel)
export function subscribeToUsers(
  callback: (users: UserProfile[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    const q = query(collection(db, USERS_COLLECTION))

    return onSnapshot(
      q,
      (snapshot) => {
        const users = snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        })) as UserProfile[]
        callback(users)
      },
      (error) => {
        console.error('[userStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[userStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}

// Get user stats (blocks created, votes given, pledge amount)
export async function getUserStats(uid: string): Promise<UserStats> {
  const db = getDb()

  // Count blocks created by user
  const blocksQuery = query(
    collection(db, BLOCKS_COLLECTION),
    where('createdBy', '==', uid)
  )
  const blocksSnapshot = await getDocs(blocksQuery)
  const blocksCreated = blocksSnapshot.size

  // Count votes given (blocks where user is in voters array)
  const allBlocksSnapshot = await getDocs(collection(db, BLOCKS_COLLECTION))
  let votesGiven = 0
  allBlocksSnapshot.forEach((doc) => {
    const data = doc.data()
    if (data.voters?.includes(uid)) {
      votesGiven++
    }
  })

  // Get pledge amount
  let pledgeAmount = 0
  const pledgeDoc = await getDoc(doc(db, PLEDGES_COLLECTION, uid))
  if (pledgeDoc.exists()) {
    pledgeAmount = pledgeDoc.data().amount || 0
  }

  return { blocksCreated, votesGiven, pledgeAmount }
}

// Clear all votes by user (remove from voter arrays AND reverse brightness)
export async function clearUserVotes(uid: string): Promise<number> {
  const db = getDb()
  const blocksSnapshot = await getDocs(collection(db, BLOCKS_COLLECTION))

  let clearedCount = 0
  const promises: Promise<void>[] = []

  blocksSnapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data()
    const inVotersUp = data.votersUp?.includes(uid)
    const inVotersDown = data.votersDown?.includes(uid)
    const inLegacyOnly = data.voters?.includes(uid) && !inVotersUp && !inVotersDown

    if (inVotersUp || inVotersDown || inLegacyOnly) {
      clearedCount++

      // Reverse the brightness change if we know the direction
      let brightnessAdj = 0
      if (inVotersUp) brightnessAdj = -VOTE_BRIGHTNESS_CHANGE   // undo an upvote
      else if (inVotersDown) brightnessAdj = VOTE_BRIGHTNESS_CHANGE  // undo a downvote
      // Legacy voters (no direction info) — can't reverse, leave brightness as-is

      const update: Record<string, unknown> = {
        voters: arrayRemove(uid),
        votersUp: arrayRemove(uid),
        votersDown: arrayRemove(uid),
      }
      if (brightnessAdj !== 0) {
        update.brightness = increment(brightnessAdj)
      }

      promises.push(
        updateDoc(doc(db, BLOCKS_COLLECTION, docSnapshot.id), update)
      )
    }
  })

  await Promise.all(promises)
  return clearedCount
}

// Delete all blocks created by user
export async function deleteUserBlocks(uid: string): Promise<number> {
  const db = getDb()
  const blocksQuery = query(
    collection(db, BLOCKS_COLLECTION),
    where('createdBy', '==', uid)
  )
  const blocksSnapshot = await getDocs(blocksQuery)

  // Log each deletion to history before deleting
  const logPromises: Promise<void>[] = []
  blocksSnapshot.forEach((docSnapshot) => {
    const block = { id: docSnapshot.id, ...docSnapshot.data() } as CanvasBlock
    logPromises.push(logDeletion(block, 'cascade', uid))
  })
  await Promise.all(logPromises)

  const promises: Promise<void>[] = []
  blocksSnapshot.forEach((docSnapshot) => {
    promises.push(deleteDoc(doc(db, BLOCKS_COLLECTION, docSnapshot.id)))
  })

  await Promise.all(promises)
  return blocksSnapshot.size
}

// Delete all chat messages by user
export async function deleteUserMessages(uid: string): Promise<number> {
  const db = getDb()
  const messagesQuery = query(
    collection(db, CHAT_COLLECTION),
    where('odId', '==', uid)
  )
  const messagesSnapshot = await getDocs(messagesQuery)

  const promises: Promise<void>[] = []
  messagesSnapshot.forEach((docSnapshot) => {
    promises.push(deleteDoc(doc(db, CHAT_COLLECTION, docSnapshot.id)))
  })

  await Promise.all(promises)
  return messagesSnapshot.size
}

// Delete user's pledge
export async function deleteUserPledge(uid: string): Promise<void> {
  const db = getDb()
  const pledgeRef = doc(db, PLEDGES_COLLECTION, uid)
  const pledgeDoc = await getDoc(pledgeRef)
  if (pledgeDoc.exists()) {
    await deleteDoc(pledgeRef)
  }
}

// Full account deletion (self-delete)
export async function deleteUserAccount(uid: string): Promise<{
  votesCleared: number
  blocksDeleted: number
  messagesDeleted: number
}> {
  const db = getDb()
  const auth = getAuth()

  // 1. Clear votes
  const votesCleared = await clearUserVotes(uid)

  // 2. Delete blocks
  const blocksDeleted = await deleteUserBlocks(uid)

  // 3. Delete messages
  const messagesDeleted = await deleteUserMessages(uid)

  // 4. Delete pledge
  await deleteUserPledge(uid)

  // 5. Delete user profile from Firestore
  await deleteDoc(doc(db, USERS_COLLECTION, uid))

  // 6. Delete Firebase Auth user (must be done by the user themselves)
  if (auth.currentUser && auth.currentUser.uid === uid) {
    await deleteUser(auth.currentUser)
  }

  return { votesCleared, blocksDeleted, messagesDeleted }
}

// Admin delete user (cascade but no auth deletion - user will be locked out)
export async function adminDeleteUser(uid: string): Promise<{
  votesCleared: number
  blocksDeleted: number
  messagesDeleted: number
}> {
  const db = getDb()

  // 1. Clear votes
  const votesCleared = await clearUserVotes(uid)

  // 2. Delete blocks
  const blocksDeleted = await deleteUserBlocks(uid)

  // 3. Delete messages
  const messagesDeleted = await deleteUserMessages(uid)

  // 4. Delete pledge
  await deleteUserPledge(uid)

  // 5. Delete user profile from Firestore
  await deleteDoc(doc(db, USERS_COLLECTION, uid))

  // Note: Firebase Auth user remains but profile is gone
  // They can't do anything without a profile, and if banned they can't re-sign up

  return { votesCleared, blocksDeleted, messagesDeleted }
}
