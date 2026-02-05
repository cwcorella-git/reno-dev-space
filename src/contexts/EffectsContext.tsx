'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { TextEffectsSettings, DEFAULT_EFFECTS_SETTINGS } from '@/types/canvas'
import { subscribeToEffectsSettings } from '@/lib/storage/effectsStorage'

interface EffectsContextType {
  settings: TextEffectsSettings
  loading: boolean
}

const EffectsContext = createContext<EffectsContextType | undefined>(undefined)

export function EffectsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TextEffectsSettings>(DEFAULT_EFFECTS_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false)
      return
    }

    const unsubscribe = subscribeToEffectsSettings(
      (newSettings) => {
        setSettings(newSettings)
        setLoading(false)
      },
      (error) => {
        console.error('[EffectsContext] Error:', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  return (
    <EffectsContext.Provider value={{ settings, loading }}>
      {children}
    </EffectsContext.Provider>
  )
}

export function useEffects() {
  const context = useContext(EffectsContext)
  if (context === undefined) {
    throw new Error('useEffects must be used within an EffectsProvider')
  }
  return context
}
