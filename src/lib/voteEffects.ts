import { TextEffectName, ALL_EFFECT_NAMES, TextEffectsSettings } from '@/types/canvas'

/**
 * Vote celebration effect assignment (hash-based).
 *
 * Each block is deterministically assigned one of the 8 celebration effects
 * based on a hash of its Firestore document ID. The effect plays once when
 * the block receives an upvote.
 */

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
 * Determine which celebration effect a block gets based on its ID.
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
 * Get the celebration effect for a block, or null if celebrations are off.
 */
export function getCelebrationEffect(
  blockId: string,
  settings: TextEffectsSettings
): TextEffectName | null {
  if (!settings.enabled) return null
  return getEffectForBlock(blockId, settings)
}

/**
 * Get a random enabled effect (for test mode).
 */
export function getRandomEffect(settings: TextEffectsSettings): TextEffectName | null {
  if (!settings.enabled) return null
  const enabledEffects = ALL_EFFECT_NAMES.filter(
    (name) => !settings.disabledEffects.includes(name)
  )
  if (enabledEffects.length === 0) return null
  return enabledEffects[Math.floor(Math.random() * enabledEffects.length)]
}
