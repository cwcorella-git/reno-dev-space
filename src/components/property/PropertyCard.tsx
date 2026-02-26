'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RentalProperty, ARCHIVE_THRESHOLD } from '@/types/property'
import { PropertyVoteControls } from './PropertyVoteControls'
import { ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { deleteProperty } from '@/lib/storage/propertyStorage'

interface PropertyCardProps {
  property: RentalProperty
}

export function PropertyCard({ property }: PropertyCardProps) {
  const { user, isAdmin } = useAuth()
  const [showImageModal, setShowImageModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [portalMounted, setPortalMounted] = useState(false)
  const isArchived = property.brightness <= ARCHIVE_THRESHOLD

  // Track portal mount for SSR compatibility
  useEffect(() => {
    setPortalMounted(true)
  }, [])

  // Map brightness to opacity (0-100 → 0.4-1.0)
  const opacity = isArchived ? 0.5 : 0.4 + (property.brightness / 100) * 0.6

  // Check if user can delete (creator or admin)
  const canDelete = user && (property.createdBy === user.uid || isAdmin)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteProperty(property.id)
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('[PropertyCard] Failed to delete property:', error)
      alert('Failed to delete property. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div
        className={`group relative rounded-lg overflow-hidden border border-white/10 transition-all duration-300 ${
          isArchived ? 'grayscale' : ''
        }`}
        style={{ opacity }}
      >
        {/* Archive overlay */}
        {isArchived && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <span className="bg-amber-600/90 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg">
              ARCHIVED
            </span>
          </div>
        )}

        {/* Delete button (left side, hover-to-reveal, creator or admin only) */}
        {canDelete && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="absolute left-3 top-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 bg-white/10 hover:bg-red-600/80 text-white/70 hover:text-white"
            aria-label="Delete property"
            title="Delete property"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col p-3">
          {/* Image with expand button and vote controls */}
          <div className="w-full relative group/image mb-3">
            <img
              src={property.imageUrl}
              alt={property.address}
              className="w-full aspect-video object-cover rounded-lg cursor-pointer"
              onClick={() => setShowImageModal(true)}
            />

            {/* Expand button overlay */}
            <button
              onClick={() => setShowImageModal(true)}
              className="absolute bottom-2 left-2 w-8 h-8 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-all opacity-0 group-hover/image:opacity-100"
              aria-label="Expand image"
            >
              <ArrowsPointingOutIcon className="w-5 h-5" />
            </button>

            {/* Vote controls (bottom-right of image, always visible) */}
            <div className="absolute bottom-2 right-2">
              <PropertyVoteControls property={property} />
            </div>
          </div>

          {/* Details (full width) */}
          <div>
            <h4 className="font-semibold text-white text-base mb-1 break-words">{property.address}</h4>

            <p className="text-indigo-300 font-medium text-sm mb-1">
              {property.cost !== null ? `$${property.cost.toLocaleString()}/mo` : 'Contact for Pricing'}
            </p>

            {/* Company & Phone */}
            {(property.companyName || property.phone) && (
              <div className="text-xs text-gray-400 mb-2 space-y-0.5">
                {property.companyName && <p className="break-words">{property.companyName}</p>}
                {property.phone && <p className="break-all">{property.phone}</p>}
              </div>
            )}

            <p className="text-xs text-gray-300 leading-relaxed mb-2 break-words">
              {property.description}
            </p>

            {/* Metadata */}
            <div className="text-xs text-gray-500">
              <p>Added {new Date(property.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Image expand modal - rendered via portal to escape transform containing block */}
      {showImageModal && portalMounted && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black"
          onClick={() => setShowImageModal(false)}
        >
          {/* Image container - enables pinch-to-zoom on mobile, fills screen on desktop */}
          <div
            className="relative w-full h-full overflow-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
          >
            {/* Wrapper to center image initially */}
            <div className="min-w-full min-h-full flex items-center justify-center p-4">
              <div className="relative">
                <img
                  src={property.imageUrl}
                  alt={property.address}
                  className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] md:max-w-[95vw] md:max-h-[calc(100vh-5rem)] object-contain"
                  style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
                />

                {/* Close button - overlaps image top-right corner */}
                <button
                  onClick={() => setShowImageModal(false)}
                  className="absolute -top-3 -right-3 md:top-2 md:right-2 z-[210] w-10 h-10 md:w-12 md:h-12 bg-black/70 hover:bg-black/90 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors border border-white/30"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Image caption - full width at bottom of viewport */}
          <div className="fixed bottom-0 inset-x-0 z-[205] bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 md:p-6 pointer-events-none">
            <div className="max-w-screen-xl mx-auto">
              <h3 className="text-white font-semibold text-base md:text-xl">{property.address}</h3>
              <p className="text-indigo-300 text-sm md:text-base">
                {property.cost !== null ? `$${property.cost.toLocaleString()}/mo` : 'Contact for Pricing'}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirmation modal - rendered via portal to escape transform containing block */}
      {showDeleteConfirm && portalMounted && createPortal(
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => !isDeleting && setShowDeleteConfirm(false)}
        >
          <div
            className="relative bg-gray-900 border border-red-600/50 rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-bold text-lg mb-3">Delete Property?</h3>
            <p className="text-gray-300 text-sm mb-2">
              Are you sure you want to delete this property?
            </p>
            <p className="text-gray-400 text-xs mb-6">
              <strong className="text-white">{property.address}</strong>
              <br />
              This will permanently delete the property and its image. This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {isDeleting ? 'Deleting...' : 'Delete Property'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
