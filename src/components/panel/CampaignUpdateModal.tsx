'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { sendCampaignUpdate, CampaignUpdateData } from '@/lib/emailFunctions'

interface CampaignUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  stats: {
    totalRaised: number
    goalAmount: number
    percentComplete: number
    backerCount: number
    daysLeft: number
  }
  onSuccess: (emailsSent: number) => void
  onError: (message: string) => void
}

export function CampaignUpdateModal({
  isOpen,
  onClose,
  stats,
  onSuccess,
  onError,
}: CampaignUpdateModalProps) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return

    setSending(true)
    const data: CampaignUpdateData = {
      milestoneTitle: title.trim(),
      milestoneMessage: message.trim(),
    }

    const result = await sendCampaignUpdate(data)

    if (result.success) {
      onSuccess(result.emailsSent)
      setTitle('')
      setMessage('')
      onClose()
    } else {
      onError(result.error || 'Failed to send update emails')
    }
    setSending(false)
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose()
      }}
    >
      <div
        className="w-full max-w-lg bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-white font-semibold">Send Campaign Update</h3>
          <button
            onClick={onClose}
            disabled={sending}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-50"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Stats Preview */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-2">This email will include:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-300">
                Progress: <span className="text-white font-medium">{stats.percentComplete}%</span>
              </div>
              <div className="text-gray-300">
                Raised: <span className="text-white font-medium">${stats.totalRaised.toLocaleString()}</span>
              </div>
              <div className="text-gray-300">
                Goal: <span className="text-white font-medium">${stats.goalAmount.toLocaleString()}</span>
              </div>
              <div className="text-gray-300">
                Days left: <span className="text-white font-medium">{stats.daysLeft}</span>
              </div>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Milestone Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Halfway There!"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
              disabled={sending}
            />
          </div>

          {/* Message Textarea */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Message to Backers
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share an update about the campaign progress..."
              rows={4}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
              disabled={sending}
            />
          </div>

          {/* Recipient Count */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              Will be sent to <span className="text-white font-medium">{stats.backerCount}</span> backers
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10 bg-white/5">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!title.trim() || !message.trim() || sending || stats.backerCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Update'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
