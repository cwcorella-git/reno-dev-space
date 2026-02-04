import { TextBlock } from '@/types/canvas'

/**
 * Vote-driven text effects system.
 *
 * Instead of SVG outlines around blocks, this applies CSS effects
 * directly to the text: glows, shimmers, gradients, hue rotations.
 * Effects escalate with more upvotes across 4 tiers.
 *
 * Tier 0 — 0 upvotes:  No effects (just brightness/opacity)
 * Tier 1 — 1 upvote:   Static glow (text-shadow in block's color)
 * Tier 2 — 2 upvotes:  Pulsing glow animation
 * Tier 3 — 3-4 upvotes: Hue-cycling glow (color shifts + pulses)
 * Tier 4 — 5+ upvotes:  Rainbow gradient through letterforms + glow
 */

export interface VoteEffectResult {
  /** Extra inline styles to merge onto the text element */
  style: React.CSSProperties
  /** CSS class names to add (space-separated) */
  className: string
}

/**
 * Map upvote count to CSS effect properties.
 * Effects are cumulative-feeling but each tier replaces the previous.
 */
export function getVoteEffects(upvotes: number, blockColor: string): VoteEffectResult {
  // Tier 0: nothing
  if (upvotes === 0) {
    return { className: '', style: {} }
  }

  // Tier 1: static glow — just a colored text-shadow, no animation
  // First vote gives the text a soft halo in its own color
  if (upvotes === 1) {
    return {
      className: '',
      style: {
        textShadow: `0 0 6px ${blockColor}88, 0 0 12px ${blockColor}44`,
      },
    }
  }

  // Tier 2: pulsing glow — the shadow breathes in and out
  if (upvotes === 2) {
    return {
      className: 'vote-effect-glow',
      style: {
        '--glow-color': blockColor,
        textShadow: `0 0 8px ${blockColor}66`,
      } as React.CSSProperties,
    }
  }

  // Tier 3: hue-cycling glow — color slowly rotates, feels alive
  if (upvotes <= 4) {
    return {
      className: 'vote-effect-hue-cycle',
      style: {
        '--glow-color': blockColor,
        textShadow: `0 0 10px ${blockColor}88, 0 0 20px ${blockColor}44`,
      } as React.CSSProperties,
    }
  }

  // Tier 4: rainbow gradient through the text + glow
  // The ultimate tier — text becomes a flowing rainbow
  return {
    className: 'vote-effect-rainbow',
    style: {
      textShadow: `0 0 12px rgba(129, 140, 248, 0.4), 0 0 24px rgba(129, 140, 248, 0.2)`,
    },
  }
}

/**
 * Convenience: extract upvote count from a block.
 */
export function getUpvoteCount(block: TextBlock): number {
  return block.votersUp?.length ?? 0
}
