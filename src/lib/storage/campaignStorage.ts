'use client'

import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  increment,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../firebase'

const SETTINGS_COLLECTION = 'settings'
const CAMPAIGN_DOC = 'campaign'

// 2 weeks in milliseconds
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

export interface CampaignSettings {
  timerStartedAt: number | null
  timerDurationMs: number
  fundingGoal: number
  isLocked: boolean
  pageViews: number
}

const DEFAULT_SETTINGS: CampaignSettings = {
  timerStartedAt: null,
  timerDurationMs: TWO_WEEKS_MS,
  fundingGoal: 5000,
  isLocked: false,
  pageViews: 0,
}

// Subscribe to campaign settings
export function subscribeToCampaignSettings(
  callback: (settings: CampaignSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    const docRef = doc(db, SETTINGS_COLLECTION, CAMPAIGN_DOC)

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as CampaignSettings)
        } else {
          // Create default settings if they don't exist
          setDoc(docRef, DEFAULT_SETTINGS)
          callback(DEFAULT_SETTINGS)
        }
      },
      (error) => {
        console.error('[campaignStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[campaignStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}

// Start the 2-week timer (admin only)
export async function startCampaignTimer(): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, SETTINGS_COLLECTION, CAMPAIGN_DOC), {
    timerStartedAt: Date.now(),
    isLocked: false,
  })
}

// Reset/stop timer (admin only)
export async function resetCampaignTimer(): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, SETTINGS_COLLECTION, CAMPAIGN_DOC), {
    timerStartedAt: null,
    isLocked: false,
  })
}

// Set funding goal (admin only)
export async function setFundingGoal(amount: number): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, SETTINGS_COLLECTION, CAMPAIGN_DOC), {
    fundingGoal: amount,
  })
}

// Lock campaign (called when timer expires or manually by admin)
export async function lockCampaign(): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, SETTINGS_COLLECTION, CAMPAIGN_DOC), {
    isLocked: true,
  })
}

// Unlock campaign (admin only)
export async function unlockCampaign(): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, SETTINGS_COLLECTION, CAMPAIGN_DOC), {
    isLocked: false,
  })
}

// Increment page view counter
export async function incrementPageViews(): Promise<void> {
  const db = getDb()
  try {
    await updateDoc(doc(db, SETTINGS_COLLECTION, CAMPAIGN_DOC), {
      pageViews: increment(1),
    })
  } catch (error) {
    // If document doesn't exist, create it with defaults
    await setDoc(doc(db, SETTINGS_COLLECTION, CAMPAIGN_DOC), {
      ...DEFAULT_SETTINGS,
      pageViews: 1,
    })
  }
}

// Calculate time remaining
export function getTimeRemaining(settings: CampaignSettings): {
  isActive: boolean
  isExpired: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
} {
  if (!settings.timerStartedAt) {
    return {
      isActive: false,
      isExpired: false,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
    }
  }

  const elapsed = Date.now() - settings.timerStartedAt
  const remaining = settings.timerDurationMs - elapsed

  if (remaining <= 0) {
    return {
      isActive: true,
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
    }
  }

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000))
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000)

  return {
    isActive: true,
    isExpired: false,
    days,
    hours,
    minutes,
    seconds,
    totalMs: remaining,
  }
}
