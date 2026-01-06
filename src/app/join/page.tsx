'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function JoinPage() {
  const { user, profile, signup, updateUserProfile, loading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<'signup' | 'profile'>('signup')

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user && profile) {
      router.push('/')
    } else if (user && !profile) {
      setStep('profile')
    }
  }, [user, profile, router])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await signup(email, password, displayName)
      router.push('/')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim())
    } finally {
      setSubmitting(false)
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await updateUserProfile({ bio })
      router.push('/')
    } catch (err) {
      setError('Failed to update profile')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Join the Collective</h1>
        <p className="text-xl text-gray-300">
          Become a founding member. Shape the future.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Benefits */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">What You Get</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-brand-accent text-xl">&#10003;</span>
              <div>
                <strong>Vote on everything</strong>
                <p className="text-sm text-gray-400">Name, values, rules - you decide</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-brand-accent text-xl">&#10003;</span>
              <div>
                <strong>Propose ideas</strong>
                <p className="text-sm text-gray-400">Shape the collective&apos;s direction</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-brand-accent text-xl">&#10003;</span>
              <div>
                <strong>Connect with creators</strong>
                <p className="text-sm text-gray-400">Find collaborators, share knowledge</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-brand-accent text-xl">&#10003;</span>
              <div>
                <strong>Keep what you make</strong>
                <p className="text-sm text-gray-400">100% of your work is yours. Always.</p>
              </div>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-brand-primary/10 rounded-lg">
            <h3 className="font-semibold mb-2">No obligations</h3>
            <p className="text-sm text-gray-300">
              Membership is free during the founding phase. We&apos;re building
              this together. Come and go as you please.
            </p>
          </div>
        </div>

        {/* Signup Form */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          {step === 'signup' ? (
            <>
              <h2 className="text-xl font-semibold mb-4">Create Account</h2>
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-primary"
                    placeholder="How should we call you?"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-primary"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-primary"
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating account...' : 'Join Now'}
                </button>
              </form>

              <p className="text-xs text-gray-500 mt-4 text-center">
                Already have an account?{' '}
                <a href="/" className="text-brand-accent hover:underline">
                  Sign in from the navigation
                </a>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-4">Complete Your Profile</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Bio <span className="text-gray-500">(optional)</span>
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-primary resize-none"
                    placeholder="Tell us about yourself, your interests, what you're working on..."
                    rows={4}
                    maxLength={300}
                  />
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Complete Setup'}
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-full text-gray-400 hover:text-white py-2 text-sm"
                >
                  Skip for now
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
