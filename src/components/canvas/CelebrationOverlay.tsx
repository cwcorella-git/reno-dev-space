'use client'

import { TextEffectName } from '@/types/canvas'

interface CelebrationOverlayProps {
  effect: TextEffectName
  color: string
  onComplete: () => void
}

export function CelebrationOverlay({ effect, color, onComplete }: CelebrationOverlayProps) {
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
    />
  )
}
