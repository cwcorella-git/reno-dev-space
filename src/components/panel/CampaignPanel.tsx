'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCanvas } from '@/contexts/CanvasContext'
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
import { subscribeToPledges, Pledge, calculatePledgeSummary } from '@/lib/storage/pledgeStorage'
import { subscribeToUsers, UserProfile } from '@/lib/storage/userStorage'
import {
  subscribeToEmailHistory,
  EmailHistoryEntry,
  formatRelativeTime,
  getTemplateDisplayName,
} from '@/lib/storage/emailHistoryStorage'
import {
  sendCampaignSuccessEmails,
  sendCampaignEndedEmails,
  sendTestEmail,
} from '@/lib/emailFunctions'
import { useEffects } from '@/contexts/EffectsContext'
import { useContent } from '@/contexts/ContentContext'
import { EditableText } from '@/components/EditableText'
import { EnvelopeIcon, CheckCircleIcon, ClockIcon, PaperAirplaneIcon, PencilSquareIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { CampaignUpdateModal } from './CampaignUpdateModal'
import { MeasurementControls } from '@/components/dev/MeasurementOverlay'

export function CampaignPanel() {
  const { user, isAdmin } = useAuth()
  const { getText } = useContent()
  const { settings: effectsSettings } = useEffects()
  const { measurementDebugConfig, setMeasurementDebugConfig } = useCanvas()

  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [goalInput, setGoalInput] = useState('5000')

  // Email dashboard state
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [emailHistory, setEmailHistory] = useState<EmailHistoryEntry[]>([])
  const [emailSending, setEmailSending] = useState<string | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  useEffect(() => {
    const unsubSettings = subscribeToCampaignSettings((s) => {
      setSettings(s)
      setGoalInput(s.fundingGoal.toString())
    })
    const unsubPledges = subscribeToPledges(setPledges)
    const unsubUsers = subscribeToUsers(setUsers)
    const unsubHistory = subscribeToEmailHistory(setEmailHistory, 5)

    return () => {
      unsubSettings()
      unsubPledges()
      unsubUsers()
      unsubHistory()
    }
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

  // Email dashboard helpers
  const pledgeSummary = calculatePledgeSummary(pledges, settings?.fundingGoal || 5000)
  const isGoalReached = pledgeSummary.total >= pledgeSummary.goal
  const isExpired = settings?.timerStartedAt
    ? Date.now() >= settings.timerStartedAt + settings.timerDurationMs
    : false
  const daysLeft = settings?.timerStartedAt
    ? Math.max(0, Math.ceil((settings.timerStartedAt + settings.timerDurationMs - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  // Get recipient list with emails
  const getRecipients = () => {
    return pledges.map((pledge) => {
      const userProfile = users.find((u) => u.uid === pledge.odId)
      return {
        odId: pledge.odId,
        displayName: pledge.displayName,
        amount: pledge.amount,
        email: userProfile?.email || 'unknown',
      }
    }).filter((r) => r.email !== 'unknown')
  }

  // Email send handlers
  const handleSendSuccessEmails = async () => {
    if (!isGoalReached) return
    setEmailSending('success')
    const result = await sendCampaignSuccessEmails()
    if (result.success) {
      showStatus('success', `Success emails sent to ${result.emailsSent} backers`)
    } else {
      showStatus('error', result.error || 'Failed to send emails')
    }
    setEmailSending(null)
  }

  const handleSendEndedEmails = async () => {
    if (!isExpired || isGoalReached) return
    setEmailSending('ended')
    const result = await sendCampaignEndedEmails()
    if (result.success) {
      showStatus('success', `Ended emails sent to ${result.emailsSent} backers`)
    } else {
      showStatus('error', result.error || 'Failed to send emails')
    }
    setEmailSending(null)
  }

  const handleSendTestEmail = async () => {
    setEmailSending('test')
    const result = await sendTestEmail('campaign-update.html')
    if (result.success) {
      showStatus('success', 'Test email sent to your inbox')
    } else {
      showStatus('error', result.error || 'Failed to send test email')
    }
    setEmailSending(null)
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

          {/* Dev Tools Section */}
          <div className="border-t border-white/10 pt-3 mt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <WrenchScrewdriverIcon className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-white">Dev Tools</span>
            </div>
            <MeasurementControls
              config={measurementDebugConfig}
              onChange={setMeasurementDebugConfig}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-2" />

          {/* Email Dashboard Section */}
          <div className="space-y-3">
            {/* Campaign Stats */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <EnvelopeIcon className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-medium text-white">Email Dashboard</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  <span className="text-white font-medium">${pledgeSummary.total.toLocaleString()}</span> raised
                </span>
                <span className="text-gray-400">
                  <span className="text-white font-medium">{pledgeSummary.count}</span> backers
                </span>
                <span className="text-gray-400">
                  <span className="text-white font-medium">{daysLeft}</span> days left
                </span>
                <span className="text-gray-400">
                  <span className="text-white font-medium">{pledgeSummary.percentComplete}%</span>
                </span>
              </div>
            </div>

            {/* Send Email Buttons */}
            <div>
              <span className="text-xs text-gray-400 mb-2 block">Send Emails</span>
              <div className="flex gap-2">
                <button
                  onClick={handleSendSuccessEmails}
                  disabled={!isGoalReached || emailSending !== null}
                  title={isGoalReached ? 'Send success emails to all backers' : 'Goal not yet reached'}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium disabled:opacity-50 ${
                    isGoalReached
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-white/10 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  {emailSending === 'success' ? '...' : 'Success'}
                </button>
                <button
                  onClick={handleSendEndedEmails}
                  disabled={!isExpired || isGoalReached || emailSending !== null}
                  title={isExpired && !isGoalReached ? 'Send ended emails to all backers' : 'Campaign not expired or goal reached'}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium disabled:opacity-50 ${
                    isExpired && !isGoalReached
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-white/10 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <ClockIcon className="w-3.5 h-3.5" />
                  {emailSending === 'ended' ? '...' : 'Ended'}
                </button>
                <button
                  onClick={() => setShowUpdateModal(true)}
                  disabled={emailSending !== null || pledges.length === 0}
                  title="Compose and send a campaign update"
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium disabled:opacity-50"
                >
                  <PencilSquareIcon className="w-3.5 h-3.5" />
                  Update
                </button>
                <button
                  onClick={handleSendTestEmail}
                  disabled={emailSending !== null}
                  title="Send test email to yourself"
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded text-xs font-medium disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="w-3.5 h-3.5" />
                  {emailSending === 'test' ? '...' : 'Test'}
                </button>
              </div>
            </div>

            {/* Recipients Preview */}
            {pledges.length > 0 && (
              <div>
                <span className="text-xs text-gray-400 mb-1.5 block">
                  Recipients ({pledges.length} backers)
                </span>
                <div className="flex flex-wrap gap-1">
                  {getRecipients().slice(0, 3).map((r) => (
                    <span
                      key={r.odId}
                      className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded"
                    >
                      {r.email.split('@')[0]}... (${r.amount})
                    </span>
                  ))}
                  {pledges.length > 3 && (
                    <span className="text-xs text-gray-500">+{pledges.length - 3} more</span>
                  )}
                </div>
              </div>
            )}

            {pledges.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-2">
                No backers yet — email buttons will activate when there are recipients
              </div>
            )}

            {/* Email History */}
            {emailHistory.length > 0 && (
              <div>
                <span className="text-xs text-gray-400 mb-1.5 block">Recent Sends</span>
                <div className="space-y-1">
                  {emailHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-xs bg-white/5 rounded px-2 py-1.5"
                    >
                      <span className="text-gray-300">
                        {getTemplateDisplayName(entry.templateId)}
                      </span>
                      <span className="text-gray-500">
                        {entry.recipientCount} → {formatRelativeTime(entry.sentAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Campaign Update Modal */}
      <CampaignUpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        stats={{
          totalRaised: pledgeSummary.total,
          goalAmount: pledgeSummary.goal,
          percentComplete: pledgeSummary.percentComplete,
          backerCount: pledgeSummary.count,
          daysLeft,
        }}
        onSuccess={(emailsSent) => {
          showStatus('success', `Update emails sent to ${emailsSent} backers`)
        }}
        onError={(message) => {
          showStatus('error', message)
        }}
      />
    </div>
  )
}
