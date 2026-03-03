'use client'

import { useState, useEffect } from 'react'
import { ArrowPathIcon, BoltIcon } from '@heroicons/react/24/outline'
import { subscribeToPledges, Pledge, calculatePledgeSummary } from '@/lib/storage/pledgeStorage'
import { subscribeToCampaignSettings, CampaignSettings } from '@/lib/storage/campaignStorage'

interface EmailVariableEditorProps {
  variables: string[]
  sampleData: Record<string, string>
  onSampleDataChange: (data: Record<string, string>) => void
  onSave: () => void
  onCancel: () => void
}

export function EmailVariableEditor({
  variables,
  sampleData,
  onSampleDataChange,
  onSave,
  onCancel
}: EmailVariableEditorProps) {
  const [liveMode, setLiveMode] = useState(false)
  const [liveData, setLiveData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Subscribe to live campaign data
  useEffect(() => {
    if (!liveMode) return

    setLoading(true)
    let pledgesData: Pledge[] = []
    let settingsData: CampaignSettings | null = null

    const updateLiveData = () => {
      if (!settingsData) return

      const summary = calculatePledgeSummary(pledgesData, settingsData.fundingGoal)

      // Calculate days left
      const timerStartedAt = settingsData.timerStartedAt || Date.now()
      const timerDurationMs = settingsData.timerDurationMs || (14 * 24 * 60 * 60 * 1000)
      const endTime = timerStartedAt + timerDurationMs
      const daysLeft = Math.max(0, Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000)))
      const needed = Math.max(0, settingsData.fundingGoal - summary.total)

      const data: Record<string, string> = {
        TOTAL_RAISED: summary.total.toLocaleString(),
        CURRENT_AMOUNT: summary.total.toLocaleString(),
        GOAL_AMOUNT: settingsData.fundingGoal.toLocaleString(),
        PERCENT: summary.percentComplete.toString(),
        BACKER_COUNT: summary.count.toString(),
        DAYS_LEFT: daysLeft.toString(),
        NEEDED: needed.toLocaleString(),
        USER_PLEDGE: '100', // Default for preview
        NEW_BACKERS: '0',
        DAILY_AVERAGE: '0',
        MILESTONE_TITLE: 'Campaign Update',
        MILESTONE_MESSAGE: 'Thank you for your continued support!',
        VERIFICATION_LINK: 'https://cwcorella-git.github.io/reno-dev-space/'
      }

      setLiveData(data)
      onSampleDataChange(data)
      setLoading(false)
    }

    const unsubPledges = subscribeToPledges((p) => {
      pledgesData = p
      updateLiveData()
    })

    const unsubSettings = subscribeToCampaignSettings((s) => {
      settingsData = s
      updateLiveData()
    })

    return () => {
      unsubPledges()
      unsubSettings()
    }
  }, [liveMode, onSampleDataChange])

  const toggleLiveMode = () => {
    if (liveMode) {
      setLiveMode(false)
    } else {
      setLiveMode(true)
    }
  }

  const isLiveValue = (varName: string) => liveMode && liveData[varName] !== undefined

  return (
    <div className="flex flex-col h-full bg-gray-800/50 border-l border-white/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-semibold text-sm">Template Variables</h3>
          <button
            onClick={toggleLiveMode}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
              liveMode
                ? 'bg-green-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {loading ? (
              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BoltIcon className="w-3.5 h-3.5" />
            )}
            {liveMode ? 'Live' : 'Sample'}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          {liveMode
            ? 'Using real campaign data from Firestore'
            : 'Edit sample values to preview changes'}
        </p>
      </div>

      {/* Variable List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {variables.length === 0 ? (
          <p className="text-sm text-gray-400">No variables found in template</p>
        ) : (
          variables.map(varName => (
            <div key={varName}>
              <label className="flex items-center gap-2 text-xs text-gray-400 mb-1.5">
                <span className="font-mono">{`{{${varName}}}`}</span>
                {isLiveValue(varName) && (
                  <span className="px-1.5 py-0.5 bg-green-600/20 text-green-400 rounded text-[10px]">
                    LIVE
                  </span>
                )}
              </label>
              <input
                type="text"
                value={sampleData[varName] || ''}
                onChange={(e) => onSampleDataChange({
                  ...sampleData,
                  [varName]: e.target.value
                })}
                disabled={isLiveValue(varName)}
                className={`w-full px-3 py-2 border rounded text-sm focus:outline-none transition-colors ${
                  isLiveValue(varName)
                    ? 'bg-green-900/20 border-green-600/30 text-green-300 cursor-not-allowed'
                    : 'bg-gray-700 border-white/20 text-white focus:border-indigo-400'
                }`}
                placeholder={`Enter ${varName}`}
              />
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex gap-2 p-4 border-t border-white/10">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors"
        >
          Update Preview
        </button>
      </div>
    </div>
  )
}
