'use client'

import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'

export function AdminToolbar() {
  const { isAdmin } = useAuth()
  const { addText } = useCanvas()

  if (!isAdmin) return null

  const handleAddText = async () => {
    // Add text at center of viewport
    await addText(40, 40)
  }

  return (
    <div className="fixed top-4 left-4 z-50 flex gap-2">
      <button
        onClick={handleAddText}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Add Text
      </button>
    </div>
  )
}
