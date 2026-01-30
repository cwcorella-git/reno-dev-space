'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { subscribeToContent, updateContent as updateContentStorage, ContentEntry } from '@/lib/contentStorage'
import { useAuth } from './AuthContext'

interface ContentContextType {
  content: Map<string, ContentEntry>
  loading: boolean
  getText: (id: string, defaultValue: string) => string
  updateText: (id: string, value: string, category: string, description?: string) => Promise<void>
}

const ContentContext = createContext<ContentContextType | undefined>(undefined)

export function ContentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [content, setContent] = useState<Map<string, ContentEntry>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false)
      return
    }

    const unsubscribe = subscribeToContent(
      (newContent) => {
        setContent(newContent)
        setLoading(false)
      },
      (error) => {
        console.error('[ContentContext] Error:', error)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  const getText = (id: string, defaultValue: string): string => {
    const entry = content.get(id)
    return entry?.value ?? defaultValue
  }

  const updateText = async (id: string, value: string, category: string, description?: string): Promise<void> => {
    if (!user) {
      console.error('[ContentContext] updateText called with no user')
      return
    }
    console.log('[ContentContext] Updating:', { id, value, category, uid: user.uid })
    await updateContentStorage(id, value, category, user.uid, description)
  }

  return (
    <ContentContext.Provider value={{ content, loading, getText, updateText }}>
      {children}
    </ContentContext.Provider>
  )
}

export function useContent() {
  const context = useContext(ContentContext)
  if (context === undefined) {
    throw new Error('useContent must be used within a ContentProvider')
  }
  return context
}
