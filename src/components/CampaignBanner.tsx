'use client'

import { useState, useEffect } from 'react'
import {
  subscribeToCampaignSettings,
  getTimeRemaining,
  lockCampaign,
  CampaignSettings,
} from '@/lib/campaignStorage'
import { subscribeToPledges, calculatePledgeSummary, Pledge } from '@/lib/pledgeStorage'
import { DonateModal } from './DonateModal'

export function CampaignBanner() {
  const [showDonateModal, setShowDonateModal] = useState(false)
  const [settings, setSettings] = useState<CampaignSettings | null>(null)
  const [pledges, setPledges] = useState<Pledge[]>([])
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

  if (!mounted || !settings?.timerStartedAt) return null

  const summary = calculatePledgeSummary(pledges, settings.fundingGoal)
  const isExpired = timeRemaining.isExpired || settings.isLocked

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
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2">
          {/* Single-row layout using CSS Grid for true centering */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-2">
            {/* Left: Timer */}
            <div className="flex items-center gap-2">
              {isExpired ? (
                isSuccess ? (
                  <span className="flex items-center gap-1.5 text-green-300 font-medium text-sm sm:text-base">
                    <span className="text-base sm:text-lg">🏆</span>
                    <span className="hidden xs:inline">GOAL REACHED!</span>
                    <span className="xs:hidden">GOAL!</span>
                  </span>
                ) : (
                  <span className="text-purple-300 font-medium text-sm sm:text-base">Campaign Complete</span>
                )
              ) : (
                <>
                  <svg className="w-4 h-4 text-indigo-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-mono text-white font-medium text-sm sm:text-base whitespace-nowrap">{formatTime()}</span>
                </>
              )}
            </div>

            {/* Center: Stats (truly centered via grid) */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-white">
              <span className="flex items-center gap-1 sm:gap-1.5 text-white/70">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {summary.count}
              </span>
              <span className="text-white/40">·</span>
              <span className="font-bold whitespace-nowrap">
                ${summary.total.toLocaleString()}
                <span className="text-white/50 font-normal"> / ${summary.goal.toLocaleString()}</span>
              </span>
              <span className="text-white/40">·</span>
              <span className={`font-bold ${isSuccess ? 'text-green-300' : summary.percentComplete >= 100 ? 'text-green-400' : 'text-indigo-300'}`}>
                {summary.percentComplete}%
              </span>
            </div>

            {/* Right: Donate button */}
            <div className="flex justify-end">
              {!isExpired && (
                <button
                  onClick={() => setShowDonateModal(true)}
                  className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-medium rounded-full transition-all hover:scale-105"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Donate
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 sm:h-3 bg-white/20 rounded-full overflow-hidden">
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
