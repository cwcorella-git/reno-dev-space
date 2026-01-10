'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCanvas } from '@/contexts/CanvasContext'
import { useFirestoreChat } from '@/hooks/useFirestoreChat'
import { AuthModal } from '@/components/AuthModal'
import { EditorTab } from './EditorTab'
import { ChatTab } from './ChatTab'
import { MembersTab } from './MembersTab'
import { AdminTab } from './AdminTab'
import { ProfileDropdown } from './ProfileDropdown'
import { SettingsDropdown } from './SettingsDropdown'

type TabType = 'editor' | 'chat' | 'members' | 'admin'

export function UnifiedPanel() {
  const { user, isAdmin } = useAuth()
  const { selectedBlockId } = useCanvas()
  const { isConnected } = useFirestoreChat('community')

  const [activeTab, setActiveTab] = useState<TabType>('editor')
  const [isMinimized, setIsMinimized] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-switch to editor tab when block is selected
  useEffect(() => {
    if (selectedBlockId) {
      setActiveTab('editor')
      setIsMinimized(false)
    }
  }, [selectedBlockId])

  if (!mounted) return null

  // Not logged in - show sign in button only
  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowAuthModal(true)}
          className="fixed bottom-4 right-4 z-50 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Sign In
        </button>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </>
    )
  }

  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] sm:w-auto sm:min-w-[500px] sm:max-w-[700px]">
      <div className="bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-xl">
        {/* Tab bar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10">
          {/* Tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => {
                setActiveTab('editor')
                setIsMinimized(false)
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'editor'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => {
                setActiveTab('chat')
                setIsMinimized(false)
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Chat
              {/* Connection indicator */}
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
                }`}
              />
            </button>
            <button
              onClick={() => {
                setActiveTab('members')
                setIsMinimized(false)
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'members'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Members
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setActiveTab('admin')
                  setIsMinimized(false)
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'admin'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Admin
              </button>
            )}
          </div>

          {/* Utility buttons */}
          <div className="flex items-center gap-1">
            <ProfileDropdown />
            <SettingsDropdown />

            {/* Minimize/Expand button */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              <svg className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content area */}
        {!isMinimized && (
          <div className="transition-all">
            {activeTab === 'editor' && <EditorTab />}
            {activeTab === 'chat' && <ChatTab isConnected={isConnected} />}
            {activeTab === 'members' && <MembersTab />}
            {activeTab === 'admin' && isAdmin && <AdminTab />}
          </div>
        )}
      </div>
    </div>
  )
}
