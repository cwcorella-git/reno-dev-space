'use client'

import { useEffect, useState } from 'react'
import { Proposal, subscribeToProposals } from '@/lib/proposalStorage'
import { VoteCard } from './VoteCard'

interface ActiveVotesProps {
  limit?: number
  type?: 'name' | 'value' | 'idea'
}

export function ActiveVotes({ limit, type }: ActiveVotesProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToProposals((allProposals) => {
      const active = allProposals.filter(
        (p) => p.status === 'active' && p.expiresAt > Date.now()
      )
      setProposals(limit ? active.slice(0, limit) : active)
      setLoading(false)
    }, type)

    return unsubscribe
  }, [limit, type])

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 rounded-xl p-5 animate-pulse"
          >
            <div className="h-4 bg-white/10 rounded w-24 mb-4" />
            <div className="h-6 bg-white/10 rounded w-3/4 mb-2" />
            <div className="h-4 bg-white/10 rounded w-full mb-4" />
            <div className="h-8 bg-white/10 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <p className="text-gray-400">No active votes right now.</p>
        <p className="text-sm text-gray-500 mt-2">
          Be the first to propose something!
        </p>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {proposals.map((proposal) => (
        <VoteCard key={proposal.id} proposal={proposal} />
      ))}
    </div>
  )
}
