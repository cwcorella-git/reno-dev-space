'use client'

import { useEffect, useState } from 'react'
import { Proposal, subscribeToProposals, getNetVotes } from '@/lib/proposalStorage'

export function IdeasBoard() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToProposals((allProposals) => {
      // Show passed values and ideas, sorted by votes
      const passedItems = allProposals
        .filter((p) => p.status === 'passed' && (p.type === 'value' || p.type === 'idea'))
        .sort((a, b) => getNetVotes(b) - getNetVotes(a))

      setProposals(passedItems.slice(0, 9))
      setLoading(false)
    })

    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 rounded-xl p-5 animate-pulse"
          >
            <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
            <div className="h-4 bg-white/10 rounded w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <p className="text-gray-400">No community-approved ideas yet.</p>
        <p className="text-sm text-gray-500 mt-2">
          Propose values and ideas in the Governance section!
        </p>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {proposals.map((proposal) => (
        <div
          key={proposal.id}
          className="bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold">{proposal.title}</h3>
            <span className="text-xs text-green-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Approved
            </span>
          </div>
          {proposal.description && (
            <p className="text-sm text-gray-400">{proposal.description}</p>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>{proposal.type === 'value' ? 'Core Value' : 'Community Idea'}</span>
            <span>+{getNetVotes(proposal)} votes</span>
          </div>
        </div>
      ))}
    </div>
  )
}
