'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffects } from '@/contexts/EffectsContext'
import { ALL_EFFECT_NAMES, TextEffectName } from '@/types/canvas'
import {
  setEffectsEnabled,
  setDisabledEffects,
  setEffectsThreshold,
  setEffectsIntensity,
} from '@/lib/storage/effectsStorage'

/** Human-friendly labels for each effect */
const EFFECT_LABELS: Record<TextEffectName, string> = {
  'glow-pulse':   'Glow Pulse',
  'hue-cycle':    'Hue Cycle',
  'rainbow':      'Rainbow',
  'shine':        'Shine',
  'buzz':         'Buzz',
  'breathing':    'Breathing',
  'sparkle':      'Sparkle',
  'neon-flicker': 'Neon Flicker',
  'glitch':       'Glitch',
  'shadow-depth': 'Shadow Depth',
  'blur-pulse':   'Blur Pulse',
}

export function TextEffectsPanel() {
  const { user, isAdmin } = useAuth()
  const { settings } = useEffects()

  if (!user || !isAdmin) {
    return (
      <div className="p-4 text-center text-gray-400">
        Admin access required
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

  const handleThresholdChange = (value: number) => {
    const clamped = Math.max(1, Math.min(10, value))
    setEffectsThreshold(clamped)
  }

  const handleIntensityChange = (level: 'low' | 'medium' | 'high') => {
    setEffectsIntensity(level)
  }

  return (
    <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
      {/* Master toggle + Threshold */}
      <div className="flex items-center justify-between">
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
            Effects {settings.enabled ? 'On' : 'Off'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Threshold</span>
          <button
            onClick={() => handleThresholdChange(settings.threshold - 1)}
            className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center"
          >−</button>
          <span className="text-sm text-white w-5 text-center">{settings.threshold}</span>
          <button
            onClick={() => handleThresholdChange(settings.threshold + 1)}
            className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center"
          >+</button>
        </div>
      </div>

      {/* Intensity */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Animation Speed</span>
        <div className="flex gap-1">
          {(['low', 'medium', 'high'] as const).map((level) => (
            <button
              key={level}
              onClick={() => handleIntensityChange(level)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                settings.intensity === level
                  ? 'bg-amber-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {level === 'low' ? 'Slow' : level === 'medium' ? 'Medium' : 'Fast'}
            </button>
          ))}
        </div>
      </div>

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
    </div>
  )
}
