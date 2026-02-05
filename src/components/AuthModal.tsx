'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useContent } from '@/contexts/ContentContext'
import { isEmailBanned } from '@/lib/storage/bannedEmailsStorage'
import { EditableText } from './EditableText'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { signup, login, logout } = useAuth()
  const { getText } = useContent()
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pledgeAmount, setPledgeAmount] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        // Best-effort ban check before creating account
        // Wrapped in try-catch because Firestore rules may require auth
        try {
          const banned = await isEmailBanned(email)
          if (banned) {
            setError(getText('auth.error.banned', 'This email address has been banned'))
            setLoading(false)
            return
          }
        } catch {
          // Can't check ban list (permissions) — proceed with signup
        }
        if (!displayName.trim()) {
          setError(getText('auth.error.displayName', 'Please enter a display name'))
          setLoading(false)
          return
        }
        const pledge = parseInt(pledgeAmount, 10)
        if (isNaN(pledge) || pledge < 20) {
          setError(getText('auth.error.pledgeAmount', 'Please enter a pledge amount ($20 minimum)'))
          setLoading(false)
          return
        }
        await signup(email, password, displayName, pledge)
      } else {
        // Login first, then check ban (requires auth to read Firestore)
        await login(email, password)
        try {
          const banned = await isEmailBanned(email)
          if (banned) {
            await logout()
            setError(getText('auth.error.banned', 'This email address has been banned'))
            setLoading(false)
            return
          }
        } catch {
          // Can't check ban list — user is authenticated, proceed
        }
      }
      onClose()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-brand-dark border border-white/20 rounded-xl p-6 w-full max-w-md shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <h2 className="text-2xl font-bold mb-2">
          {mode === 'signup' ? (
            <EditableText
              id="auth.modal.signupHeader"
              defaultValue="Create Profile"
              category="auth"
            />
          ) : (
            <EditableText
              id="auth.modal.loginHeader"
              defaultValue="Welcome Back"
              category="auth"
            />
          )}
        </h2>
        <p className="text-gray-400 mb-6">
          {mode === 'signup' ? (
            <EditableText
              id="auth.modal.signupSubtitle"
              defaultValue="Add your own ideas, chat with local devs, and help shape what this becomes."
              category="auth"
            />
          ) : (
            <EditableText
              id="auth.modal.loginSubtitle"
              defaultValue="Sign in to continue."
              category="auth"
            />
          )}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium mb-1">
                <EditableText
                  id="auth.modal.displayNameLabel"
                  defaultValue="Display Name"
                  category="auth"
                />
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-primary"
                placeholder={getText('auth.placeholder.displayName', 'How should we call you?')}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              <EditableText id="auth.label.email" defaultValue="Email" category="auth" />
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-primary"
              placeholder={getText('auth.placeholder.email', 'you@example.com')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              <EditableText id="auth.label.password" defaultValue="Password" category="auth" />
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-brand-primary"
                placeholder={getText('auth.placeholder.password', 'At least 6 characters')}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium mb-1">
                <EditableText
                  id="auth.modal.pledgeLabel"
                  defaultValue="Chip In"
                  category="auth"
                />
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={pledgeAmount}
                  onChange={(e) => setPledgeAmount(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-7 pr-4 py-2 focus:outline-none focus:border-brand-primary"
                  placeholder={getText('auth.placeholder.pledge', 'How much would you pledge?')}
                  min={20}
                  required
                />
              </div>
              <EditableText
                id="auth.modal.pledgeHelper"
                defaultValue="You won't be charged until the countdown hits zero. Change anytime. ($20 min)"
                category="auth"
                as="p"
                className="text-xs text-gray-400 mt-1"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <EditableText id="auth.button.loading" defaultValue="Please wait..." category="auth" />
            ) : mode === 'signup' ? (
              <EditableText id="auth.button.signup" defaultValue="Create Account" category="auth" />
            ) : (
              <EditableText id="auth.button.login" defaultValue="Sign In" category="auth" />
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="mt-6 text-center text-sm text-gray-400">
          {mode === 'signup' ? (
            <>
              <EditableText id="auth.toggle.hasAccount" defaultValue="Already have an account?" category="auth" />{' '}
              <button
                onClick={() => setMode('login')}
                className="text-brand-accent hover:underline"
              >
                <EditableText id="auth.toggle.signIn" defaultValue="Sign in" category="auth" />
              </button>
            </>
          ) : (
            <>
              <EditableText id="auth.toggle.newHere" defaultValue="New here?" category="auth" />{' '}
              <button
                onClick={() => setMode('signup')}
                className="text-brand-accent hover:underline"
              >
                <EditableText id="auth.toggle.createAccount" defaultValue="Create an account" category="auth" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
