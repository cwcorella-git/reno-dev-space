'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { clearUserVotes, deleteUserBlocks, deleteUserAccount } from '@/lib/userStorage'
import { subscribeToPledges, setPledge, deletePledge, calculatePledgeSummary, Pledge } from '@/lib/pledgeStorage'
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
import { ContentTab } from './ContentTab'

type SubTab = 'account' | 'admin'

export function SettingsTab() {
  const { user, profile, isAdmin, logout } = useAuth()

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('account')
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  // Pledge state
  const [pledgeAmount, setPledgeAmount] = useState('')
  const [goalInput, setGoalInput] = useState('5000')

  // Subscribe to data
  useEffect(() => {
    const unsubPledges = subscribeToPledges(setPledges)
    const unsubSettings = subscribeToCampaignSettings((s) => {
      setSettings(s)
      setGoalInput(s.fundingGoal.toString())
    })
    return () => {
      unsubPledges()
      unsubSettings()
    }
  }, [])

  // Set initial pledge amount
  useEffect(() => {
    if (user && pledges.length > 0) {
      const userPledge = pledges.find((p) => p.odId === user.uid)
      if (userPledge) setPledgeAmount(userPledge.amount.toString())
    }
  }, [user, pledges])

  if (!user) return null

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const userPledge = pledges.find((p) => p.odId === user.uid)
  const summary = settings ? calculatePledgeSummary(pledges, settings.fundingGoal) : null
  const isLocked = settings?.isLocked || false
  const timerActive = !!settings?.timerStartedAt

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 3000)
  }

  // User actions
  const handleLogout = async () => {
    await logout()
  }

  const handleUpdatePledge = async () => {
    if (!user || !profile) return
    const amount = parseInt(pledgeAmount, 10)
    if (isNaN(amount) || amount < 0) return
    setActionLoading(true)
    try {
      if (amount === 0) await deletePledge(user.uid)
      else await setPledge(user.uid, profile.displayName || displayName, amount)
      showStatus('success', 'Pledge updated')
    } catch (error) {
      console.error('Failed to update pledge:', error)
      showStatus('error', 'Failed to update pledge')
    }
    setActionLoading(false)
  }

  const handleClearVotes = async () => {
    setActionLoading(true)
    try {
      const count = await clearUserVotes(user.uid)
      showStatus('success', `Cleared ${count} vote(s)`)
      setConfirmAction(null)
    } catch {
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
    } catch {
      showStatus('error', 'Failed to delete content')
    }
    setActionLoading(false)
  }

  const handleDeleteAccount = async () => {
    setActionLoading(true)
    try {
      await deleteUserAccount(user.uid)
      setConfirmAction(null)
    } catch {
      showStatus('error', 'Failed to delete account')
    }
    setActionLoading(false)
  }

  // Admin actions
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
    if (settings?.isLocked) await unlockCampaign()
    else await lockCampaign()
    setActionLoading(false)
  }

  const handleResetBrightness = async () => {
    setActionLoading(true)
    const count = await resetAllBrightness()
    showStatus('success', `Reset brightness for ${count} block(s)`)
    setConfirmAction(null)
    setActionLoading(false)
  }

  return (
    <div>
      {/* Subtab toggle */}
      <div className="flex gap-1 px-3 py-2 border-b border-white/10">
        <button
          onClick={() => setActiveSubTab('account')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeSubTab === 'account'
              ? 'bg-white/10 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Account
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('admin')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeSubTab === 'admin'
                ? 'bg-amber-600/30 text-amber-300'
                : 'text-amber-400/70 hover:text-amber-300'
            }`}
          >
            Admin
          </button>
        )}
      </div>

      {/* Status message */}
      {statusMessage && (
        <div className={`px-3 py-2 text-sm ${
          statusMessage.type === 'success' ? 'bg-green-600/20 text-green-200' : 'bg-red-600/20 text-red-200'
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
            <button onClick={() => setConfirmAction(null)} disabled={actionLoading} className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm">Cancel</button>
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

      {/* Content */}
      {!confirmAction && activeSubTab === 'account' && (
        <div className="p-4 space-y-4 max-h-[350px] overflow-y-auto">
          {/* User info */}
          <div className="pb-3 border-b border-white/10">
            <p className="font-medium text-white">{displayName}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
            {isAdmin && <span className="inline-block mt-1 text-xs bg-indigo-600/50 text-indigo-200 px-2 py-0.5 rounded">Admin</span>}
          </div>

          {/* Pledge Section */}
          {settings?.timerStartedAt && (
            <div className="pb-3 border-b border-white/10">
              <p className="text-sm font-medium text-white mb-2">My Pledge</p>
              {isLocked ? (
                <div className="text-sm text-gray-400">
                  {userPledge ? <p>Your pledge: <span className="text-white font-medium">${userPledge.amount}</span></p> : <p>Campaign ended</p>}
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input type="number" min="0" value={pledgeAmount} onChange={(e) => setPledgeAmount(e.target.value)} placeholder="0" className="w-full pl-7 pr-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm" />
                  </div>
                  <button onClick={handleUpdatePledge} disabled={actionLoading} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50">
                    {userPledge ? 'Update' : 'Pledge'}
                  </button>
                </div>
              )}
              {summary && summary.count > 0 && (
                <p className="mt-2 text-xs text-gray-400">Fair share: ${summary.fairShare} ({summary.count} backers)</p>
              )}
            </div>
          )}

          {/* Account Actions */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Account Actions</p>
            <button onClick={() => setConfirmAction('votes')} className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 rounded">Clear My Votes</button>
            <button onClick={() => setConfirmAction('content')} className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 rounded">Delete My Content</button>
            <button onClick={() => setConfirmAction('account')} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5 rounded">Delete Account</button>
          </div>

          {/* Sign out */}
          <button onClick={handleLogout} className="w-full px-3 py-2.5 text-left text-sm text-red-400 hover:bg-white/5 rounded flex items-center gap-2 border-t border-white/10 pt-3 mt-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      )}

      {!confirmAction && activeSubTab === 'admin' && isAdmin && (
        <div className="max-h-[350px] overflow-y-auto">
          {/* Campaign Controls */}
          <div className="p-4 space-y-3 border-b border-white/10">
            <p className="text-xs font-medium text-amber-400 uppercase tracking-wide">Campaign</p>
            <div className="flex flex-wrap gap-2">
              {timerActive ? (
                <button onClick={handleResetTimer} disabled={actionLoading} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50">Reset Timer</button>
              ) : (
                <button onClick={handleStartTimer} disabled={actionLoading} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium disabled:opacity-50">Start Timer</button>
              )}
              <button onClick={handleToggleLock} disabled={actionLoading} className={`px-2 py-1 rounded text-xs font-medium disabled:opacity-50 ${settings?.isLocked ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                {settings?.isLocked ? 'Unlock' : 'Lock'}
              </button>
              <button onClick={() => setConfirmAction('brightness')} disabled={actionLoading} className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs disabled:opacity-50">Reset Brightness</button>
            </div>

            {/* Goal */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Goal: $</span>
              <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs" />
              <button onClick={handleUpdateGoal} disabled={actionLoading} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs disabled:opacity-50">Set</button>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 border-b border-white/10">
            <p className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">Stats</p>
            <div className="text-xs text-gray-400 space-y-1">
              <div className="flex justify-between"><span>Views:</span><span className="text-white">{settings?.pageViews || 0}</span></div>
              {summary && <div className="flex justify-between"><span>Pledged:</span><span className="text-white">${summary.total} / ${summary.goal}</span></div>}
              <div className="flex justify-between"><span>Build:</span><span className="text-white font-mono">{process.env.NEXT_PUBLIC_COMMIT_SHA || 'dev'}</span></div>
            </div>
          </div>

          {/* Content Management */}
          <div className="border-b border-white/10">
            <div className="px-4 pt-3">
              <p className="text-xs font-medium text-amber-400 uppercase tracking-wide">Manage Content</p>
            </div>
            <ContentTab />
          </div>
        </div>
      )}
    </div>
  )
}
