'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Proposal, subscribeToProposals } from '@/lib/proposalStorage'
import { VoteCard } from '@/components/VoteCard'
import { ProposalForm } from '@/components/ProposalForm'
import { AuthModal } from '@/components/AuthModal'

type Tab = 'active' | 'passed' | 'create'

export default function GovernancePage() {
  const { user } = useAuth()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'name' | 'value' | 'idea'>('all')

  useEffect(() => {
    const unsubscribe = subscribeToProposals((allProposals) => {
      setProposals(allProposals)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const filteredProposals = proposals.filter((p) => {
    if (filterType !== 'all' && p.type !== filterType) return false

    if (activeTab === 'active') {
      return p.status === 'active' && p.expiresAt > Date.now()
    } else if (activeTab === 'passed') {
      return p.status === 'passed' || p.status === 'rejected' || p.status === 'expired'
    }
    return true
  })

  const tabs = [
    { id: 'active' as Tab, label: 'Active Votes', count: proposals.filter(p => p.status === 'active').length },
    { id: 'passed' as Tab, label: 'History', count: proposals.filter(p => p.status !== 'active').length },
    { id: 'create' as Tab, label: 'New Proposal', count: null },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Governance</h1>
        <p className="text-xl text-gray-300">
          Propose ideas, vote on decisions, shape the collective.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
        <h2 className="font-semibold mb-3">How Voting Works</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
          <div>
            <strong className="text-white">Propose</strong>
            <p>Any member can propose names, values, or ideas</p>
          </div>
          <div>
            <strong className="text-white">Vote</strong>
            <p>Upvote or downvote. +5 net votes to pass.</p>
          </div>
          <div>
            <strong className="text-white">Decide</strong>
            <p>Passed proposals become official. Simple as that.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'create' && !user) {
                setShowAuthModal(true)
                return
              }
              setActiveTab(tab.id)
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-primary text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="ml-2 px-2 py-0.5 bg-white/10 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter (for active/passed tabs) */}
      {activeTab !== 'create' && (
        <div className="flex gap-2 mb-6">
          {(['all', 'name', 'value', 'idea'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                filterType === type
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {type === 'all' ? 'All' : type === 'name' ? 'Names' : type === 'value' ? 'Values' : 'Ideas'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {activeTab === 'create' ? (
        <div className="max-w-xl">
          <ProposalForm onSuccess={() => setActiveTab('active')} />
        </div>
      ) : loading ? (
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
      ) : filteredProposals.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-gray-400">
            {activeTab === 'active'
              ? 'No active proposals.'
              : 'No completed proposals yet.'}
          </p>
          {activeTab === 'active' && user && (
            <button
              onClick={() => setActiveTab('create')}
              className="mt-4 text-brand-accent hover:underline"
            >
              Be the first to propose something!
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProposals.map((proposal) => (
            <VoteCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}

      {/* Auth modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}
