'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { EditableText } from '../EditableText'

const PRESET_AMOUNTS = [25, 50, 100, 250]
const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL || 'https://us-central1-reno-dev-space.cloudfunctions.net'

export function DonateTab() {
  const { user, profile } = useAuth()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50)
  const [customAmount, setCustomAmount] = useState('')
  const [updatePledge, setUpdatePledge] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const effectiveAmount = selectedAmount || parseInt(customAmount, 10) || 0

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount)
    setCustomAmount('')
  }

  const handleCustomChange = (value: string) => {
    setCustomAmount(value)
    setSelectedAmount(null)
  }

  const handleDonate = async () => {
    if (effectiveAmount < 1) {
      setError('Please enter an amount of at least $1')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${FUNCTIONS_URL}/createCheckoutSession`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: effectiveAmount * 100, // Convert to cents
          userId: user?.uid || null,
          displayName: profile?.displayName || null,
          email: user?.email || null,
          updatePledge: updatePledge && user,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Donation error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="text-center">
        <EditableText
          id="panel.donate.title"
          defaultValue="Support Reno Dev Space"
          category="panel"
          as="h3"
          className="text-lg font-semibold text-white"
        />
        <EditableText
          id="panel.donate.subtitle"
          defaultValue="Help fund what we're building"
          category="panel"
          as="p"
          className="text-sm text-gray-400 mt-1"
        />
      </div>

      {/* Preset amounts */}
      <div className="flex gap-2 justify-center">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            onClick={() => handlePresetClick(amount)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedAmount === amount
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            ${amount}
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-gray-400">or</span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Custom"
            min={1}
            className={`w-28 pl-7 pr-3 py-2 bg-white/10 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              selectedAmount === null && customAmount
                ? 'border-indigo-500'
                : 'border-white/20'
            }`}
          />
        </div>
      </div>

      {/* Update pledge checkbox (only for logged in users) */}
      {user && (
        <label className="flex items-center justify-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={updatePledge}
            onChange={(e) => setUpdatePledge(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/10 text-indigo-600 focus:ring-indigo-500"
          />
          Update my pledge to ${effectiveAmount || '...'}
        </label>
      )}

      {/* Error message */}
      {error && (
        <div className="text-center text-red-400 text-sm">{error}</div>
      )}

      {/* Donate button */}
      <button
        onClick={handleDonate}
        disabled={loading || effectiveAmount < 1}
        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Donate ${effectiveAmount || '...'}
          </>
        )}
      </button>

      {/* Secure payment note */}
      <EditableText
        id="panel.donate.secureNote"
        defaultValue="Secure payment via Stripe. You'll be redirected to complete payment."
        category="panel"
        as="p"
        className="text-center text-xs text-gray-500"
      />
    </div>
  )
}
