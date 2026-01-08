'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from '@/components/AuthModal'
import { clearUserVotes, deleteUserBlocks, deleteUserAccount } from '@/lib/userStorage'
import { subscribeToPledges, setPledge, deletePledge, calculatePledgeSummary, Pledge } from '@/lib/pledgeStorage'
import { subscribeToCampaignSettings, CampaignSettings } from '@/lib/campaignStorage'

export function FloatingAccount() {
  const { user, profile, isAdmin, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'votes' | 'content' | 'account' | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Pledge state
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettings | null>(null)
  const [pledgeAmount, setPledgeAmount] = useState('')
  const [pledgeLoading, setPledgeLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Subscribe to pledges and campaign settings
  useEffect(() => {
    if (!mounted) return

    const unsubPledges = subscribeToPledges(setPledges)
    const unsubCampaign = subscribeToCampaignSettings(setCampaignSettings)

    return () => {
      unsubPledges()
      unsubCampaign()
    }
  }, [mounted])

  // Set initial pledge amount from user's existing pledge
  useEffect(() => {
    if (user && pledges.length > 0) {
      const userPledge = pledges.find((p) => p.odId === user.uid)
      if (userPledge) {
        setPledgeAmount(userPledge.amount.toString())
      }
    }
  }, [user, pledges])

  if (!mounted) return null

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const userPledge = user ? pledges.find((p) => p.odId === user.uid) : null
  const summary = campaignSettings ? calculatePledgeSummary(pledges, campaignSettings.fundingGoal) : null
  const isLocked = campaignSettings?.isLocked || false

  const handleLogout = async () => {
    await logout()
    setIsOpen(false)
  }

  const handleClearVotes = async () => {
    if (!user) return
    setActionLoading(true)
    try {
      const count = await clearUserVotes(user.uid)
      alert(`Cleared ${count} vote(s)`)
      setConfirmAction(null)
    } catch (error) {
      console.error('Failed to clear votes:', error)
      alert('Failed to clear votes')
    }
    setActionLoading(false)
  }

  const handleDeleteContent = async () => {
    if (!user) return
    setActionLoading(true)
    try {
      const count = await deleteUserBlocks(user.uid)
      alert(`Deleted ${count} block(s)`)
      setConfirmAction(null)
    } catch (error) {
      console.error('Failed to delete content:', error)
      alert('Failed to delete content')
    }
    setActionLoading(false)
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    setActionLoading(true)
    try {
      await deleteUserAccount(user.uid)
      setConfirmAction(null)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert('Failed to delete account. You may need to re-authenticate.')
    }
    setActionLoading(false)
  }

  const handleUpdatePledge = async () => {
    if (!user || !profile) return
    const amount = parseInt(pledgeAmount, 10)
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount')
      return
    }
    setPledgeLoading(true)
    try {
      if (amount === 0) {
        await deletePledge(user.uid)
      } else {
        await setPledge(user.uid, profile.displayName || displayName, amount)
      }
    } catch (error) {
      console.error('Failed to update pledge:', error)
      alert('Failed to update pledge')
    }
    setPledgeLoading(false)
  }

  const handleRemovePledge = async () => {
    if (!user) return
    setPledgeLoading(true)
    try {
      await deletePledge(user.uid)
      setPledgeAmount('')
    } catch (error) {
      console.error('Failed to remove pledge:', error)
    }
    setPledgeLoading(false)
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50">
        {/* Account Panel */}
        {isOpen && (
          <div className="bg-brand-dark border border-white/20 rounded-xl shadow-2xl overflow-hidden w-80 mb-2 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-brand-primary/20 px-4 py-3 flex items-center justify-between border-b border-white/10 sticky top-0">
              <span className="font-medium text-sm">Account</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {user ? (
                <div className="space-y-4">
                  {/* User Info - Plain text, no avatar */}
                  <div>
                    <p className="font-medium text-white">{displayName}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                    {isAdmin && (
                      <span className="inline-block mt-1 text-xs bg-indigo-600/50 text-indigo-200 px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>

                  {/* Pledge Section */}
                  {campaignSettings?.timerStartedAt && (
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-sm font-medium text-white mb-2">My Pledge</p>

                      {isLocked ? (
                        <div className="text-sm text-gray-400">
                          {userPledge ? (
                            <p>Your pledge: <span className="text-white font-medium">${userPledge.amount}</span></p>
                          ) : (
                            <p>Campaign has ended</p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2 mb-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                              <input
                                type="number"
                                min="0"
                                value={pledgeAmount}
                                onChange={(e) => setPledgeAmount(e.target.value)}
                                placeholder="0"
                                className="w-full pl-7 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 text-sm"
                              />
                            </div>
                            <button
                              onClick={handleUpdatePledge}
                              disabled={pledgeLoading}
                              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                              {pledgeLoading ? '...' : userPledge ? 'Update' : 'Pledge'}
                            </button>
                          </div>

                          {userPledge && (
                            <button
                              onClick={handleRemovePledge}
                              disabled={pledgeLoading}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove pledge
                            </button>
                          )}
                        </>
                      )}

                      {/* Fair share info */}
                      {summary && summary.count > 0 && (
                        <div className="mt-3 text-xs text-gray-400 space-y-1">
                          <p>Fair share: ${summary.fairShare} ({summary.count} backers)</p>
                          {userPledge && (
                            <p className={userPledge.amount >= summary.fairShare ? 'text-green-400' : 'text-yellow-400'}>
                              Your pledge: ${userPledge.amount}
                              ({userPledge.amount >= summary.fairShare ? '+' : ''}
                              ${userPledge.amount - summary.fairShare})
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Settings Toggle */}
                  <div className="pt-3 border-t border-white/10">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="flex items-center justify-between w-full text-sm text-gray-300 hover:text-white"
                    >
                      <span>Settings</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showSettings && (
                      <div className="mt-3 space-y-2">
                        {/* Confirmation dialogs */}
                        {confirmAction ? (
                          <div className="p-3 bg-red-900/30 rounded-lg border border-red-500/30">
                            <p className="text-sm text-white mb-3">
                              {confirmAction === 'votes' && 'Clear all your votes?'}
                              {confirmAction === 'content' && 'Delete all content you created?'}
                              {confirmAction === 'account' && 'Permanently delete your account and all data?'}
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
                          <>
                            <button
                              onClick={() => setConfirmAction('votes')}
                              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 rounded-lg"
                            >
                              Clear My Votes
                            </button>
                            <button
                              onClick={() => setConfirmAction('content')}
                              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 rounded-lg"
                            >
                              Delete My Content
                            </button>
                            <button
                              onClick={() => setConfirmAction('account')}
                              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5 rounded-lg"
                            >
                              Delete Account
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sign Out */}
                  <div className="pt-3 border-t border-white/10">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">Sign in to vote on content, pledge support, and join the chat.</p>
                  <button
                    onClick={() => {
                      setShowAuthModal(true)
                      setIsOpen(false)
                    }}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Login / Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toggle Button - simpler, no avatar */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`${
            user ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-700 hover:bg-gray-600'
          } text-white p-4 rounded-full shadow-lg transition-all hover:scale-105`}
          title={user ? 'Account' : 'Sign In'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </button>
      </div>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  )
}
