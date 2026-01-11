'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToPledges, setPledge, deletePledge, calculatePledgeSummary, Pledge } from '@/lib/pledgeStorage'
import { subscribeToCampaignSettings, CampaignSettings } from '@/lib/campaignStorage'

export function ProfileDropdown() {
  const { user, profile, isAdmin, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Pledge state
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettings | null>(null)
  const [pledgeAmount, setPledgeAmount] = useState('')
  const [pledgeLoading, setPledgeLoading] = useState(false)
  const [pledgeError, setPledgeError] = useState<string | null>(null)

  // Subscribe to pledges and campaign settings
  useEffect(() => {
    const unsubPledges = subscribeToPledges(setPledges)
    const unsubCampaign = subscribeToCampaignSettings(setCampaignSettings)
    return () => {
      unsubPledges()
      unsubCampaign()
    }
  }, [])

  // Set initial pledge amount from user's existing pledge
  useEffect(() => {
    if (user && pledges.length > 0) {
      const userPledge = pledges.find((p) => p.odId === user.uid)
      if (userPledge) {
        setPledgeAmount(userPledge.amount.toString())
      }
    }
  }, [user, pledges])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (!user) return null

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const userPledge = pledges.find((p) => p.odId === user.uid)
  const summary = campaignSettings ? calculatePledgeSummary(pledges, campaignSettings.fundingGoal) : null
  const isLocked = campaignSettings?.isLocked || false

  const handleLogout = async () => {
    await logout()
    setIsOpen(false)
  }

  const handleUpdatePledge = async () => {
    if (!user || !profile) return
    setPledgeError(null)
    const amount = parseInt(pledgeAmount, 10)
    if (isNaN(amount) || amount < 0) {
      setPledgeError('Please enter a valid amount')
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
      setPledgeError('Failed to update pledge')
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
    <div className="relative" ref={dropdownRef}>
      {/* Profile button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          isOpen ? 'bg-indigo-600' : 'hover:bg-white/10'
        }`}
        title="Profile"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-gray-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-white/10">
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
            <div className="px-4 py-3 border-b border-white/10">
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
                        className="w-full pl-7 pr-3 py-1.5 bg-white/10 border border-white/20 rounded text-white placeholder-gray-500 text-sm"
                      />
                    </div>
                    <button
                      onClick={handleUpdatePledge}
                      disabled={pledgeLoading}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50"
                    >
                      {pledgeLoading ? '...' : userPledge ? 'Update' : 'Pledge'}
                    </button>
                  </div>

                  {pledgeError && (
                    <p className="text-xs text-red-400 mb-1">{pledgeError}</p>
                  )}

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
                <div className="mt-2 text-xs text-gray-400 space-y-0.5">
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

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
          >
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
