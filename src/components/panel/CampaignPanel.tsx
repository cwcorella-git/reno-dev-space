'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
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
import { subscribeToPledges, calculatePledgeSummary, Pledge } from '@/lib/pledgeStorage'
import { subscribeToUsers, UserProfile } from '@/lib/userStorage'

const MEMBER_THRESHOLD = 5

export function CampaignPanel() {
  const { user, isAdmin } = useAuth()

  const [pledges, setPledges] = useState<Pledge[]>([])
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [goalInput, setGoalInput] = useState('5000')

  useEffect(() => {
    const unsubPledges = subscribeToPledges((p) => setPledges(p))
    const unsubSettings = subscribeToCampaignSettings((s) => {
      setSettings(s)
      setGoalInput(s.fundingGoal.toString())
    })
    const unsubUsers = subscribeToUsers(
      (users: UserProfile[]) => setMemberCount(users.length),
      () => setMemberCount(0)
    )
    return () => {
      unsubPledges()
      unsubSettings()
      unsubUsers()
    }
  }, [])

  if (!user || !isAdmin) {
    return (
      <div className="p-4 text-center text-gray-400">
        Admin access required
      </div>
    )
  }

  const summary = settings ? calculatePledgeSummary(pledges, settings.fundingGoal) : null
  const timerActive = !!settings?.timerStartedAt

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 3000)
  }

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
            {confirmAction === 'brightness' && 'Reset brightness for all blocks?'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmAction(null)} disabled={actionLoading} className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm">Cancel</button>
            <button
              onClick={() => {
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
        <div className="p-4 space-y-4">
          {/* Campaign Controls */}
          <div>
            <p className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">Controls</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {timerActive ? (
                <button onClick={handleResetTimer} disabled={actionLoading} className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50">Reset Timer</button>
              ) : (
                <>
                  <button onClick={handleStartTimer} disabled={actionLoading} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium disabled:opacity-50">Start Timer</button>
                  <span className={`text-xs ${memberCount < MEMBER_THRESHOLD ? 'text-yellow-400' : 'text-green-400'}`}>
                    {memberCount}/{MEMBER_THRESHOLD} members
                    {memberCount < MEMBER_THRESHOLD && ' (below threshold)'}
                  </span>
                </>
              )}
              <button onClick={handleToggleLock} disabled={actionLoading} className={`px-2 py-1 rounded text-xs font-medium disabled:opacity-50 ${settings?.isLocked ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                {settings?.isLocked ? 'Unlock' : 'Lock'}
              </button>
              <button onClick={() => setConfirmAction('brightness')} disabled={actionLoading} className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs disabled:opacity-50">Reset Brightness</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Goal: $</span>
              <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs" />
              <button onClick={handleUpdateGoal} disabled={actionLoading} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs disabled:opacity-50">Set</button>
            </div>
          </div>

          {/* Stats */}
          <div className="pt-3 border-t border-white/10">
            <p className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">Stats</p>
            <div className="text-xs text-gray-400 grid grid-cols-3 gap-2">
              <div><span className="block text-white font-medium">{settings?.pageViews || 0}</span>Views</div>
              {summary && <div><span className="block text-white font-medium">${summary.total}</span>Pledged</div>}
              <div><span className="block text-white font-mono">{process.env.NEXT_PUBLIC_COMMIT_SHA || 'dev'}</span>Build</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
