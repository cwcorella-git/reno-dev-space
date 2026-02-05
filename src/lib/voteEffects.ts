import { TextBlock, TextEffectName, ALL_EFFECT_NAMES, TextEffectsSettings } from '@/types/canvas'

/**
 * Vote-driven text effects system (v2 — hash-based assignment).
 *
 * Each block is deterministically assigned one of 11 CSS effects based on
 * a hash of its Firestore document ID. The effect activates when the block's
 * upvote count reaches the admin-configured threshold, and intensity scales
 * with additional votes.
 *
 * Admin controls (Firestore settings/textEffects):
 *   enabled         — master on/off
 *   disabledEffects — per-effect toggles
 *   threshold       — min upvotes to activate (default: 2)
 *   intensity       — animation speed: low (slow), medium, high (fast)
 */

export interface VoteEffectResult {
  /** Extra inline styles (CSS custom properties for the animation) */
  style: React.CSSProperties
  /** CSS class name: vote-fx-{effectName} or empty */
  className: string
}

/** Speed multipliers: higher = slower animation */
const INTENSITY_MULTIPLIER: Record<string, number> = {
  low: 1.8,
  medium: 1.0,
  high: 0.5,
}

/**
 * djb2 hash — fast, good distribution for short strings.
 * Returns an unsigned 32-bit integer.
 */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Determine which effect a block gets based on its ID.
 * Only picks from effects that are currently enabled.
 */
export function getEffectForBlock(
  blockId: string,
  settings: TextEffectsSettings
): TextEffectName | null {
  const enabledEffects = ALL_EFFECT_NAMES.filter(
    (name) => !settings.disabledEffects.includes(name)
  )
  if (enabledEffects.length === 0) return null

  const hash = hashString(blockId)
  return enabledEffects[hash % enabledEffects.length]
}

/**
 * Get the CSS class + inline styles for a block's vote-driven text effect.
 *
 * Returns empty when: master disabled, below threshold, editing, or
 * the assigned effect is individually disabled.
 */
export function getVoteEffects(
  blockId: string,
  upvotes: number,
  blockColor: string,
  settings: TextEffectsSettings,
  isEditing?: boolean
): VoteEffectResult {
  const empty: VoteEffectResult = { className: '', style: {} }

  if (!settings.enabled) return empty
  if (upvotes < settings.threshold) return empty
  if (isEditing) return empty

  const effect = getEffectForBlock(blockId, settings)
  if (!effect) return empty

  const speedMultiplier = INTENSITY_MULTIPLIER[settings.intensity] ?? 1.0
  // Intensity: how far above threshold (1 = just reached, capped at 5)
  const intensityScale = Math.min(upvotes - settings.threshold + 1, 5)

  return {
    className: `vote-fx-${effect}`,
    style: {
      '--fx-speed': `${speedMultiplier}`,
      '--fx-color': blockColor,
      '--fx-intensity': `${intensityScale}`,
    } as React.CSSProperties,
  }
}

/** Convenience: extract upvote count from a block */
export function getUpvoteCount(block: TextBlock): number {
  return block.votersUp?.length ?? 0
}
