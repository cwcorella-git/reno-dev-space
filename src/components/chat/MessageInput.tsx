'use client'

import { useState, KeyboardEvent } from 'react'
import { useContent } from '@/contexts/ContentContext'
import { EditableText } from '@/components/EditableText'

interface MessageInputProps {
  onSendMessage: (text: string, username: string) => void
  isConnected: boolean
  username: string
}

export function MessageInput({ onSendMessage, isConnected, username }: MessageInputProps) {
  const { getText } = useContent()
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim() || !isConnected || !username) return
    onSendMessage(text.trim(), username)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-3 border-t border-white/10">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? getText('chat.placeholder.message', 'Type a message...') : getText('chat.placeholder.connecting', 'Connecting...')}
          disabled={!isConnected || !username}
          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !text.trim() || !username}
          className="bg-brand-primary hover:bg-brand-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <EditableText id="chat.button.send" defaultValue="Send" category="chat" />
        </button>
      </div>
      {!username && isConnected && (
        <p className="text-xs text-gray-500 mt-2"><EditableText id="chat.hint.signIn" defaultValue="Sign in to send messages" category="chat" /></p>
      )}
    </div>
  )
}
