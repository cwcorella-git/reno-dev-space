'use client'

import { useState, useEffect } from 'react'

export function VersionPopup() {
  const [isVisible, setIsVisible] = useState(false)

  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown'
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+V (or Cmd+V on Mac) when not in an input field
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const target = e.target as HTMLElement
        // Only show version popup if not in an editable field
        if (
          target.tagName !== 'INPUT' &&
          target.tagName !== 'TEXTAREA' &&
          !target.isContentEditable
        ) {
          e.preventDefault()
          setIsVisible(true)
          // Auto-hide after 3 seconds
          setTimeout(() => setIsVisible(false), 3000)
        }
      }

      // Escape to dismiss
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-gray-900 border border-white/20 rounded-lg shadow-2xl p-6 min-w-[280px]"
      onClick={() => setIsVisible(false)}
    >
      <h3 className="text-white text-lg font-semibold mb-4">Build Info</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Commit:</span>
          <span className="text-white font-mono">{commitSha}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Built:</span>
          <span className="text-white font-mono text-xs">
            {buildTime !== 'unknown'
              ? new Date(buildTime).toLocaleString()
              : buildTime}
          </span>
        </div>
      </div>
      <p className="text-gray-500 text-xs mt-4 text-center">
        Press Escape or click to dismiss
      </p>
    </div>
  )
}
