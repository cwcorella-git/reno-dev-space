'use client'

import { RentalProperty, ARCHIVE_THRESHOLD } from '@/types/property'
import { PropertyVoteControls } from './PropertyVoteControls'

interface PropertyCardProps {
  property: RentalProperty
}

export function PropertyCard({ property }: PropertyCardProps) {
  const isArchived = property.brightness <= ARCHIVE_THRESHOLD

  // Map brightness to opacity (0-100 → 0.4-1.0)
  const opacity = isArchived ? 0.5 : 0.4 + (property.brightness / 100) * 0.6

  return (
    <div
      className={`group relative rounded-xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-300 ${
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

      <div className="flex flex-col md:flex-row gap-4 p-4">
        {/* Image (60% width on desktop) */}
        <div className="w-full md:w-3/5 flex-shrink-0">
          <img
            src={property.imageUrl}
            alt={property.address}
            className="w-full aspect-video object-cover rounded-lg"
          />
        </div>

        {/* Details (40% width on desktop) */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-white text-lg mb-2">{property.address}</h4>

            <p className="text-indigo-300 font-medium mb-3">
              {property.cost !== null ? `$${property.cost.toLocaleString()}/mo` : '???'}
            </p>

            <p className="text-sm text-gray-300 leading-relaxed">
              {property.description}
            </p>
          </div>

          {/* Metadata */}
          <div className="mt-4 text-xs text-gray-500">
            <p>Added {new Date(property.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
