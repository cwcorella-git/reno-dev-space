'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { clearUserVotes, deleteUserBlocks, deleteUserAccount } from '@/lib/userStorage'
import { subscribeToPledges, calculatePledgeSummary, Pledge } from '@/lib/pledgeStorage'
import {
  subscribeToCampaignSettings,
  startCampaignTimer,
  resetCampaignTimer,
  setFundingGoal,
  lockCampaign,
  unlockCampaign,
  CampaignSettings,
} from '@/lib/campaignStorage'
import { resetAllBrightness } from '@/lib/canvasStorage'

export function SettingsDropdown() {
  const { user, isAdmin } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'votes' | 'content' | 'account' | 'brightness' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Admin state
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [goalInput, setGoalInput] = useState('5000')

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

  // Subscribe to admin data
  useEffect(() => {
    if (!isAdmin || !isOpen) return

    const unsubPledges = subscribeToPledges(setPledges)
    const unsubSettings = subscribeToCampaignSettings((s) => {
      setSettings(s)
      setGoalInput(s.fundingGoal.toString())
    })

    return () => {
      unsubPledges()
      unsubSettings()
    }
  }, [isAdmin, isOpen])

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

  // Admin handlers
  const handleStartTimer = async () => {
    setActionLoading(true)
    await startCampaignTimer()
    setActionLoading(false)
  }

  const handleResetTimer = async () => {
    setActionLoading(true)
    await resetCampaignTimer()
    setActionLoading(false)
  }

  const handleUpdateGoal = async () => {
    const amount = parseInt(goalInput, 10)
    if (isNaN(amount) || amount <= 0) return
    setActionLoading(true)
    await setFundingGoal(amount)
    setActionLoading(false)
  }

  const handleToggleLock = async () => {
    setActionLoading(true)
    if (settings?.isLocked) {
      await unlockCampaign()
    } else {
      await lockCampaign()
    }
    setActionLoading(false)
  }

  const handleResetBrightness = async () => {
    setActionLoading(true)
    const count = await resetAllBrightness()
    showStatus('success', `Reset brightness for ${count} block(s)`)
    setConfirmAction(null)
    setActionLoading(false)
  }

  const summary = settings ? calculatePledgeSummary(pledges, settings.fundingGoal) : null
  const timerActive = !!settings?.timerStartedAt

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
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-gray-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
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

          {/* Confirmation dialog */}
          {confirmAction && (
            <div className="p-3 bg-red-900/30">
              <p className="text-sm text-white mb-3">
                {confirmAction === 'votes' && 'Clear all your votes?'}
                {confirmAction === 'content' && 'Delete all content you created?'}
                {confirmAction === 'account' && 'Permanently delete your account?'}
                {confirmAction === 'brightness' && 'Reset brightness for all blocks?'}
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
                    if (confirmAction === 'brightness') handleResetBrightness()
                  }}
                  disabled={actionLoading}
                  className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                >
                  {actionLoading ? '...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {!confirmAction && (
            <>
              {/* User Settings */}
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

              {/* Admin Section */}
              {isAdmin && (
                <>
                  <div className="border-t border-white/10" />
                  <div className="px-4 py-2 bg-indigo-900/30">
                    <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wide">Admin</span>
                  </div>
                  <div className="p-3 space-y-3">
                    {/* Timer & Lock Controls */}
                    <div className="flex flex-wrap gap-2">
                      {timerActive ? (
                        <button
                          onClick={handleResetTimer}
                          disabled={actionLoading}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50"
                        >
                          Reset Timer
                        </button>
                      ) : (
                        <button
                          onClick={handleStartTimer}
                          disabled={actionLoading}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium disabled:opacity-50"
                        >
                          Start Timer
                        </button>
                      )}

                      <button
                        onClick={handleToggleLock}
                        disabled={actionLoading}
                        className={`px-2 py-1 rounded text-xs font-medium disabled:opacity-50 ${
                          settings?.isLocked
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {settings?.isLocked ? 'Unlock' : 'Lock'}
                      </button>

                      <button
                        onClick={() => setConfirmAction('brightness')}
                        disabled={actionLoading}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs disabled:opacity-50"
                      >
                        Reset Brightness
                      </button>
                    </div>

                    {/* Funding Goal */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Goal: $</span>
                      <input
                        type="number"
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                        className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs"
                      />
                      <button
                        onClick={handleUpdateGoal}
                        disabled={actionLoading}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs disabled:opacity-50"
                      >
                        Set
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="text-xs text-gray-400 pt-2 border-t border-white/10 space-y-1">
                      <div className="flex justify-between">
                        <span>Views:</span>
                        <span className="text-white">{settings?.pageViews || 0}</span>
                      </div>
                      {summary && (
                        <>
                          <div className="flex justify-between">
                            <span>Pledged:</span>
                            <span className="text-white">${summary.total} / ${summary.goal}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Backers:</span>
                            <span className="text-white">{summary.count}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span>Build:</span>
                        <span className="text-white font-mono">{process.env.NEXT_PUBLIC_COMMIT_SHA || 'dev'}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
