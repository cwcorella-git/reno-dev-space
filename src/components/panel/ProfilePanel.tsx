'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useContent } from '@/contexts/ContentContext'
import { EditableText } from '@/components/EditableText'
import { subscribeToCampaignSettings, CampaignSettings } from '@/lib/storage/campaignStorage'
import { clearUserVotes, deleteUserBlocks, deleteUserAccount } from '@/lib/storage/userStorage'
import { subscribeToPledges, setPledge, deletePledge, calculatePledgeSummary, Pledge } from '@/lib/storage/pledgeStorage'

export function ProfilePanel() {
  const { user, profile, isAdmin, logout, resendVerificationEmail } = useAuth()
  const { getText } = useContent()

  const [pledges, setPledges] = useState<Pledge[]>([])
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [pledgeAmount, setPledgeAmount] = useState('')
  useEffect(() => {
    const unsubPledges = subscribeToPledges((p) => setPledges(p))
    const unsubSettings = subscribeToCampaignSettings((s) => setSettings(s))
    return () => {
      unsubPledges()
      unsubSettings()
    }
  }, [])

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

  const handleResendVerification = async () => {
    setActionLoading(true)
    try {
      await resendVerificationEmail()
      showStatus('success', getText('profile.verification.sent', 'Verification email sent! Check your spam folder.'))
    } catch {
      showStatus('error', 'Failed to send verification email')
    }
    setActionLoading(false)
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      {statusMessage && (
        <div className={`px-4 py-2 text-sm ${
          statusMessage.type === 'success' ? 'bg-green-600/20 text-green-200' : 'bg-red-600/20 text-red-200'
        }`}>
          {statusMessage.text}
        </div>
      )}

      {confirmAction && (
        <div className="p-4 bg-red-900/30">
          <p className="text-sm text-white mb-3">
            {confirmAction === 'votes' && <EditableText id="profile.confirm.clearVotes" defaultValue="Clear all your votes?" category="profile" />}
            {confirmAction === 'content' && <EditableText id="profile.confirm.deleteContent" defaultValue="Delete all content you created?" category="profile" />}
            {confirmAction === 'account' && <EditableText id="profile.confirm.deleteAccount" defaultValue="Permanently delete your account?" category="profile" />}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmAction(null)} disabled={actionLoading} className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm"><EditableText id="profile.button.cancel" defaultValue="Cancel" category="profile" /></button>
            <button
              onClick={() => {
                if (confirmAction === 'votes') handleClearVotes()
                if (confirmAction === 'content') handleDeleteContent()
                if (confirmAction === 'account') handleDeleteAccount()
              }}
              disabled={actionLoading}
              className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
            >
              {actionLoading ? '...' : <EditableText id="profile.button.confirm" defaultValue="Confirm" category="profile" />}
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
              {!user.emailVerified && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-amber-400">⚠️ {getText('profile.verification.notVerified', 'Email not verified')}</span>
                  <button
                    onClick={handleResendVerification}
                    disabled={actionLoading}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                  >
                    {getText('profile.verification.resend', 'Resend')}
                  </button>
                </div>
              )}
            </div>
            {isAdmin && <span className="text-xs bg-amber-600/50 text-amber-200 px-2 py-0.5 rounded"><EditableText id="profile.badge.admin" defaultValue="Admin" category="profile" /></span>}
          </div>

          {/* Pledge Section */}
          {settings?.timerStartedAt && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2"><EditableText id="profile.heading.pledge" defaultValue="My Pledge" category="profile" /></p>
              {isLocked ? (
                <div className="text-sm text-gray-400">
                  {userPledge ? <p><EditableText id="profile.pledge.yourPledge" defaultValue="Your pledge:" category="profile" /> <span className="text-white font-medium">${userPledge.amount}</span></p> : <p><EditableText id="profile.pledge.ended" defaultValue="Campaign ended" category="profile" /></p>}
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input type="number" min="0" value={pledgeAmount} onChange={(e) => setPledgeAmount(e.target.value)} placeholder="0" className="w-full pl-7 pr-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm" />
                  </div>
                  <button onClick={handleUpdatePledge} disabled={actionLoading} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50">
                    {userPledge ? <EditableText id="profile.button.update" defaultValue="Update" category="profile" /> : <EditableText id="profile.button.pledge" defaultValue="Pledge" category="profile" />}
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
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2"><EditableText id="profile.heading.account" defaultValue="Account" category="profile" /></p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setConfirmAction('votes')} className="px-3 py-1.5 text-sm text-gray-300 bg-white/5 hover:bg-white/10 rounded"><EditableText id="profile.button.clearVotes" defaultValue="Clear Votes" category="profile" /></button>
              <button onClick={() => setConfirmAction('content')} className="px-3 py-1.5 text-sm text-gray-300 bg-white/5 hover:bg-white/10 rounded"><EditableText id="profile.button.deleteContent" defaultValue="Delete Content" category="profile" /></button>
              <button onClick={() => setConfirmAction('account')} className="px-3 py-1.5 text-sm text-red-400 bg-white/5 hover:bg-white/10 rounded"><EditableText id="profile.button.deleteAccount" defaultValue="Delete Account" category="profile" /></button>
            </div>
          </div>

          {/* Sign out */}
          <button onClick={handleLogout} className="w-full px-3 py-2 text-sm text-red-400 hover:bg-white/5 rounded flex items-center justify-center gap-2 border-t border-white/10 pt-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <EditableText id="profile.button.signOut" defaultValue="Sign Out" category="profile" />
          </button>
        </div>
      )}
    </div>
  )
}
