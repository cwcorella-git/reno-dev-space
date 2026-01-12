'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { clearUserVotes, deleteUserBlocks, deleteUserAccount } from '@/lib/userStorage'
import { subscribeToPledges, setPledge, deletePledge, calculatePledgeSummary, Pledge } from '@/lib/pledgeStorage'
import { subscribeToCampaignSettings, CampaignSettings } from '@/lib/campaignStorage'

export function ProfileTab() {
  const { user, profile, isAdmin, logout } = useAuth()

  const [pledges, setPledges] = useState<Pledge[]>([])
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [pledgeAmount, setPledgeAmount] = useState('')

  // Subscribe to data
  useEffect(() => {
    const unsubPledges = subscribeToPledges(setPledges)
    const unsubSettings = subscribeToCampaignSettings(setSettings)
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

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 3000)
  }

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

  return (
    <div className="max-h-[350px] overflow-y-auto">
      {/* Status message */}
      {statusMessage && (
        <div className={`px-4 py-2 text-sm ${
          statusMessage.type === 'success' ? 'bg-green-600/20 text-green-200' : 'bg-red-600/20 text-red-200'
        }`}>
          {statusMessage.text}
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="p-4 bg-red-900/30">
          <p className="text-sm text-white mb-3">
            {confirmAction === 'votes' && 'Clear all your votes?'}
            {confirmAction === 'content' && 'Delete all content you created?'}
            {confirmAction === 'account' && 'Permanently delete your account?'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmAction(null)} disabled={actionLoading} className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm">Cancel</button>
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
      )}

      {!confirmAction && (
        <div className="p-4 space-y-4">
          {/* User info */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-white">{displayName}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
            {isAdmin && <span className="text-xs bg-amber-600/50 text-amber-200 px-2 py-0.5 rounded">Admin</span>}
          </div>

          {/* Pledge Section */}
          {settings?.timerStartedAt && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">My Pledge</p>
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
          <div className="pt-3 border-t border-white/10">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Account</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setConfirmAction('votes')} className="px-3 py-1.5 text-sm text-gray-300 bg-white/5 hover:bg-white/10 rounded">Clear Votes</button>
              <button onClick={() => setConfirmAction('content')} className="px-3 py-1.5 text-sm text-gray-300 bg-white/5 hover:bg-white/10 rounded">Delete Content</button>
              <button onClick={() => setConfirmAction('account')} className="px-3 py-1.5 text-sm text-red-400 bg-white/5 hover:bg-white/10 rounded">Delete Account</button>
            </div>
          </div>

          {/* Admin Stats (quick reference for admin) */}
          {isAdmin && settings && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">Stats</p>
              <div className="text-xs text-gray-400 grid grid-cols-3 gap-2">
                <div><span className="block text-white font-medium">{settings.pageViews || 0}</span>Views</div>
                {summary && <div><span className="block text-white font-medium">${summary.total}</span>Pledged</div>}
                <div><span className="block text-white font-mono">{process.env.NEXT_PUBLIC_COMMIT_SHA || 'dev'}</span>Build</div>
              </div>
            </div>
          )}

          {/* Sign out */}
          <button onClick={handleLogout} className="w-full px-3 py-2 text-sm text-red-400 hover:bg-white/5 rounded flex items-center justify-center gap-2 border-t border-white/10 pt-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
