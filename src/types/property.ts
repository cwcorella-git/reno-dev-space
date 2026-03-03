/**
 * Rental Property Types
 *
 * Data model for community-sourced rental property listings.
 * Uses the same voting/brightness system as text blocks.
 */

export interface RentalProperty {
  id: string
  imageUrl: string              // Firebase Storage download URL (required)
  imageStoragePath: string      // Storage path for deletion
  address: string               // Required, e.g., "123 Main St, Reno, NV"
  cost: number | null           // Monthly rent in dollars, null displays as "???"
  description: string           // User's reasoning for suggestion
  phone?: string | null         // Contact phone number (optional)
  companyName?: string | null   // Property management company (optional)

  // Voting system (mirrors text blocks)
  brightness: number            // 0-100, default 50
  voters: string[]              // Legacy array
  votersUp?: string[]           // User UIDs who voted up
  votersDown?: string[]         // User UIDs who voted down

  // Reporting (optional, same as text blocks)
  reportedBy?: string[]
  dismissedReporters?: string[]

  createdBy: string             // User UID
  createdAt: number
  updatedAt: number
}

export const DEFAULT_BRIGHTNESS = 50
export const VOTE_BRIGHTNESS_CHANGE = 5
export const ARCHIVE_THRESHOLD = 20  // Grays out at ≤20, not deleted

export const DEFAULT_PROPERTY: Omit<RentalProperty, 'id'> = {
  imageUrl: '',
  imageStoragePath: '',
  address: '',
  cost: null,
  description: '',
  phone: null,
  companyName: null,
  brightness: DEFAULT_BRIGHTNESS,
  voters: [],
  createdBy: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}
