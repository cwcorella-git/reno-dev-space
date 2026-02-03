'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCanvas } from '@/contexts/CanvasContext'
import { useFirestoreChat } from '@/hooks/useFirestoreChat'
import { subscribeToCampaignSettings, CampaignSettings } from '@/lib/campaignStorage'
import { AuthModal } from '@/components/AuthModal'
import { EditableText } from '@/components/EditableText'
import { EditorTab } from './EditorTab'
import { ChatTab } from './ChatTab'
import { MembersTab } from './MembersTab'
import { ProfilePanel } from './ProfilePanel'
import { ContentPanel } from './ContentPanel'
import { CampaignPanel } from './CampaignPanel'
import { HistoryPanel } from './HistoryPanel'

type TabType = 'editor' | 'chat' | 'members' | 'profile' | 'content' | 'campaign' | 'history'

export function UnifiedPanel() {
  const { user, isAdmin } = useAuth()
  const { selectedBlockId, isAddTextMode, setIsAddTextMode, canAddText } = useCanvas()
  const { isConnected } = useFirestoreChat('community')

  const [activeTab, setActiveTab] = useState<TabType>('editor')
  const [isMinimized, setIsMinimized] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettings | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Subscribe to campaign settings to determine if campaign is active
  useEffect(() => {
    const unsubscribe = subscribeToCampaignSettings(setCampaignSettings)
    return () => unsubscribe()
  }, [])

  // Auto-switch to editor tab when block is selected
  useEffect(() => {
    if (selectedBlockId) {
      setActiveTab('editor')
      setIsMinimized(false)
    }
  }, [selectedBlockId])

  if (!mounted) return null

  // Campaign is active if timer has started
  const hasCampaign = campaignSettings?.timerStartedAt != null

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
          <EditableText id="panel.button.signIn" defaultValue="Sign In" category="panel" />
        </button>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </>
    )
  }

  const isContentTab = activeTab === 'editor' || activeTab === 'chat' || activeTab === 'members'

  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] sm:w-auto sm:min-w-[500px] sm:max-w-[700px]">
      {/* Add Text button - positioned at top-right, above the panel */}
      {canAddText && (
        <button
          onClick={() => setIsAddTextMode(!isAddTextMode)}
          className={`absolute -top-12 right-0 z-10 px-3 py-1.5 rounded-lg shadow-lg transition-all hover:scale-105 flex items-center gap-1.5 text-sm font-medium ${
            isAddTextMode
              ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
              : 'bg-gray-800 hover:bg-gray-700 text-white border border-white/10'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isAddTextMode ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            )}
          </svg>
          {isAddTextMode ? <EditableText id="panel.button.cancel" defaultValue="Cancel" category="panel" /> : <EditableText id="panel.button.addText" defaultValue="Add Text" category="panel" />}
        </button>
      )}
      <div className="bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-xl">
        {/* Tab bar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10">
          {/* Left - main tabs */}
          <div className="flex gap-1 items-center">
            <button
              onClick={() => { setActiveTab('editor'); setIsMinimized(false) }}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'editor'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <EditableText id="panel.tab.editor" defaultValue="Editor" category="panel" />
            </button>
            <button
              onClick={() => { setActiveTab('chat'); setIsMinimized(false) }}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <EditableText id="panel.tab.chat" defaultValue="Chat" category="panel" />
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            </button>
            <button
              onClick={() => { setActiveTab('members'); setIsMinimized(false) }}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'members'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <EditableText id="panel.tab.members" defaultValue="Members" category="panel" />
            </button>
            <button
              onClick={() => { setActiveTab('profile'); setIsMinimized(false) }}
              className={`px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <EditableText id="panel.tab.profile" defaultValue="Profile" category="panel" />
            </button>
          </div>

          {/* Right side - admin icons + collapse */}
          <div className="flex gap-1 items-center justify-end">
            {/* Content icon - only for admin */}
            {isAdmin && (
              <button
                onClick={() => { setActiveTab('content'); setIsMinimized(false) }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  activeTab === 'content'
                    ? 'bg-amber-600/50 text-amber-200'
                    : 'text-amber-400 hover:text-amber-200 hover:bg-amber-600/20'
                }`}
                title="Content"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}

            {/* Campaign icon - only for admin */}
            {isAdmin && (
              <button
                onClick={() => { setActiveTab('campaign'); setIsMinimized(false) }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  activeTab === 'campaign'
                    ? 'bg-amber-600/50 text-amber-200'
                    : 'text-amber-400 hover:text-amber-200 hover:bg-amber-600/20'
                }`}
                title="Campaign"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            )}

            {/* History button - only for admin */}
            {isAdmin && (
              <button
                onClick={() => { setActiveTab('history'); setIsMinimized(false) }}
                className={`px-2 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'bg-amber-600/50 text-amber-200'
                    : 'text-amber-400 hover:text-amber-200 hover:bg-amber-600/20'
                }`}
              >
                History
              </button>
            )}

            {/* Collapse/Expand button */}
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
          <div>
            {activeTab === 'editor' && <EditorTab />}
            {activeTab === 'chat' && <ChatTab isConnected={isConnected} />}
            {activeTab === 'members' && <MembersTab />}
            {activeTab === 'profile' && <ProfilePanel />}
            {activeTab === 'content' && <ContentPanel />}
            {activeTab === 'campaign' && <CampaignPanel />}
            {activeTab === 'history' && <HistoryPanel />}
          </div>
        )}
      </div>
    </div>
  )
}
