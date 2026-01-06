'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSocket } from '@/lib/socketio'
import type { Socket } from 'socket.io-client'

export interface ChatMessage {
  id: string
  text: string
  username: string
  timestamp: number
}

interface UseSocketChatReturn {
  messages: ChatMessage[]
  sendMessage: (text: string, username: string) => void
  deleteMessage: (messageId: string, username: string) => void
  isConnected: boolean
}

/**
 * Custom hook for Socket.io chat functionality
 * Provides real-time message sync with server persistence
 */
export function useSocketChat(room: string): UseSocketChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const socket = getSocket()
    if (!socket) {
      console.error('[useSocketChat] Failed to initialize Socket.io')
      return
    }

    socketRef.current = socket

    const handleConnect = () => {
      setIsConnected(true)
      socket.emit('join_room', { room })
    }

    const handleDisconnect = () => {
      setIsConnected(false)
    }

    const handleMessageHistory = ({ messages: historyMessages }: { messages: ChatMessage[] }) => {
      console.log(`[useSocketChat] Loaded ${historyMessages.length} messages for room: ${room}`)
      setMessages(historyMessages)
    }

    const handleNewMessage = ({ message }: { message: ChatMessage }) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          return prev
        }
        return [...prev, message].sort((a, b) => a.timestamp - b.timestamp)
      })
    }

    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('message_history', handleMessageHistory)
    socket.on('new_message', handleNewMessage)
    socket.on('message_deleted', handleMessageDeleted)

    setIsConnected(socket.connected)

    if (socket.connected) {
      socket.emit('join_room', { room })
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('message_history', handleMessageHistory)
      socket.off('new_message', handleNewMessage)
      socket.off('message_deleted', handleMessageDeleted)
      setMessages([])
      setIsConnected(false)
    }
  }, [room])

  const sendMessage = useCallback((text: string, username: string) => {
    if (!text.trim()) return

    const socket = socketRef.current
    if (!socket || !socket.connected) {
      console.error('[useSocketChat] Cannot send message: not connected')
      return
    }

    socket.emit('send_message', {
      room,
      text: text.trim(),
      username: username || 'Anonymous'
    })
  }, [room])

  const deleteMessage = useCallback((messageId: string, username: string) => {
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      console.error('[useSocketChat] Cannot delete message: not connected')
      return
    }

    socket.emit('delete_message', {
      room,
      messageId,
      username
    })
  }, [room])

  return {
    messages,
    sendMessage,
    deleteMessage,
    isConnected
  }
}
