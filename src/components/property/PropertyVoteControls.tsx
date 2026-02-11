'use client'

import { useState } from 'react'
import { RentalProperty, ARCHIVE_THRESHOLD } from '@/types/property'
import { voteProperty } from '@/lib/storage/propertyStorage'
import { useAuth } from '@/contexts/AuthContext'
import { useEffects } from '@/contexts/EffectsContext'
import { getCelebrationEffect, getRandomEffect } from '@/lib/voteEffects'
import { CelebrationOverlay } from '@/components/canvas/CelebrationOverlay'
import { TextEffectName } from '@/types/canvas'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid'

interface PropertyVoteControlsProps {
  property: RentalProperty
}

export function PropertyVoteControls({ property }: PropertyVoteControlsProps) {
  const { user, isAdmin } = useAuth()
  const { settings: effectsSettings } = useEffects()
  const [celebrating, setCelebrating] = useState<TextEffectName | null>(null)
  const [isVoting, setIsVoting] = useState(false)

  const isArchived = property.brightness <= ARCHIVE_THRESHOLD
  const votedUp = property.votersUp?.includes(user?.uid ?? '') ?? false
  const votedDown = property.votersDown?.includes(user?.uid ?? '') ?? false
  const inLegacyVoters = property.voters?.includes(user?.uid ?? '') ?? false
  const isLegacyVoter = inLegacyVoters && !votedUp && !votedDown

  if (!user || isArchived) return null

  const handleVote = async (direction: 'up' | 'down') => {
    if (isVoting) return

    // Check for no-op conditions
    const isNoOp =
      (direction === 'up' && votedUp) ||
      (direction === 'down' && votedDown) ||
      isLegacyVoter

    if (isNoOp) return

    setIsVoting(true)
    try {
      // Test mode: just trigger random celebration
      if (effectsSettings.testMode && direction === 'up') {
        const effect = getRandomEffect(effectsSettings)
        setCelebrating(effect)
        return
      }

      const wasArchived = await voteProperty(property.id, user.uid, direction)

      // Trigger celebration on upvote (not unvote, not archive)
      if (direction === 'up' && !wasArchived) {
        const effect = getCelebrationEffect(property.id, effectsSettings)
        setCelebrating(effect)
      }
    } catch (error) {
      console.error('[PropertyVoteControls] Failed to vote:', error)
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
        {/* Up arrow */}
        <button
          onClick={() => handleVote('up')}
          disabled={votedUp || isVoting}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            votedUp
              ? 'bg-green-600 text-white'
              : 'bg-white/10 hover:bg-green-600/50 text-white/70 hover:text-white'
          }`}
          aria-label="Vote up"
        >
          <ChevronUpIcon className="w-5 h-5" />
        </button>

        {/* Brightness number */}
        <span className="text-xs font-mono text-white font-semibold">
          {property.brightness}
        </span>

        {/* Down arrow */}
        <button
          onClick={() => handleVote('down')}
          disabled={votedDown || isVoting}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            votedDown
              ? 'bg-red-600 text-white'
              : 'bg-white/10 hover:bg-red-600/50 text-white/70 hover:text-white'
          }`}
          aria-label="Vote down"
        >
          <ChevronDownIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Celebration overlay */}
      {celebrating && (
        <CelebrationOverlay
          effect={celebrating}
          color="#818cf8"
          onComplete={() => setCelebrating(null)}
          showLabel={isAdmin}
        />
      )}
    </>
  )
}
