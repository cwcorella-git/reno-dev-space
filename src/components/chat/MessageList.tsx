'use client'

import { useEffect, useRef } from 'react'
import { ChatMessage } from '@/hooks/useFirestoreChat'
import { EditableText } from '@/components/EditableText'

interface MessageListProps {
  messages: ChatMessage[]
  isConnected: boolean
  currentUsername?: string
  onDeleteMessage?: (messageId: string, username: string) => void
}

export function MessageList({
  messages,
  isConnected,
  currentUsername,
  onDeleteMessage
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto chat-scrollbar p-3 space-y-2">
      {/* Connection status */}
      <div className="flex items-center justify-center py-2">
        <div className={`flex items-center gap-2 text-xs ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-500 animate-pulse'}`} />
          {isConnected
            ? <EditableText id="chat.status.connected" defaultValue="Connected" category="chat" />
            : <EditableText id="chat.status.connecting" defaultValue="Connecting..." category="chat" />}
        </div>
      </div>

      {/* Messages */}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm text-center px-4">
          <div>
            <p className="font-medium mb-1"><EditableText id="chat.empty.title" defaultValue="No messages yet" category="chat" /></p>
            <p className="text-xs"><EditableText id="chat.empty.subtitle" defaultValue="Start the conversation!" category="chat" /></p>
          </div>
        </div>
      ) : (
        messages.map((message) => {
          const isOwnMessage = currentUsername && message.username === currentUsername

          return (
            <div
              key={message.id}
              className={`rounded-lg p-2.5 group ${
                isOwnMessage
                  ? 'bg-brand-primary/20 ml-4'
                  : 'bg-white/10 mr-4'
              }`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-semibold text-sm text-white">
                  {message.username}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400" suppressHydrationWarning>
                    {formatTime(message.timestamp)}
                  </span>
                  {isOwnMessage && onDeleteMessage && (
                    <button
                      onClick={() => onDeleteMessage(message.id, message.username)}
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      title="Delete message"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">
                {message.text}
              </p>
            </div>
          )
        })
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
