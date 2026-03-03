'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useFirestoreChat } from '@/hooks/useFirestoreChat'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'

interface ChatTabProps {
  isConnected: boolean
}

export function ChatTab({ isConnected }: ChatTabProps) {
  const { user, profile } = useAuth()
  const { messages, sendMessage, deleteMessage } = useFirestoreChat('community')

  const username = profile?.displayName || user?.email?.split('@')[0] || ''

  return (
    <div className="flex flex-col h-[300px]">
      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isConnected={isConnected}
          currentUsername={username}
          onDeleteMessage={deleteMessage}
        />
      </div>

      {/* Input */}
      <MessageInput
        onSendMessage={sendMessage}
        isConnected={isConnected}
        username={username}
      />
    </div>
  )
}
