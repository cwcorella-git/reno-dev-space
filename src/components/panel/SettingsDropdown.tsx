'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { clearUserVotes, deleteUserBlocks, deleteUserAccount } from '@/lib/userStorage'

export function SettingsDropdown() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'votes' | 'content' | 'account' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setConfirmAction(null)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (!user) return null

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 3000)
  }

  const handleClearVotes = async () => {
    setActionLoading(true)
    try {
      const count = await clearUserVotes(user.uid)
      showStatus('success', `Cleared ${count} vote(s)`)
      setConfirmAction(null)
    } catch (error) {
      console.error('Failed to clear votes:', error)
      showStatus('error', 'Failed to clear votes')
    }
    setActionLoading(false)
  }

  const handleDeleteContent = async () => {
    setActionLoading(true)
    try {
      const count = await deleteUserBlocks(user.uid)
      showStatus('success', `Deleted ${count} block(s)`)
      setConfirmAction(null)
    } catch (error) {
      console.error('Failed to delete content:', error)
      showStatus('error', 'Failed to delete content')
    }
    setActionLoading(false)
  }

  const handleDeleteAccount = async () => {
    setActionLoading(true)
    try {
      await deleteUserAccount(user.uid)
      setConfirmAction(null)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to delete account:', error)
      showStatus('error', 'Failed to delete account. Re-authenticate and try again.')
    }
    setActionLoading(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Settings button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          isOpen ? 'bg-indigo-600' : 'hover:bg-white/10'
        }`}
        title="Settings"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden">
          {/* Status message */}
          {statusMessage && (
            <div className={`px-3 py-2 text-sm ${
              statusMessage.type === 'success'
                ? 'bg-green-600/20 text-green-200'
                : 'bg-red-600/20 text-red-200'
            }`}>
              {statusMessage.text}
            </div>
          )}
          {confirmAction ? (
            <div className="p-3 bg-red-900/30">
              <p className="text-sm text-white mb-3">
                {confirmAction === 'votes' && 'Clear all your votes?'}
                {confirmAction === 'content' && 'Delete all content you created?'}
                {confirmAction === 'account' && 'Permanently delete your account?'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  disabled={actionLoading}
                  className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmAction === 'votes') handleClearVotes()
                    if (confirmAction === 'content') handleDeleteContent()
                    if (confirmAction === 'account') handleDeleteAccount()
                  }}
                  disabled={actionLoading}
                  className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                >
                  {actionLoading ? '...' : 'Confirm'}
                </button>
              </div>
            </div>
          ) : (
            <div className="py-1">
              <button
                onClick={() => setConfirmAction('votes')}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5"
              >
                Clear My Votes
              </button>
              <button
                onClick={() => setConfirmAction('content')}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5"
              >
                Delete My Content
              </button>
              <div className="border-t border-white/10 my-1" />
              <button
                onClick={() => setConfirmAction('account')}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5"
              >
                Delete Account
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
