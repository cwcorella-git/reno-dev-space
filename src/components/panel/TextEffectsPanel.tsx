'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useContent } from '@/contexts/ContentContext'
import { useEffects } from '@/contexts/EffectsContext'
import { ALL_EFFECT_NAMES, TextEffectName } from '@/types/canvas'
import { setEffectsEnabled, setDisabledEffects, setTestMode } from '@/lib/storage/effectsStorage'

/** Human-friendly labels for each celebration effect */
const EFFECT_LABELS: Record<TextEffectName, string> = {
  'ring-burst':     'Ring Burst',
  'confetti-pop':   'Confetti Pop',
  'glow-flash':     'Glow Flash',
  'pulse-pop':      'Pulse Pop',
  'shimmer-sweep':  'Shimmer Sweep',
  'sparkle-burst':  'Sparkle Burst',
  'star-shower':    'Star Shower',
}

export function TextEffectsPanel() {
  const { user, isAdmin } = useAuth()
  const { getText } = useContent()
  const { settings } = useEffects()

  if (!user || !isAdmin) {
    return (
      <div className="p-4 text-center text-gray-400">
        {getText('panel.admin.required', 'Admin access required')}
      </div>
    )
  }

  const handleToggleMaster = () => setEffectsEnabled(!settings.enabled)

  const handleToggleEffect = (effectName: TextEffectName) => {
    const isDisabled = settings.disabledEffects.includes(effectName)
    const next = isDisabled
      ? settings.disabledEffects.filter((n) => n !== effectName)
      : [...settings.disabledEffects, effectName]
    setDisabledEffects(next)
  }

  return (
    <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
      {/* Master toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggleMaster}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.enabled ? 'bg-amber-500' : 'bg-white/20'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            settings.enabled ? 'translate-x-5' : ''
          }`} />
        </button>
        <span className="text-sm text-white font-medium">
          {getText('effects.toggle.celebrations', 'Celebrations')} {settings.enabled ? getText('effects.toggle.on', 'On') : getText('effects.toggle.off', 'Off')}
        </span>
      </div>

      <p className="text-xs text-gray-400">
        {getText('effects.description', 'One-shot effects that play when a block receives an upvote. Visible only to the voter.')}
      </p>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Per-effect toggles — 2-column grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {ALL_EFFECT_NAMES.map((name) => {
          const isDisabled = settings.disabledEffects.includes(name)
          return (
            <button
              key={name}
              onClick={() => handleToggleEffect(name)}
              className={`px-2.5 py-1.5 rounded text-xs text-left transition-colors flex items-center gap-1.5 ${
                isDisabled
                  ? 'bg-white/5 text-gray-500'
                  : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDisabled ? 'bg-gray-600' : 'bg-amber-400'}`} />
              <span className={isDisabled ? 'line-through' : ''}>{EFFECT_LABELS[name]}</span>
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Test Mode - unlimited voting with random effects */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-white font-medium">{getText('effects.testMode.label', 'Test Mode')}</span>
          <p className="text-xs text-gray-400">{getText('effects.testMode.description', 'Unlimited votes, random effects')}</p>
        </div>
        <button
          onClick={() => setTestMode(!settings.testMode)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.testMode ? 'bg-amber-500' : 'bg-white/20'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            settings.testMode ? 'translate-x-5' : ''
          }`} />
        </button>
      </div>
    </div>
  )
}
