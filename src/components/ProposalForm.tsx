'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createProposal, ProposalType } from '@/lib/proposalStorage'

interface ProposalFormProps {
  onSuccess?: () => void
  defaultType?: ProposalType
}

export function ProposalForm({ onSuccess, defaultType = 'idea' }: ProposalFormProps) {
  const { user, profile } = useAuth()
  const [type, setType] = useState<ProposalType>(defaultType)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      await createProposal(
        type,
        title.trim(),
        description.trim(),
        user.uid,
        profile.displayName
      )
      setTitle('')
      setDescription('')
      setSuccess(true)
      onSuccess?.()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError('Failed to create proposal. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-gray-400">Sign in to propose ideas</p>
      </div>
    )
  }

  const typeDescriptions = {
    name: 'Suggest a name for the collective',
    value: 'Propose a core value or principle',
    idea: 'Share an idea for discussion',
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Create a Proposal</h3>

      {/* Type selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Type</label>
        <div className="flex gap-2 flex-wrap">
          {(['name', 'value', 'idea'] as ProposalType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === t
                  ? 'bg-brand-primary text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {t === 'name' ? 'Name' : t === 'value' ? 'Core Value' : 'Idea'}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">{typeDescriptions[type]}</p>
      </div>

      {/* Title */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          {type === 'name' ? 'Proposed Name' : 'Title'}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-primary"
          placeholder={
            type === 'name'
              ? 'e.g., Reno Game Collective'
              : type === 'value'
              ? 'e.g., Horizontal Structure'
              : 'e.g., Weekly Game Jam'
          }
          required
          maxLength={100}
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Description <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-primary resize-none"
          placeholder="Explain your proposal..."
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-gray-500 mt-1">{description.length}/500</p>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-500/20 border border-green-500/50 text-green-200 px-4 py-2 rounded-lg text-sm">
          Proposal created successfully!
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating...' : 'Submit Proposal'}
      </button>

      <p className="text-xs text-gray-500 mt-3 text-center">
        Proposals need +5 net votes to pass and expire after 14 days
      </p>
    </form>
  )
}
