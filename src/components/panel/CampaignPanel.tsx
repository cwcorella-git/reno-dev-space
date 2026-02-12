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
} from '@/lib/storage/campaignStorage'
import { resetAllBrightness } from '@/lib/storage/canvasStorage'
import { setEffectsEnabled } from '@/lib/storage/effectsStorage'
import { useEffects } from '@/contexts/EffectsContext'
import { useContent } from '@/contexts/ContentContext'
import { EditableText } from '@/components/EditableText'

export function CampaignPanel() {
  const { user, isAdmin } = useAuth()
  const { getText } = useContent()
  const { settings: effectsSettings } = useEffects()

  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [goalInput, setGoalInput] = useState('5000')

  useEffect(() => {
    const unsubSettings = subscribeToCampaignSettings((s) => {
      setSettings(s)
      setGoalInput(s.fundingGoal.toString())
    })
    return () => unsubSettings()
  }, [])

  if (!user || !isAdmin) {
    return (
      <div className="p-4 text-center text-gray-400">
        <EditableText id="panel.admin.required" defaultValue="Admin access required" category="panel" />
      </div>
    )
  }

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
    showStatus('success', getText('campaign.status.resetBrightness', `Reset brightness for ${count} block(s)`))
    setConfirmAction(null)
    setActionLoading(false)
  }

  const handleToggleEffects = async () => {
    setActionLoading(true)
    await setEffectsEnabled(!effectsSettings?.enabled)
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
            {confirmAction === 'brightness' && <EditableText id="campaign.confirm.resetBrightness" defaultValue="Reset brightness for all blocks?" category="campaign" />}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmAction(null)} disabled={actionLoading} className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-sm">
              <EditableText id="campaign.button.cancel" defaultValue="Cancel" category="campaign" />
            </button>
            <button
              onClick={() => {
                if (confirmAction === 'brightness') handleResetBrightness()
              }}
              disabled={actionLoading}
              className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
            >
              {actionLoading ? '...' : <EditableText id="campaign.button.confirm" defaultValue="Confirm" category="campaign" />}
            </button>
          </div>
        </div>
      )}

      {!confirmAction && (
        <div className="p-4 space-y-3">
          {/* Timer + Lock */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400"><EditableText id="campaign.label.timer" defaultValue="Timer" category="campaign" /></span>
            <div className="flex items-center gap-2">
              {timerActive ? (
                <button onClick={handleResetTimer} disabled={actionLoading} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50">
                  <EditableText id="campaign.button.reset" defaultValue="Reset" category="campaign" />
                </button>
              ) : (
                <button onClick={handleStartTimer} disabled={actionLoading} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium disabled:opacity-50">
                  <EditableText id="campaign.button.start" defaultValue="Start" category="campaign" />
                </button>
              )}
              <button onClick={handleToggleLock} disabled={actionLoading} className={`px-3 py-1 rounded text-xs font-medium disabled:opacity-50 ${settings?.isLocked ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}>
                {settings?.isLocked
                  ? <EditableText id="campaign.button.unlock" defaultValue="Unlock" category="campaign" />
                  : <EditableText id="campaign.button.lock" defaultValue="Lock" category="campaign" />}
              </button>
              <button onClick={() => setConfirmAction('brightness')} disabled={actionLoading} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-xs disabled:opacity-50">
                <EditableText id="campaign.button.resetVotes" defaultValue="Reset Votes" category="campaign" />
              </button>
            </div>
          </div>

          {/* Goal + Effects */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400"><EditableText id="campaign.label.goal" defaultValue="Goal" category="campaign" /></span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">$</span>
              <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs text-right" />
              <button onClick={handleUpdateGoal} disabled={actionLoading} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs disabled:opacity-50">
                <EditableText id="campaign.button.set" defaultValue="Set" category="campaign" />
              </button>
            </div>
          </div>

          {/* Ring-Burst Effects */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400"><EditableText id="campaign.label.ringBurst" defaultValue="Ring-Burst Effects" category="campaign" /></span>
            <button
              onClick={handleToggleEffects}
              disabled={actionLoading}
              className={`px-3 py-1 rounded text-xs font-medium disabled:opacity-50 ${
                effectsSettings?.enabled
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-gray-300'
              }`}
            >
              {effectsSettings?.enabled
                ? <EditableText id="campaign.button.enabled" defaultValue="Enabled" category="campaign" />
                : <EditableText id="campaign.button.disabled" defaultValue="Disabled" category="campaign" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
