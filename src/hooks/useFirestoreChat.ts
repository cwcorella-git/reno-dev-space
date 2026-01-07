'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  subscribeToChat,
  sendChatMessage,
  deleteChatMessage,
  ChatMessage,
} from '@/lib/chatStorage'

// Re-export ChatMessage type for components
export type { ChatMessage }

interface UseFirestoreChatReturn {
  messages: ChatMessage[]
  sendMessage: (text: string, username: string) => void
  deleteMessage: (messageId: string, username: string) => void
  isConnected: boolean
}

/**
 * Custom hook for Firestore-based chat functionality
 * Provides real-time message sync with Firestore persistence
 */
export function useFirestoreChat(room: string): UseFirestoreChatReturn {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const unsubscribe = subscribeToChat(
      room,
      (newMessages) => {
        setMessages(newMessages)
        setIsConnected(true)
      },
      (error) => {
        console.error('[useFirestoreChat] Error:', error)
        setIsConnected(false)
      }
    )

    // Set connected after initial setup
    setIsConnected(true)

    return () => {
      unsubscribe()
      setMessages([])
    }
  }, [room])

  const sendMessage = useCallback(
    async (text: string, username: string) => {
      if (!text.trim() || !user) return

      try {
        await sendChatMessage(room, text, username, user.uid)
      } catch (error) {
        console.error('[useFirestoreChat] Failed to send message:', error)
      }
    },
    [room, user]
  )

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!user) return

      // Find the message to check ownership
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.odId !== user.uid) {
        console.error('[useFirestoreChat] Cannot delete: not owner')
        return
      }

      try {
        await deleteChatMessage(messageId)
      } catch (error) {
        console.error('[useFirestoreChat] Failed to delete message:', error)
      }
    },
    [user, messages]
  )

  return {
    messages,
    sendMessage,
    deleteMessage,
    isConnected,
  }
}
