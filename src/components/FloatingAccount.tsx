'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from '@/components/AuthModal'

export function FloatingAccount() {
  const { user, profile, isAdmin, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'

  const handleLogout = async () => {
    await logout()
    setIsOpen(false)
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50">
        {/* Account Panel */}
        {isOpen && (
          <div className="bg-brand-dark border border-white/20 rounded-xl shadow-2xl overflow-hidden w-72 mb-2">
            {/* Header */}
            <div className="bg-brand-primary/20 px-4 py-3 flex items-center justify-between border-b border-white/10">
              <span className="font-medium text-sm">Account</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {user ? (
                <div className="space-y-4">
                  {/* User Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{displayName}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      {isAdmin && (
                        <span className="inline-block mt-1 text-xs bg-indigo-600/50 text-indigo-200 px-2 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">Sign in to vote on content and join the chat.</p>
                  <button
                    onClick={() => {
                      setShowAuthModal(true)
                      setIsOpen(false)
                    }}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Login / Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`${
            user ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-700 hover:bg-gray-600'
          } text-white p-4 rounded-full shadow-lg transition-all hover:scale-105 relative`}
          title={user ? 'Account' : 'Sign In'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {user && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-brand-dark" />
          )}
        </button>
      </div>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  )
}
