'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
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

export function AdminTab() {
  const { isAdmin } = useAuth()
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [goalInput, setGoalInput] = useState('5000')
  const [loading, setLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return

    const unsubPledges = subscribeToPledges(setPledges)
    const unsubSettings = subscribeToCampaignSettings((s) => {
      setSettings(s)
      setGoalInput(s.fundingGoal.toString())
    })

    return () => {
      unsubPledges()
      unsubSettings()
    }
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="px-4 py-6 text-center text-gray-500 text-sm">
        Admin access required
      </div>
    )
  }

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
    if (confirmAction !== 'resetBrightness') {
      setConfirmAction('resetBrightness')
      return
    }
    setConfirmAction(null)
    setLoading(true)
    const count = await resetAllBrightness()
    setStatusMessage(`Reset brightness for ${count} block(s)`)
    setTimeout(() => setStatusMessage(null), 3000)
    setLoading(false)
  }

  const cancelConfirm = () => setConfirmAction(null)

  return (
    <div className="p-3 space-y-3">
      {/* Timer & Lock Controls */}
      <div className="flex flex-wrap gap-2">
        {timerActive ? (
          <button
            onClick={handleResetTimer}
            disabled={loading}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            Reset Timer
          </button>
        ) : (
          <button
            onClick={handleStartTimer}
            disabled={loading}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            Start 2-Week Timer
          </button>
        )}

        <button
          onClick={handleToggleLock}
          disabled={loading}
          className={`px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50 ${
            settings?.isLocked
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          {settings?.isLocked ? 'Unlock Pledges' : 'Lock Pledges'}
        </button>

        {confirmAction === 'resetBrightness' ? (
          <div className="flex items-center gap-2 px-2 py-1 bg-yellow-600/20 border border-yellow-600/50 rounded">
            <span className="text-xs text-yellow-200">Reset all brightness?</span>
            <button
              onClick={handleResetBrightness}
              className="px-2 py-0.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs"
            >
              Yes
            </button>
            <button
              onClick={cancelConfirm}
              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={handleResetBrightness}
            disabled={loading}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm disabled:opacity-50"
          >
            Reset Brightness
          </button>
        )}
      </div>

      {/* Status message */}
      {statusMessage && (
        <div className="px-3 py-1.5 bg-green-600/20 border border-green-600/50 rounded text-sm text-green-200">
          {statusMessage}
        </div>
      )}

      {/* Funding Goal */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400">Goal: $</span>
        <input
          type="number"
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
          className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
        />
        <button
          onClick={handleUpdateGoal}
          disabled={loading}
          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm disabled:opacity-50"
        >
          Set
        </button>
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
              ${amount >= 1000 ? `${amount / 1000}k` : amount}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-400 pt-2 border-t border-white/10">
        <span>Views: <span className="text-white">{settings?.pageViews || 0}</span></span>
        {summary && (
          <>
            <span>Pledged: <span className="text-white">${summary.total}</span></span>
            <span>Backers: <span className="text-white">{summary.count}</span></span>
            <span>Progress: <span className="text-white">{summary.percentComplete}%</span></span>
          </>
        )}
      </div>
    </div>
  )
}
