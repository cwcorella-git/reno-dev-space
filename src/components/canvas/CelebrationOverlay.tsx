'use client'

import { TextEffectName } from '@/types/canvas'

/** Human-friendly labels for display */
const EFFECT_LABELS: Record<TextEffectName, string> = {
  'ring-burst':     'Ring Burst',
  'confetti-pop':   'Confetti Pop',
  'glow-flash':     'Glow Flash',
  'pulse-pop':      'Pulse Pop',
  'shimmer-sweep':  'Shimmer Sweep',
  'sparkle-burst':  'Sparkle Burst',
  'star-shower':    'Star Shower',
}

interface CelebrationOverlayProps {
  effect: TextEffectName
  color: string
  onComplete: () => void
  showLabel?: boolean  // Admin-only: flash the effect name
}

export function CelebrationOverlay({ effect, color, onComplete, showLabel }: CelebrationOverlayProps) {
  return (
    <div
      className={`celebrate-overlay celebrate-${effect}`}
      style={{ '--celebrate-color': color } as React.CSSProperties}
      onAnimationEnd={(e) => {
        // Only fire on the main element's animation, not pseudo-elements
        if (e.target === e.currentTarget) {
          onComplete()
        }
      }}
    >
      {showLabel && (
        <span className="celebrate-label">
          {EFFECT_LABELS[effect]}
        </span>
      )}
    </div>
  )
}
