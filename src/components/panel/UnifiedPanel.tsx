'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCanvas } from '@/contexts/CanvasContext'
import { useFirestoreChat } from '@/hooks/useFirestoreChat'
import { subscribeToPledges, Pledge } from '@/lib/pledgeStorage'
import { AuthModal } from '@/components/AuthModal'
import { EditorTab } from './EditorTab'
import { CommunityTab } from './CommunityTab'
import { DonateTab } from './DonateTab'
import { SettingsTab } from './SettingsTab'

type TabType = 'editor' | 'community' | 'donate' | 'settings'

export function UnifiedPanel() {
  const { user, isAdmin } = useAuth()
  const { selectedBlockId, isAddTextMode, setIsAddTextMode } = useCanvas()
  const { isConnected } = useFirestoreChat('community')

  const [activeTab, setActiveTab] = useState<TabType>('editor')
  const [isMinimized, setIsMinimized] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hasPledged, setHasPledged] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if user has pledged (to enable Add Text button)
  useEffect(() => {
    if (!user) {
      setHasPledged(false)
      return
    }

    const unsubscribe = subscribeToPledges((pledges: Pledge[]) => {
      const userPledge = pledges.find(p => p.odId === user.uid)
      setHasPledged(!!userPledge && userPledge.amount > 0)
    })

    return () => unsubscribe()
  }, [user])

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
      {/* Add Text button - positioned at top-right, above the panel */}
      {(isAdmin || hasPledged) && (
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
          {isAddTextMode ? 'Cancel' : 'Add Text'}
        </button>
      )}
      <div className="bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-xl">
        {/* Tab bar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10">
          <div className="flex gap-1 flex-1">
            <button
              onClick={() => { setActiveTab('editor'); setIsMinimized(false) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'editor'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => { setActiveTab('community'); setIsMinimized(false) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'community'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Community
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            </button>
            <button
              onClick={() => { setActiveTab('donate'); setIsMinimized(false) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'donate'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Donate
            </button>
            <button
              onClick={() => { setActiveTab('settings'); setIsMinimized(false) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'settings'
                  ? 'bg-white/20 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Settings
            </button>
          </div>

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

        {/* Content area */}
        {!isMinimized && (
          <div>
            {activeTab === 'editor' && <EditorTab />}
            {activeTab === 'community' && <CommunityTab isConnected={isConnected} />}
            {activeTab === 'donate' && <DonateTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        )}
      </div>
    </div>
  )
}
