'use client'

import { useEffect, useState } from 'react'
import { VoteBlock } from '@/types/canvas'
import { VoteCard } from '@/components/VoteCard'
import { Proposal, subscribeToProposal } from '@/lib/proposalStorage'

interface VoteBlockRendererProps {
  block: VoteBlock
}

export function VoteBlockRenderer({ block }: VoteBlockRendererProps) {
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!block.proposalId) {
      setError('No proposal linked')
      setLoading(false)
      return
    }

    const unsubscribe = subscribeToProposal(
      block.proposalId,
      (p) => {
        setProposal(p)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[VoteBlockRenderer] Error:', err)
        setError('Failed to load proposal')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [block.proposalId])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/50" />
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
        {error || 'Proposal not found'}
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <VoteCard proposal={proposal} />
    </div>
  )
}
