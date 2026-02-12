'use client'

import { useState } from 'react'
import { RentalProperty, ARCHIVE_THRESHOLD } from '@/types/property'
import { PropertyVoteControls } from './PropertyVoteControls'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface PropertyCardProps {
  property: RentalProperty
}

export function PropertyCard({ property }: PropertyCardProps) {
  const [showImageModal, setShowImageModal] = useState(false)
  const isArchived = property.brightness <= ARCHIVE_THRESHOLD

  // Map brightness to opacity (0-100 → 0.4-1.0)
  const opacity = isArchived ? 0.5 : 0.4 + (property.brightness / 100) * 0.6

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

        {/* Vote controls (right side, hover-to-reveal) */}
        <PropertyVoteControls property={property} />

        <div className="flex flex-col gap-3 p-3">
          {/* Image with expand button */}
          <div className="w-full relative group/image">
            <img
              src={property.imageUrl}
              alt={property.address}
              className="w-full aspect-video object-cover rounded-lg cursor-pointer"
              onClick={() => setShowImageModal(true)}
            />

            {/* Expand button overlay */}
            <button
              onClick={() => setShowImageModal(true)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all opacity-0 group-hover/image:opacity-100"
              aria-label="Expand image"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </button>
          </div>

        {/* Details */}
        <div>
          <h4 className="font-semibold text-white text-base mb-1">{property.address}</h4>

          <p className="text-indigo-300 font-medium text-sm mb-1">
            {property.cost !== null ? `$${property.cost.toLocaleString()}/mo` : 'Contact for Pricing'}
          </p>

          {/* Company & Phone */}
          {(property.companyName || property.phone) && (
            <div className="text-xs text-gray-400 mb-2 space-y-0.5">
              {property.companyName && <p>{property.companyName}</p>}
              {property.phone && <p>{property.phone}</p>}
            </div>
          )}

          <p className="text-xs text-gray-300 leading-relaxed mb-2">
            {property.description}
          </p>

          {/* Metadata */}
          <div className="text-xs text-gray-500">
            <p>Added {new Date(property.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        </div>
      </div>

      {/* Image expand modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setShowImageModal(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>

          {/* Expanded image */}
          <div
            className="relative max-w-6xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={property.imageUrl}
              alt={property.address}
              className="w-full h-full object-contain rounded-lg"
            />

            {/* Image caption */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
              <h3 className="text-white font-semibold text-lg">{property.address}</h3>
              <p className="text-indigo-300 text-sm">
                {property.cost !== null ? `$${property.cost.toLocaleString()}/mo` : 'Contact for Pricing'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
