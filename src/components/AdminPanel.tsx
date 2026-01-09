'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToUsers, getUserStats, UserProfile, UserStats } from '@/lib/userStorage'
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

interface UserWithStats extends UserProfile {
  stats?: UserStats
}

export function AdminPanel() {
  const { isAdmin } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [users, setUsers] = useState<UserWithStats[]>([])
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [goalInput, setGoalInput] = useState('5000')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Subscribe to data
  useEffect(() => {
    if (!mounted || !isAdmin) return

    const unsubUsers = subscribeToUsers(async (newUsers) => {
      // Fetch stats for each user
      const usersWithStats = await Promise.all(
        newUsers.map(async (user) => {
          try {
            const stats = await getUserStats(user.uid)
            return { ...user, stats }
          } catch {
            return { ...user, stats: { blocksCreated: 0, votesGiven: 0, pledgeAmount: 0 } }
          }
        })
      )
      setUsers(usersWithStats)
    })

    const unsubPledges = subscribeToPledges(setPledges)
    const unsubSettings = subscribeToCampaignSettings((s) => {
      setSettings(s)
      setGoalInput(s.fundingGoal.toString())
    })

    return () => {
      unsubUsers()
      unsubPledges()
      unsubSettings()
    }
  }, [mounted, isAdmin])

  if (!mounted || !isAdmin) return null

  const summary = settings ? calculatePledgeSummary(pledges, settings.fundingGoal) : null
  const timerActive = !!settings?.timerStartedAt

  const handleStartTimer = async () => {
    setLoading(true)
    await startCampaignTimer()
    setLoading(false)
  }

  const handleResetTimer = async () => {
    setLoading(true)
    await resetCampaignTimer()
    setLoading(false)
  }

  const handleUpdateGoal = async () => {
    const amount = parseInt(goalInput, 10)
    if (isNaN(amount) || amount <= 0) return
    setLoading(true)
    await setFundingGoal(amount)
    setLoading(false)
  }

  const handleToggleLock = async () => {
    setLoading(true)
    if (settings?.isLocked) {
      await unlockCampaign()
    } else {
      await lockCampaign()
    }
    setLoading(false)
  }

  const handleResetBrightness = async () => {
    if (!confirm('Reset brightness for all blocks to default (50)?')) return
    setLoading(true)
    const count = await resetAllBrightness()
    alert(`Reset brightness for ${count} block(s)`)
    setLoading(false)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Admin Panel */}
      {isOpen && (
        <div className="bg-brand-dark border border-white/20 rounded-xl shadow-2xl overflow-hidden w-[500px] max-h-[80vh] overflow-y-auto mb-2">
          {/* Header */}
          <div className="bg-brand-primary/20 px-4 py-3 flex items-center justify-between border-b border-white/10 sticky top-0 z-10">
            <span className="font-medium text-sm">Admin Panel</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Campaign Controls */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white">Campaign</h3>

              <div className="flex gap-2">
                {timerActive ? (
                  <button
                    onClick={handleResetTimer}
                    disabled={loading}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    Reset Timer
                  </button>
                ) : (
                  <button
                    onClick={handleStartTimer}
                    disabled={loading}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    Start 2-Week Timer
                  </button>
                )}

                <button
                  onClick={handleToggleLock}
                  disabled={loading}
                  className={`px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                    settings?.isLocked
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {settings?.isLocked ? 'Unlock Pledges' : 'Lock Pledges'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-gray-400">Goal: $</span>
                  <input
                    type="number"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                  />
                  <button
                    onClick={handleUpdateGoal}
                    disabled={loading}
                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm disabled:opacity-50"
                  >
                    Update
                  </button>
                </div>
                <div className="flex gap-1">
                  {[1000, 2500, 5000, 10000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setGoalInput(amount.toString())}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        parseInt(goalInput, 10) === amount
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-gray-300'
                      }`}
                    >
                      ${amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm text-gray-400">
                <span>Page Views: <span className="text-white">{settings?.pageViews || 0}</span></span>
                {summary && (
                  <>
                    <span>Pledged: <span className="text-white">${summary.total}</span></span>
                    <span>Backers: <span className="text-white">{summary.count}</span></span>
                  </>
                )}
              </div>

              {/* Canvas Actions */}
              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={handleResetBrightness}
                  disabled={loading}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Reset All Brightness
                </button>
              </div>
            </div>

            {/* User List */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white">Users ({users.length})</h3>

              <div className="border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr className="text-left text-gray-400">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium text-center">Blocks</th>
                      <th className="px-3 py-2 font-medium text-center">Votes</th>
                      <th className="px-3 py-2 font-medium text-right">Pledge</th>
                      <th className="px-3 py-2 font-medium text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((user) => (
                      <tr key={user.uid} className="text-white hover:bg-white/5">
                        <td className="px-3 py-2">
                          <div>
                            <p className="font-medium truncate max-w-[120px]">{user.displayName}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[120px]">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-300">
                          {user.stats?.blocksCreated || 0}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-300">
                          {user.stats?.votesGiven || 0}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-300">
                          {user.stats?.pledgeAmount ? `$${user.stats.pledgeAmount}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400">
                          {user.createdAt ? formatDate(user.createdAt) : '-'}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                          No users yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-all hover:scale-105"
        title="Admin Panel"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  )
}
