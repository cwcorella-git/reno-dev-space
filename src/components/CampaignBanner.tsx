'use client'

import { useState, useEffect } from 'react'
import { TrophyIcon, UserGroupIcon } from '@heroicons/react/24/solid'
import { EditableText } from './EditableText'
import {
  subscribeToCampaignSettings,
  getTimeRemaining,
  lockCampaign,
  CampaignSettings,
} from '@/lib/storage/campaignStorage'
import { subscribeToPledges, calculatePledgeSummary, Pledge } from '@/lib/storage/pledgeStorage'
import { subscribeToUsers, UserProfile } from '@/lib/storage/userStorage'
import { DonateModal } from './DonateModal'

const MEMBER_THRESHOLD = 5

export function CampaignBanner() {
  const [showDonateModal, setShowDonateModal] = useState(false)
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining({
    timerStartedAt: null,
    timerDurationMs: 0,
    fundingGoal: 5000,
    isLocked: false,
    pageViews: 0,
  }))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Subscribe to campaign settings
  useEffect(() => {
    if (!mounted) return

    const unsubscribe = subscribeToCampaignSettings((newSettings) => {
      setSettings(newSettings)
    })

    return () => unsubscribe()
  }, [mounted])

  // Subscribe to pledges
  useEffect(() => {
    if (!mounted) return

    const unsubscribe = subscribeToPledges((newPledges) => {
      setPledges(newPledges)
    })

    return () => unsubscribe()
  }, [mounted])

  // Subscribe to member count
  useEffect(() => {
    if (!mounted) return

    const unsubscribe = subscribeToUsers(
      (users: UserProfile[]) => setMemberCount(users.length),
      () => setMemberCount(0)
    )

    return () => unsubscribe()
  }, [mounted])

  // Update countdown timer every second
  useEffect(() => {
    if (!settings?.timerStartedAt) return

    const updateTimer = () => {
      const remaining = getTimeRemaining(settings)
      setTimeRemaining(remaining)

      // Auto-lock when timer expires
      if (remaining.isExpired && !settings.isLocked) {
        lockCampaign()
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [settings])

  if (!mounted) return null

  const isReady = memberCount >= MEMBER_THRESHOLD
  const campaignActive = !!settings?.timerStartedAt

  // Inert state: no active campaign
  if (!campaignActive) {
    return (
      <div className={`fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-gradient-to-r ${
        isReady ? 'from-emerald-900 via-teal-800 to-emerald-900' : 'from-slate-800 via-gray-800 to-slate-800'
      }`}>
        <div className="max-w-4xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-center gap-3">
            <UserGroupIcon className={`w-5 h-5 ${isReady ? 'text-emerald-300' : 'text-gray-400'}`} />
            <span className={`text-sm font-medium ${isReady ? 'text-emerald-200' : 'text-gray-300'}`}>
              {isReady ? (
                <EditableText id="campaign.banner.ready" defaultValue="We're ready to launch!" category="campaign" />
              ) : (
                <EditableText id="campaign.banner.teaser" defaultValue="A campaign is brewing..." category="campaign" />
              )}
            </span>
            <span className={`text-sm font-bold ${isReady ? 'text-emerald-300' : 'text-white'}`}>
              {memberCount}/{MEMBER_THRESHOLD}
            </span>
            <span className={`text-xs ${isReady ? 'text-emerald-400' : 'text-gray-400'}`}>
              <EditableText id="campaign.banner.memberCount" defaultValue="members" category="campaign" />
            </span>
          </div>
        </div>
      </div>
    )
  }

  const summary = calculatePledgeSummary(pledges, settings!.fundingGoal)
  const isExpired = timeRemaining.isExpired || settings!.isLocked

  // Format time display - always show seconds
  const formatTime = () => {
    if (isExpired) return null
    const { days, hours, minutes, seconds } = timeRemaining
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    }
    return `${minutes}m ${seconds}s`
  }

  // Determine if campaign was successful
  const isSuccess = isExpired && summary.percentComplete >= 100

  return (
    <>
      <div className={`fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-gradient-to-r ${
          isSuccess
            ? 'from-emerald-900 via-green-800 to-emerald-900'
            : 'from-indigo-900 via-purple-900 to-indigo-900'
        }`}>
        <div className="max-w-4xl mx-auto px-4 py-2.5">
          {/* Single Row: Timer | Progress Bar + Goal | Donate */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Left: Timer */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {isExpired ? (
                isSuccess ? (
                  <span className="flex items-center gap-1.5 text-green-300 font-bold text-sm sm:text-base">
                    <TrophyIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    <EditableText id="campaign.banner.goal" defaultValue="GOAL!" category="campaign" />
                  </span>
                ) : (
                  <span className="text-purple-300 font-bold text-sm sm:text-base"><EditableText id="campaign.banner.complete" defaultValue="Complete" category="campaign" /></span>
                )
              ) : (
                <>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-mono text-white font-bold text-sm sm:text-base whitespace-nowrap">{formatTime()}</span>
                </>
              )}
            </div>

            {/* Center: Progress Bar + Goal */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-1 h-2.5 sm:h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isSuccess
                      ? 'bg-gradient-to-r from-green-400 to-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                      : summary.percentComplete >= 100
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`}
                  style={{ width: `${Math.min(summary.percentComplete, 100)}%` }}
                />
              </div>
              <div className="text-xs sm:text-sm text-white font-bold whitespace-nowrap">
                ${summary.total.toLocaleString()}
                <span className="text-white/50 font-normal">/${summary.goal.toLocaleString()}</span>
              </div>
            </div>

            {/* Right: Donate button */}
            {!isExpired && (
              <button
                onClick={() => setShowDonateModal(true)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-xs sm:text-sm font-bold rounded-full transition-all hover:scale-105 shadow-lg shadow-purple-500/30 shrink-0"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <EditableText id="campaign.banner.donate" defaultValue="Donate" category="campaign" />
              </button>
            )}
          </div>

          {/* Public backers list */}
          {pledges.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
                {[...pledges]
                  .sort((a, b) => b.amount - a.amount)
                  .slice(0, 12)
                  .map((pledge) => (
                    <span key={pledge.odId}>
                      {pledge.displayName}: <span className="text-white">${pledge.amount}</span>
                    </span>
                  ))}
                {pledges.length > 12 && (
                  <span className="text-white/50">+{pledges.length - 12} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Donate Modal */}
      {showDonateModal && <DonateModal onClose={() => setShowDonateModal(false)} />}
    </>
  )
}
