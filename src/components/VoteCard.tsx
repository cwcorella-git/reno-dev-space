'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Proposal,
  voteOnProposal,
  getUserVote,
  getNetVotes,
  getTotalVoters,
  hasQuorum,
  QUORUM_THRESHOLD,
  formatTimeRemaining,
} from '@/lib/proposalStorage'

interface VoteCardProps {
  proposal: Proposal
  onVoteChange?: () => void
}

export function VoteCard({ proposal, onVoteChange }: VoteCardProps) {
  const { user } = useAuth()
  const [voting, setVoting] = useState(false)

  const userVote = user ? getUserVote(proposal, user.uid) : null
  const netVotes = getNetVotes(proposal)
  const totalVoters = getTotalVoters(proposal)
  const quorumMet = hasQuorum(proposal)
  const timeRemaining = formatTimeRemaining(proposal.expiresAt)

  const handleVote = async (vote: 'up' | 'down') => {
    if (!user || voting || proposal.status !== 'active') return

    setVoting(true)
    try {
      await voteOnProposal(proposal.id, user.uid, vote)
      onVoteChange?.()
    } catch (error) {
      console.error('Failed to vote:', error)
    } finally {
      setVoting(false)
    }
  }

  const typeLabel = {
    name: 'Name Proposal',
    value: 'Core Value',
    idea: 'Community Idea',
  }[proposal.type]

  const typeColor = {
    name: 'bg-purple-500/20 text-purple-300',
    value: 'bg-blue-500/20 text-blue-300',
    idea: 'bg-green-500/20 text-green-300',
  }[proposal.type]

  const statusBadge = {
    active: null,
    passed: <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs">Passed</span>,
    rejected: <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">Rejected</span>,
    expired: <span className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded text-xs">Expired</span>,
  }[proposal.status]

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${typeColor}`}>
            {typeLabel}
          </span>
          {statusBadge && <span className="ml-2">{statusBadge}</span>}
        </div>
        {proposal.status === 'active' && (
          <span className="text-xs text-gray-400">{timeRemaining}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold mb-2">{proposal.title}</h3>

      {/* Description */}
      {proposal.description && (
        <p className="text-gray-400 text-sm mb-4">{proposal.description}</p>
      )}

      {/* Proposer */}
      <p className="text-xs text-gray-500 mb-4">
        Proposed by {proposal.proposedByName}
      </p>

      {/* Voting */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Upvote */}
          <button
            onClick={() => handleVote('up')}
            disabled={!user || voting || proposal.status !== 'active'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
              userVote === 'up'
                ? 'bg-green-500/30 text-green-300'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span className="text-sm">{proposal.upvotes.length}</span>
          </button>

          {/* Downvote */}
          <button
            onClick={() => handleVote('down')}
            disabled={!user || voting || proposal.status !== 'active'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
              userVote === 'down'
                ? 'bg-red-500/30 text-red-300'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-sm">{proposal.downvotes.length}</span>
          </button>
        </div>

        {/* Quorum / Net score */}
        <div className="text-sm">
          {proposal.status === 'active' && !quorumMet ? (
            <span className="text-yellow-400">
              {totalVoters}/{QUORUM_THRESHOLD} to decide
            </span>
          ) : (
            <>
              <span className={netVotes > 0 ? 'text-green-400' : netVotes < 0 ? 'text-red-400' : 'text-gray-400'}>
                {netVotes > 0 ? '+' : ''}{netVotes}
              </span>
              <span className="text-gray-500"> net</span>
            </>
          )}
        </div>
      </div>

      {/* Login prompt */}
      {!user && proposal.status === 'active' && (
        <p className="text-xs text-gray-500 mt-3">
          Sign in to vote on this proposal
        </p>
      )}
    </div>
  )
}
