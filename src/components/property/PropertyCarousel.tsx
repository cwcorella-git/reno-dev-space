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
      // Only handle arrow keys if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
      {/* Left arrow */}
      {properties.length > 1 && (
        <button
          onClick={handlePrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors"
          aria-label="Previous property"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      )}

      {/* Property card */}
      <div className="px-12">
        <PropertyCard property={currentProperty} />
      </div>

      {/* Right arrow */}
      {properties.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors"
          aria-label="Next property"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>
      )}

      {/* Indicator */}
      {properties.length > 1 && (
        <div className="text-center text-xs text-gray-400 mt-2">
          Property {currentIndex + 1} of {properties.length}
        </div>
      )}
    </div>
  )
}
