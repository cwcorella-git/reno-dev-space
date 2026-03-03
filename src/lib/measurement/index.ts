/**
 * Activated Measurement System
 *
 * Unified system for measuring block dimensions and detecting collisions.
 * Replaces the broken overlapDetection.ts with a single, consistent approach.
 */

// Types
export * from './types'

// Services
export { measurementService } from './MeasurementService'
export { collisionDetector } from './CollisionDetector'
