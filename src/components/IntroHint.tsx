'use client'

import { useState } from 'react'
import { AuthModal } from './AuthModal'

export function IntroHint() {
  const [showAuth, setShowAuth] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <>
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90vw] max-w-lg">
        <div className="bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5 shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold text-white">Reno Dev Space</h2>
              <p className="text-indigo-400 text-sm">A non-profit game developer space</p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-500 hover:text-white p-1"
              title="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Description */}
          <p className="text-gray-300 text-sm mb-4">
            A community space for indie game developers in Reno to collaborate, share ideas, and build games together. No managers, no gatekeepers—just creators.
          </p>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-white/5 rounded-lg">
              <div className="text-2xl mb-1">💬</div>
              <p className="text-xs text-gray-400">Community Chat</p>
            </div>
            <div className="text-center p-2 bg-white/5 rounded-lg">
              <div className="text-2xl mb-1">✨</div>
              <p className="text-xs text-gray-400">Vote on Content</p>
            </div>
            <div className="text-center p-2 bg-white/5 rounded-lg">
              <div className="text-2xl mb-1">🎮</div>
              <p className="text-xs text-gray-400">Project Driven</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowAuth(true)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Join the Community
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-4 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Browse First
            </button>
          </div>
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )
}
