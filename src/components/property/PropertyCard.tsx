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
        {/* Image */}
        <div className="w-full">
          <img
            src={property.imageUrl}
            alt={property.address}
            className="w-full aspect-video object-cover rounded-lg"
          />
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
  )
}
