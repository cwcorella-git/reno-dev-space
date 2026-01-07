'use client'

import { useState } from 'react'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToProposals, Proposal } from '@/lib/proposalStorage'
import { useEffect } from 'react'

export function AdminToolbar() {
  const { isAdmin } = useAuth()
  const { addText, addVote } = useCanvas()
  const [showProposalPicker, setShowProposalPicker] = useState(false)
  const [proposals, setProposals] = useState<Proposal[]>([])

  useEffect(() => {
    if (!showProposalPicker) return

    const unsubscribe = subscribeToProposals((p) => {
      setProposals(p.filter((prop) => prop.status === 'active'))
    })

    return () => unsubscribe()
  }, [showProposalPicker])

  if (!isAdmin) return null

  const handleAddText = async () => {
    // Add text at center of viewport
    await addText(40, 40)
  }

  const handleAddVote = () => {
    setShowProposalPicker(true)
  }

  const handleSelectProposal = async (proposalId: string) => {
    await addVote(30, 30, proposalId)
    setShowProposalPicker(false)
  }

  return (
    <>
      <div className="fixed top-4 left-4 z-50 flex gap-2">
        <button
          onClick={handleAddText}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Add Text
        </button>

        <button
          onClick={handleAddVote}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          Add Vote
        </button>
      </div>

      {/* Proposal Picker Modal */}
      {showProposalPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Select a Proposal</h2>
              <button
                onClick={() => setShowProposalPicker(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {proposals.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No active proposals. Create one first.
              </p>
            ) : (
              <div className="space-y-2">
                {proposals.map((proposal) => (
                  <button
                    key={proposal.id}
                    onClick={() => handleSelectProposal(proposal.id)}
                    className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="font-medium">{proposal.title}</div>
                    <div className="text-sm text-gray-400 capitalize">{proposal.type}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
