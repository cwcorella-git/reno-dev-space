'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { PresenceData, updatePresence, removePresence, subscribeToPresence } from '@/lib/storage/presenceStorage'

interface PresenceContextType {
  otherUsers: PresenceData[]
  updateCursorPosition: (x: number, y: number) => void
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined)

const THROTTLE_MS = 200 // Write cursor position every 200ms max

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [otherUsers, setOtherUsers] = useState<PresenceData[]>([])

  // Throttled cursor position state
  const lastUpdateRef = useRef<number>(0)
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null)
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Track if component is mounted (for cleanup)
  const isMountedRef = useRef(true)

  // Write cursor position to Firestore (throttled)
  const writeCursorPosition = async (x: number, y: number) => {
    if (!user || !profile?.displayName) return

    try {
      await updatePresence(user.uid, profile.displayName, x, y)
    } catch (error) {
      console.error('[PresenceContext] Failed to update presence:', error)
    }
  }

  // Throttled cursor update
  const updateCursorPosition = (x: number, y: number) => {
    if (!user) return

    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateRef.current

    if (timeSinceLastUpdate >= THROTTLE_MS) {
      // Immediate write
      lastUpdateRef.current = now
      writeCursorPosition(x, y)
    } else {
      // Save pending position and schedule write
      pendingPositionRef.current = { x, y }

      if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = null
          if (pendingPositionRef.current && isMountedRef.current) {
            const { x, y } = pendingPositionRef.current
            lastUpdateRef.current = Date.now()
            writeCursorPosition(x, y)
            pendingPositionRef.current = null
          }
        }, THROTTLE_MS - timeSinceLastUpdate)
      }
    }
  }

  // Subscribe to other users' presence
  useEffect(() => {
    if (!user) {
      setOtherUsers([])
      return
    }

    const unsubscribe = subscribeToPresence(user.uid, setOtherUsers)
    return () => unsubscribe()
  }, [user])

  // Cleanup on unmount or user change
  useEffect(() => {
    return () => {
      isMountedRef.current = false

      // Clear any pending throttle timer
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }

      // Remove presence from Firestore
      if (user) {
        removePresence(user.uid).catch((error) => {
          console.error('[PresenceContext] Failed to remove presence on unmount:', error)
        })
      }
    }
  }, [user])

  return (
    <PresenceContext.Provider value={{ otherUsers, updateCursorPosition }}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  const context = useContext(PresenceContext)
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider')
  }
  return context
}
