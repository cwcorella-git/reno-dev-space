'use client'

import { useCallback, useState } from 'react'
import { useCanvas } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { CanvasBlock } from './CanvasBlock'
import { AdminToolbar } from './AdminToolbar'
import { BlockToolbar } from './BlockToolbar'
import { AuthModal } from '@/components/AuthModal'
import { IntroHint } from '@/components/IntroHint'

export function Canvas() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { blocks, canvasRef, loading: canvasLoading, selectBlock } = useCanvas()
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleCanvasClick = useCallback(() => {
    selectBlock(null)
  }, [selectBlock])

  if (authLoading || canvasLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  return (
    <>
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="min-h-screen w-full bg-brand-dark relative overflow-hidden"
        onClick={handleCanvasClick}
      >
        {/* Render all blocks */}
        {blocks.map((block) => (
          <CanvasBlock key={block.id} block={block} />
        ))}

        {/* Empty state for admin */}
        {isAdmin && blocks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Your canvas is empty</p>
              <p className="text-sm">Use the toolbar above to add text or voting widgets</p>
            </div>
          </div>
        )}

        {/* Login button for non-logged in users */}
        {!user && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowAuthModal(true)
            }}
            className="fixed top-4 right-4 z-50 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg transition-colors"
          >
            Login / Join
          </button>
        )}

        {/* User info for logged in users */}
        {user && !isAdmin && (
          <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/10 text-white rounded-lg">
            {user.displayName || user.email}
          </div>
        )}
      </div>

      {/* Admin toolbar */}
      <AdminToolbar />

      {/* Block toolbar */}
      <BlockToolbar />

      {/* Intro hint for non-logged-in users */}
      {!user && <IntroHint />}

      {/* Auth modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  )
}
