'use client'

import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../firebase'
import {
  TextEffectsSettings,
  DEFAULT_EFFECTS_SETTINGS,
  TextEffectName,
} from '@/types/canvas'

const SETTINGS_COLLECTION = 'settings'
const EFFECTS_DOC = 'textEffects'

/** Subscribe to text effects settings (real-time) */
export function subscribeToEffectsSettings(
  callback: (settings: TextEffectsSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    const docRef = doc(db, SETTINGS_COLLECTION, EFFECTS_DOC)

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as TextEffectsSettings)
        } else {
          // Create default settings if they don't exist
          setDoc(docRef, DEFAULT_EFFECTS_SETTINGS)
          callback(DEFAULT_EFFECTS_SETTINGS)
        }
      },
      (error) => {
        console.error('[effectsStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[effectsStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {}
  }
}

export async function setEffectsEnabled(enabled: boolean): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, SETTINGS_COLLECTION, EFFECTS_DOC), { enabled })
}

export async function setDisabledEffects(disabledEffects: TextEffectName[]): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, SETTINGS_COLLECTION, EFFECTS_DOC), { disabledEffects })
}

export async function setEffectsThreshold(threshold: number): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, SETTINGS_COLLECTION, EFFECTS_DOC), { threshold })
}

export async function setEffectsIntensity(intensity: 'low' | 'medium' | 'high'): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, SETTINGS_COLLECTION, EFFECTS_DOC), { intensity })
}
