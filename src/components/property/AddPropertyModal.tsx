'use client'

import { useState, useRef, DragEvent } from 'react'
import { addProperty } from '@/lib/storage/propertyStorage'
import { useAuth } from '@/contexts/AuthContext'
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline'

interface AddPropertyModalProps {
  onClose: () => void
  onSuccess?: (propertyId: string) => void
}

export function AddPropertyModal({ onClose, onSuccess }: AddPropertyModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [cost, setCost] = useState<string>('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP image')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError(null)
  }

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelect(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async () => {
    // Validation
    if (!imageFile) {
      setError('Image is required')
      return
    }
    if (!address.trim() || address.trim().length < 10) {
      setError('Please enter a valid address (minimum 10 characters)')
      return
    }
    if (!description.trim() || description.trim().length < 20) {
      setError('Please explain why this is a good space (minimum 20 characters)')
      return
    }

    setUploading(true)
    try {
      const costNum = cost.trim() ? parseFloat(cost.replace(/,/g, '')) : null
      const phoneValue = phone.trim() || null
      const companyValue = companyName.trim() || null
      const propertyId = await addProperty(
        imageFile,
        address.trim(),
        costNum,
        description.trim(),
        user!.uid,
        phoneValue,
        companyValue
      )
      onSuccess?.(propertyId)
    } catch (err) {
      console.error('Failed to add property:', err)
      setError('Failed to upload property. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal - matches panel width exactly, no scrolling */}
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-[calc(100%-1rem)] sm:min-w-[500px] sm:max-w-[700px] p-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-white">Add Rental Property</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-gray-300 hover:text-white"
              aria-label="Close"
              title="Close (ESC)"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400">ESC</kbd> to close or click outside
          </p>
        </div>

        {/* Image Upload Zone */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Image <span className="text-red-400">*</span>
          </label>
          {imagePreview ? (
            <div className="relative max-w-md mx-auto">
              <img
                src={imagePreview}
                alt="Property preview"
                className="w-full aspect-video object-cover rounded-lg"
              />
              <button
                onClick={() => {
                  setImageFile(null)
                  setImagePreview(null)
                }}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-700 transition-colors"
                aria-label="Remove image"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-white/20 hover:border-white/40'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <PhotoIcon className="w-12 h-12 mx-auto mb-2 text-gray-500" />
              <p className="text-gray-400 text-sm mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-gray-500 text-xs">
                JPEG, PNG, WebP (max 5MB)
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
            className="hidden"
          />
        </div>

        {/* Address */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Address <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Reno, NV 89501"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={uploading}
          />
        </div>

        {/* Cost & Phone (side by side) */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Monthly Rent
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400">$</span>
              <input
                type="text"
                value={cost}
                onChange={(e) => {
                  // Allow only digits and commas
                  const value = e.target.value.replace(/[^0-9,]/g, '')
                  setCost(value)
                }}
                placeholder="2,500"
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={uploading}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(775) 555-0123"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={uploading}
            />
          </div>
        </div>

        {/* Company Name */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Company Name
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="ABC Property Management"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={uploading}
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Why is this a good space? <span className="text-red-400">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Great location near downtown, 1500 sq ft, flexible lease terms..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={uploading}
          />
          <p className="text-xs text-gray-500 mt-0.5">
            {description.length} / 20 characters minimum
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 p-2.5 bg-red-600/20 border border-red-600/50 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {uploading ? 'Uploading...' : 'Add Property'}
          </button>
        </div>
      </div>
    </div>
  )
}
