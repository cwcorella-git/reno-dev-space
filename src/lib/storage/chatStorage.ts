'use client'

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../firebase'

const COLLECTION_NAME = 'chatMessages'
const MESSAGE_LIMIT = 100 // Keep last 100 messages

export interface ChatMessage {
  id: string
  text: string
  username: string
  odId: string // Firebase user ID
  timestamp: number
  room: string
}

// Subscribe to chat messages with real-time updates
export function subscribeToChat(
  room: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = getDb()
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('timestamp', 'desc'),
      limit(MESSAGE_LIMIT)
    )

    return onSnapshot(
      q,
      (snapshot) => {
        const messages = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as ChatMessage))
          .filter((msg) => msg.room === room) // Filter by room
          .reverse() // Reverse to show oldest first
        callback(messages)
      },
      (error) => {
        console.error('[chatStorage] Subscription error:', error)
        onError?.(error)
      }
    )
  } catch (error) {
    console.error('[chatStorage] Failed to subscribe:', error)
    onError?.(error as Error)
    return () => {} // Return empty unsubscribe function
  }
}

// Send a new message
export async function sendChatMessage(
  room: string,
  text: string,
  username: string,
  odId: string
): Promise<string> {
  const db = getDb()

  const message: Omit<ChatMessage, 'id'> = {
    text: text.trim(),
    username,
    odId,
    timestamp: Date.now(),
    room,
  }

  const docRef = await addDoc(collection(db, COLLECTION_NAME), message)
  return docRef.id
}

// Delete a message (only by owner)
export async function deleteChatMessage(id: string): Promise<void> {
  const db = getDb()
  await deleteDoc(doc(db, COLLECTION_NAME, id))
}
