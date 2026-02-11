'use client'

import { useState, useEffect } from 'react'
import { RentalProperty } from '@/types/property'
import { subscribeToProperties } from '@/lib/storage/propertyStorage'
import { useAuth } from '@/contexts/AuthContext'
import { PropertyCarousel } from './PropertyCarousel'
import { AddPropertyModal } from './AddPropertyModal'

export function PropertyGallery() {
  const [properties, setProperties] = useState<RentalProperty[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const { user } = useAuth()

  // Subscribe to properties
  useEffect(() => {
    const unsubscribe = subscribeToProperties(
      (props) => {
        setProperties(props)
        setLoading(false)
      },
      (error) => {
        console.error('[PropertyGallery] Error:', error)
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  // Random initial index when properties load
  useEffect(() => {
    if (properties.length > 0 && currentIndex === 0) {
      const randomIndex = Math.floor(Math.random() * properties.length)
      setCurrentIndex(randomIndex)
    }
  }, [properties.length, currentIndex])

  if (loading) {
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-gray-400">
          <p className="text-sm">Loading properties...</p>
        </div>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <>
        <div className="w-full bg-gradient-to-r from-slate-900/95 via-gray-900/95 to-slate-900/95 backdrop-blur-sm border-t border-white/10 mt-8">
          <div className="max-w-4xl mx-auto px-4 py-4 text-center">
            <p className="text-sm text-gray-400 mb-2">No rental properties yet. Be the first to suggest one!</p>
            {user && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Add Property
              </button>
            )}
          </div>
        </div>

        {showAddModal && (
          <AddPropertyModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => setShowAddModal(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="w-full bg-gradient-to-r from-slate-900/95 via-gray-900/95 to-slate-900/95 backdrop-blur-sm border-t border-white/10 mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Potential Spaces</h3>
            {user && (
              <button
                onClick={() => setShowAddModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                + Add Property
              </button>
            )}
          </div>

          <PropertyCarousel
            properties={properties}
            currentIndex={currentIndex}
            onIndexChange={setCurrentIndex}
          />
        </div>
      </div>

      {showAddModal && (
        <AddPropertyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(propertyId) => {
            // Jump to newly added property
            const idx = properties.findIndex(p => p.id === propertyId)
            if (idx !== -1) setCurrentIndex(idx)
            setShowAddModal(false)
          }}
        />
      )}
    </>
  )
}
