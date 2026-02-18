'use client'

import { useEffect, useCallback } from 'react'
import { RentalProperty } from '@/types/property'
import { PropertyCard } from './PropertyCard'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'

interface PropertyCarouselProps {
  properties: RentalProperty[]
  currentIndex: number
  onIndexChange: (index: number) => void
}

export function PropertyCarousel({ properties, currentIndex, onIndexChange }: PropertyCarouselProps) {
  const currentProperty = properties[currentIndex]

  const handlePrev = useCallback(() => {
    onIndexChange((currentIndex - 1 + properties.length) % properties.length)
  }, [currentIndex, properties.length, onIndexChange])

  const handleNext = useCallback(() => {
    onIndexChange((currentIndex + 1) % properties.length)
  }, [currentIndex, properties.length, onIndexChange])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.contentEditable === 'true' ||
        target.isContentEditable
      ) {
        return
      }

      // Skip if a modal is open (email preview, property full-view, etc.)
      // Check for high z-index overlays that would block interaction
      const hasModal = document.querySelector('[class*="z-[2"]')
      if (hasModal) {
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, properties.length, handlePrev, handleNext])

  if (!currentProperty) return null

  return (
    <div className="relative">
      {/* Property card */}
      <PropertyCard property={currentProperty} />

      {/* Navigation arrows - positioned outside the card */}
      {properties.length > 1 && (
        <>
          {/* Left arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
            className="absolute -left-2 top-1/3 z-20 w-9 h-9 bg-gray-800/90 hover:bg-gray-700 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors shadow-lg border border-white/10"
            aria-label="Previous property"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>

          {/* Right arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}
            className="absolute -right-2 top-1/3 z-20 w-9 h-9 bg-gray-800/90 hover:bg-gray-700 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors shadow-lg border border-white/10"
            aria-label="Next property"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>

          {/* Indicator */}
          <div className="text-center text-xs text-gray-400 mt-2">
            {currentIndex + 1} / {properties.length}
          </div>
        </>
      )}
    </div>
  )
}
