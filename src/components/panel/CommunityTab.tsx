'use client'

import { useState } from 'react'
import { ChatTab } from './ChatTab'
import { MembersTab } from './MembersTab'

type SubTab = 'chat' | 'members'

interface CommunityTabProps {
  isConnected: boolean
}

export function CommunityTab({ isConnected }: CommunityTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('chat')

  return (
    <div>
      {/* Subtab toggle */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/10">
        <button
          onClick={() => setActiveSubTab('chat')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeSubTab === 'chat'
              ? 'bg-white/10 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Chat
          <span className={`ml-1.5 w-1.5 h-1.5 rounded-full inline-block ${isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
        </button>
        <button
          onClick={() => setActiveSubTab('members')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeSubTab === 'members'
              ? 'bg-white/10 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Members
        </button>
      </div>

      {/* Content */}
      {activeSubTab === 'chat' && <ChatTab isConnected={isConnected} />}
      {activeSubTab === 'members' && <MembersTab />}
    </div>
  )
}
