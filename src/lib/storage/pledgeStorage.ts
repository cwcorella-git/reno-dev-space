'use client'

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../firebase'

const PLEDGES_COLLECTION = 'pledges'

export interface Pledge {
  odId: string
  displayName: string
  amount: number
  createdAt: number
  updatedAt: number
}

// Subscribe to all pledges (public, real-time)
export function subscribeToPledges(
  callback: (pledges: Pledge[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    const q = query(collection(db, PLEDGES_COLLECTION))

    return onSnapshot(
      q,
      (snapshot) => {
        const pledges = snapshot.docs.map((doc) => ({
          odId: doc.id,
          ...doc.data(),
        })) as Pledge[]
        callback(pledges)
      },
      (error) => {
        console.error('[pledgeStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[pledgeStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}

// Set or update user's pledge
export async function setPledge(
  uid: string,
  displayName: string,
  amount: number
): Promise<void> {
  const db = getDb()
  const now = Date.now()

  await setDoc(
    doc(db, PLEDGES_COLLECTION, uid),
    {
      odId: uid,
      displayName,
      amount,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  )
}

// Remove user's pledge
export async function deletePledge(uid: string): Promise<void> {
  const db = getDb()
  await deleteDoc(doc(db, PLEDGES_COLLECTION, uid))
}

// Calculate pledge summary
export function calculatePledgeSummary(
  pledges: Pledge[],
  goal: number
): {
  total: number
  count: number
  goal: number
  fairShare: number
  percentComplete: number
} {
  const total = pledges.reduce((sum, p) => sum + p.amount, 0)
  const count = pledges.length
  const fairShare = count > 0 ? Math.ceil(goal / count) : goal
  const percentComplete = goal > 0 ? Math.round((total / goal) * 100) : 0

  return { total, count, goal, fairShare, percentComplete }
}
