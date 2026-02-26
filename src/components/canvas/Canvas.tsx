'use client'

import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { useCanvas, DESIGN_WIDTH, DESIGN_HEIGHT } from '@/contexts/CanvasContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePresence } from '@/contexts/PresenceContext'
import { CanvasBlock, OVERFLOW_LEFT, OVERFLOW_RIGHT } from './CanvasBlock'
import { CursorPresence } from './CursorPresence'
import { getRandomColor, getRandomFont } from '@/types/canvas'
import { UnifiedPanel } from '@/components/panel/UnifiedPanel'
import { IntroHint } from '@/components/IntroHint'
import { CampaignBanner } from '@/components/CampaignBanner'
import { PropertyGallery } from '@/components/property/PropertyGallery'
import { GalleryPositionSlider } from '@/components/property/GalleryPositionSlider'
import { AddPropertyModal } from '@/components/property/AddPropertyModal'
import { incrementPageViews } from '@/lib/storage/campaignStorage'
import { subscribeToGalleryPosition, updateGalleryPosition, migrateGalleryPositionIfNeeded, DEFAULT_POSITION as DEFAULT_GALLERY_POSITION } from '@/lib/storage/propertyGalleryStorage'
import { wouldOverlap, wouldOverlapDOM, measureNewBlockSize } from '@/lib/overlapDetection'
import { filterEditableBlocks } from '@/lib/permissions'
import { EditableText } from '@/components/EditableText'

// Mobile safe zone width (for admin visual guide)
const MOBILE_SAFE_ZONE = 375

// Desktop focus width - the portion of canvas that fills desktop viewport
// Smaller than DESIGN_WIDTH to make text more readable (centered on mobile safe zone)
const DESKTOP_FOCUS_WIDTH = 900

// Viewport width thresholds for responsive scaling
const MOBILE_BREAKPOINT = 500   // Below this: pure mobile (zoom to safe zone)
const TABLET_BREAKPOINT = 900   // Below this: transitional scaling

// Reserved space at top for campaign banner (prevents text overlap)
const BANNER_HEIGHT = 56 // px - matches CampaignBanner single-row layout

interface ContextMenuState {
  x: number // screen position
  y: number // screen position
  canvasX: number // percentage position on canvas
  canvasY: number // percentage position on canvas
}

interface MarqueeState {
  startX: number // percentage
  startY: number // percentage
  currentX: number // percentage
  currentY: number // percentage
}

export function Canvas() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { blocks, canvasRef, canAddText, selectedBlockIds, loading: canvasLoading, selectBlock, selectBlocks, addText, isAddTextMode, setIsAddTextMode, removeBlocks, undo, redo, copyBlocks, pasteBlocks } = useCanvas()
  const { updateCursorPosition } = usePresence()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const isMarqueeActive = useRef(false)

  // Add Text mode cursor preview
  const [addTextPreview, setAddTextPreview] = useState<{ x: number; y: number; isValid: boolean } | null>(null)
  const [previewColor, setPreviewColor] = useState('#4ade80')
  const [previewFont, setPreviewFont] = useState('var(--font-inter)')
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>({ width: 12, height: 6 })
  // Ref to avoid stale closure in mouse handlers - always has latest measured size
  const previewSizeRef = useRef<{ width: number; height: number }>({ width: 12, height: 6 })

  // Track cursor position for paste operations
  const cursorPosRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 })

  // Scale factor for viewport < DESIGN_WIDTH
  const [scale, setScale] = useState(1)
  const [isMobileView, setIsMobileView] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  // Property modal state (lifted to control panel visibility and scrolling)
  const [showPropertyModal, setShowPropertyModal] = useState(false)

  // Gallery position tracking (for slider)
  const [galleryY, setGalleryY] = useState(DEFAULT_GALLERY_POSITION.y)

  // Fast initial estimate based on block Y positions (before DOM is available)
  const estimatedHeightPx = useMemo(() => {
    if (blocks.length === 0) return DESIGN_HEIGHT
    const lowestBottom = Math.max(...blocks.map(b => b.y + (b.height || 10)))
    return Math.max(DESIGN_HEIGHT, (lowestBottom / 100) * DESIGN_HEIGHT + DESIGN_HEIGHT)
  }, [blocks])

  // DOM-measured height: updated after render and on block resizes
  const [measuredHeightPx, setMeasuredHeightPx] = useState(DESIGN_HEIGHT)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const measure = () => {
      const blockEls = canvas.querySelectorAll<HTMLElement>('[data-block-id]')
      if (blockEls.length === 0) { setMeasuredHeightPx(DESIGN_HEIGHT); return }
      let lowestBottom = 0
      blockEls.forEach(el => {
        // Use offset properties instead of getBoundingClientRect — offset values
        // reflect the CSS layout box only, ignoring filter effects (drop-shadow,
        // hue-rotate) that expand the visual bounding rect and cause scroll jitter.
        const bottom = el.offsetTop + el.offsetHeight
        if (bottom > lowestBottom) lowestBottom = bottom
      })
      // One full screen of padding below the lowest block
      setMeasuredHeightPx(Math.max(DESIGN_HEIGHT, lowestBottom + DESIGN_HEIGHT))
    }

    // Measure after DOM commits
    measure()

    // Re-measure when any block element resizes (font changes, text edits, etc.)
    const observer = new ResizeObserver(measure)
    canvas.querySelectorAll<HTMLElement>('[data-block-id]').forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [blocks])

  // --- Grow-only canvas height (prevents bounce from estimate→measure double-change) ---
  // The height floor grows immediately but only shrinks after a debounce,
  // so the estimate→measure transition never causes a visible two-step shift.
  const [heightFloor, setHeightFloor] = useState(DESIGN_HEIGHT)
  const shrinkTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const targetHeight = Math.max(estimatedHeightPx, measuredHeightPx)
  const canvasHeightPx = Math.max(targetHeight, heightFloor)

  useEffect(() => {
    const target = Math.max(estimatedHeightPx, measuredHeightPx)
    if (target > heightFloor) {
      // Growing — raise the floor immediately
      setHeightFloor(target)
      if (shrinkTimerRef.current) clearTimeout(shrinkTimerRef.current)
    } else if (target < heightFloor) {
      // Shrinking — debounce so fast-estimate drop + slow-measure catch-up
      // don't cause two separate height changes
      if (shrinkTimerRef.current) clearTimeout(shrinkTimerRef.current)
      shrinkTimerRef.current = setTimeout(() => {
        setHeightFloor(target)
      }, 300)
    }
    return () => { if (shrinkTimerRef.current) clearTimeout(shrinkTimerRef.current) }
  }, [estimatedHeightPx, measuredHeightPx, heightFloor])

  // For coordinate calculations, we need the height as a percentage (100 = one screen)
  const canvasHeightPercent = (canvasHeightPx / DESIGN_HEIGHT) * 100

  // Track viewport size and update scale with smooth transitions
  // Uses three zones: mobile (safe zone), tablet (transitional), desktop (focus width)
  useEffect(() => {
    const updateScale = () => {
      const viewportWidth = window.innerWidth

      if (viewportWidth < MOBILE_BREAKPOINT) {
        // Mobile: zoom to show just the safe zone (375px)
        setIsMobileView(true)
        setScale(viewportWidth / MOBILE_SAFE_ZONE)
      } else if (viewportWidth < TABLET_BREAKPOINT) {
        // Tablet/transitional: smoothly interpolate between safe zone and focus width
        // At MOBILE_BREAKPOINT, show safe zone; at TABLET_BREAKPOINT, show focus width
        setIsMobileView(false)
        const progress = (viewportWidth - MOBILE_BREAKPOINT) / (TABLET_BREAKPOINT - MOBILE_BREAKPOINT)
        const targetWidth = MOBILE_SAFE_ZONE + progress * (DESKTOP_FOCUS_WIDTH - MOBILE_SAFE_ZONE)
        setScale(viewportWidth / targetWidth)
      } else {
        // Desktop: scale to show focus width (900px of content centered)
        // This keeps text readable while showing more than just mobile zone
        setIsMobileView(false)
        setScale(Math.min(1.2, viewportWidth / DESKTOP_FOCUS_WIDTH))
      }
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  // Lock scrolling when property modal is open
  useEffect(() => {
    if (showPropertyModal) {
      // Disable body scrolling
      document.body.style.overflow = 'hidden'
      // Disable canvas scrolling
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.overflow = 'hidden'
      }
    } else {
      // Restore scrolling
      document.body.style.overflow = ''
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.overflow = 'auto'
      }
    }
    return () => {
      document.body.style.overflow = ''
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.overflow = 'auto'
      }
    }
  }, [showPropertyModal])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // If in add text mode, place text at click position
      if (isAddTextMode && canAddText) {
        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * 100
          const y = ((e.clientY - rect.top) / rect.height) * canvasHeightPercent

          // Use current preview size from ref for accurate overlap check
          const currentSize = previewSizeRef.current
          if (wouldOverlapDOM(canvas, x, y, canvasHeightPercent, currentSize.width, currentSize.height)) {
            return
          }

          // Place block with TOP-LEFT at the centered position
          // Preview is centered on cursor, so offset by half the size
          // x offset: width/2 (both in 0-100% scale)
          // y offset: height * canvasHeightPercent / 100 / 2 (convert CSS% to canvasHeightPercent scale)
          const offsetX = currentSize.width / 2
          const offsetY = (currentSize.height * canvasHeightPercent / 100) / 2
          addText(x - offsetX, y - offsetY, previewColor, previewFont)
          setIsAddTextMode(false)
          return
        }
      }

      // Click on canvas background always deselects (unless marquee is selecting blocks)
      // The marquee handlers will handle selection, this catches direct clicks
      if (!isMarqueeActive.current) {
        selectBlock(null)
        setContextMenu(null)
      }
    },
    [selectBlock, isAddTextMode, setIsAddTextMode, canAddText, canvasRef, addText, canvasHeightPercent, blocks, previewColor, previewFont]
  )

  // Start marquee selection on mouse down (available to everyone)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left click
      if (isAddTextMode) return // Don't start marquee when placing text

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      // Convert to percentage of design canvas
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeightPercent

      isMarqueeActive.current = true
      setMarquee({ startX: x, startY: y, currentX: x, currentY: y })
    },
    [canvasRef, canvasHeightPercent, isAddTextMode]
  )

  // Update marquee and handle selection
  useEffect(() => {
    if (!marquee) return

    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      // Convert to percentage of design canvas
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeightPercent
      setMarquee((prev) => prev ? { ...prev, currentX: x, currentY: y } : null)
    }

    const handleMouseUp = () => {
      if (!marquee) return

      // Calculate selection rectangle bounds
      const left = Math.min(marquee.startX, marquee.currentX)
      const right = Math.max(marquee.startX, marquee.currentX)
      const top = Math.min(marquee.startY, marquee.currentY)
      const bottom = Math.max(marquee.startY, marquee.currentY)

      // Check if this was a meaningful drag or just a click
      const width = right - left
      const height = bottom - top
      const isTinyDrag = width <= 2 && height <= 2

      if (isTinyDrag) {
        // Tiny drag = click on empty canvas → clear selection
        selectBlock(null)
      } else {
        // Measure actual rendered block dimensions from DOM
        const canvas = canvasRef.current
        const canvasRect = canvas?.getBoundingClientRect()
        const blockDims: Record<string, { w: number; h: number }> = {}
        if (canvas && canvasRect) {
          canvas.querySelectorAll<HTMLElement>('[data-block-id]').forEach(el => {
            const id = el.getAttribute('data-block-id')
            if (id) {
              const rect = el.getBoundingClientRect()
              blockDims[id] = {
                w: (rect.width / canvasRect.width) * 100,
                h: (rect.height / canvasRect.height) * canvasHeightPercent,
              }
            }
          })
        }

        const selectedIds = blocks
          .filter((block) => {
            const blockLeft = block.x
            const blockTop = block.y
            const dims = blockDims[block.id]
            const blockRight = block.x + (dims?.w ?? (block.width || 10))
            const blockBottom = block.y + (dims?.h ?? 5)

            return !(blockRight < left || blockLeft > right || blockBottom < top || blockTop > bottom)
          })
          .map((block) => block.id)

        if (selectedIds.length > 0) {
          selectBlocks(selectedIds)
        } else {
          // No blocks in marquee → clear selection
          selectBlock(null)
        }
      }

      setMarquee(null)
      // Delay reset so the subsequent click event still sees isMarqueeActive=true
      // and doesn't clear the selection. Browser fires: mouseup → click
      setTimeout(() => { isMarqueeActive.current = false }, 0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [marquee, blocks, selectBlock, selectBlocks, canvasRef, canvasHeightPercent])

  // Right-click to show context menu (admin only)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!canAddText) return

      e.preventDefault()

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      // Convert to percentage of design canvas
      const canvasX = ((e.clientX - rect.left) / rect.width) * 100
      const canvasY = ((e.clientY - rect.top) / rect.height) * canvasHeightPercent

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        canvasX,
        canvasY,
      })
    },
    [canAddText, canvasRef, canvasHeightPercent]
  )

  const handleAddText = useCallback(() => {
    if (contextMenu) {
      // Place block with TOP-LEFT at the centered position (same logic as click handler)
      const currentSize = previewSizeRef.current
      const offsetX = currentSize.width / 2
      const offsetY = (currentSize.height * canvasHeightPercent / 100) / 2
      addText(contextMenu.canvasX - offsetX, contextMenu.canvasY - offsetY, previewColor, previewFont)
      setContextMenu(null)
    }
  }, [contextMenu, addText, previewColor, previewFont, canvasHeightPercent])

  // Keyboard shortcuts: Delete, Escape, Ctrl+A/Z/Y/C/V
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in a text input
      const target = e.target as HTMLElement
      const isTextInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+A - select all blocks
        if (e.key === 'a') {
          if (isTextInput) return
          e.preventDefault()
          const allIds = blocks.map((b) => b.id)
          if (allIds.length > 0) {
            selectBlocks(allIds)
          }
          return
        }

        // Ctrl+Z - undo
        if (e.key === 'z' && !e.shiftKey) {
          if (isTextInput) return
          e.preventDefault()
          undo()
          return
        }

        // Ctrl+Y or Ctrl+Shift+Z - redo
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          if (isTextInput) return
          e.preventDefault()
          redo()
          return
        }

        // Ctrl+C - copy selected blocks
        if (e.key === 'c') {
          if (isTextInput) return
          if (selectedBlockIds.length > 0) {
            e.preventDefault()
            copyBlocks()
          }
          return
        }

        // Ctrl+V - paste blocks at cursor position
        if (e.key === 'v') {
          if (isTextInput) return
          e.preventDefault()
          pasteBlocks(cursorPosRef.current.x, cursorPosRef.current.y)
          return
        }
      }

      // Delete/Backspace - remove all selected blocks user can edit
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isTextInput) return
        if (selectedBlockIds.length > 0) {
          e.preventDefault()
          // Only delete blocks user owns (admin can delete all)
          const deletableIds = filterEditableBlocks(
            selectedBlockIds,
            blocks,
            user?.uid,
            isAdmin
          )
          if (deletableIds.length > 0) {
            removeBlocks(deletableIds)
          }
        }
        return
      }

      // Escape - clear selection and cancel modes
      if (e.key === 'Escape') {
        setContextMenu(null)
        setIsAddTextMode(false)
        selectBlock(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [blocks, selectBlocks, selectBlock, setIsAddTextMode, selectedBlockIds, removeBlocks, user?.uid, isAdmin, undo, redo, copyBlocks, pasteBlocks])

  // Dismiss context menu when clicking outside of it
  const contextMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!contextMenu) return

    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return
      setContextMenu(null)
    }

    // Small delay to avoid immediately closing on the same click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClick, true)
      document.addEventListener('contextmenu', handleClick, true)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('contextmenu', handleClick, true)
    }
  }, [contextMenu])

  // Track cursor position for paste operations and presence
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeightPercent

      // Only update if cursor is within canvas bounds
      if (x >= 0 && x <= 100 && y >= 0) {
        cursorPosRef.current = { x, y }
        // Update presence for other users to see
        updateCursorPosition(x, y)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [canvasRef, canvasHeightPercent, updateCursorPosition])

  // Track page views (once per browser session)
  useEffect(() => {
    const viewKey = 'reno-dev-space-viewed'
    if (!localStorage.getItem(viewKey)) {
      incrementPageViews()
      localStorage.setItem(viewKey, Date.now().toString())
    }
  }, [])

  // Subscribe to gallery position (for slider display)
  useEffect(() => {
    const unsubscribe = subscribeToGalleryPosition(
      (position) => setGalleryY(position.y),
      (error) => console.error('[Canvas] Gallery position error:', error)
    )
    return () => unsubscribe()
  }, [])

  // Migrate old gallery position to new coordinate system (admin-only, one-time)
  useEffect(() => {
    if (isAdmin && user) {
      migrateGalleryPositionIfNeeded(user.uid).catch((error) =>
        console.error('[Canvas] Gallery migration error:', error)
      )
    }
  }, [isAdmin, user])

  // Pick random color/font and measure size when entering add-text mode
  useEffect(() => {
    if (isAddTextMode) {
      const color = getRandomColor()
      const font = getRandomFont()
      setPreviewColor(color)
      setPreviewFont(font)

      // Measure actual block size with selected font
      const canvas = canvasRef.current
      if (canvas) {
        const measured = measureNewBlockSize(canvas, font, 1) // 1rem default
        const newSize = {
          width: measured.widthPercent,
          height: measured.heightPercent
        }
        // Update both state (for UI) and ref (for handlers to avoid stale closure)
        setPreviewSize(newSize)
        previewSizeRef.current = newSize
        console.log('[Canvas] Measured preview size:', newSize)
      }
    }
  }, [isAddTextMode, canvasRef])

  // Track mouse position for Add Text mode preview
  useEffect(() => {
    if (!isAddTextMode || !canAddText) {
      setAddTextPreview(null)
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeightPercent

      // Check if placement would be valid (not overlapping)
      // Use ref for latest measured size to avoid stale closure issue
      const currentSize = previewSizeRef.current
      const isValid = !wouldOverlapDOM(canvas, x, y, canvasHeightPercent, currentSize.width, currentSize.height)

      setAddTextPreview({ x, y, isValid })
    }

    const handleMouseLeave = () => {
      setAddTextPreview(null)
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('mousemove', handleMouseMove)
      canvas.addEventListener('mouseleave', handleMouseLeave)
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove)
        canvas.removeEventListener('mouseleave', handleMouseLeave)
      }
    }
  }, [isAddTextMode, canAddText, blocks, canvasRef, canvasHeightPercent]) // previewSize removed - using ref


  if (authLoading || canvasLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  // Calculate offset needed to center the safe zone in mobile view
  // Safe zone is centered in the design canvas, so we need to shift left by half the difference
  const mobileOffset = (DESIGN_WIDTH - MOBILE_SAFE_ZONE) / 2

  return (
    <>
      {/* Scroll container - wraps the scaled design canvas */}
      <div
        ref={scrollContainerRef}
        className="h-screen w-full overflow-y-auto overflow-x-hidden bg-brand-dark"
        style={{ overflowAnchor: 'auto' }}
        onClick={(e) => {
          // Click on page background (not canvas) also deselects
          if (e.target === e.currentTarget || e.target === scrollContainerRef.current) {
            selectBlock(null)
          }
        }}
      >
        {/* Spacer for fixed banner - OUTSIDE scaled area so it doesn't get scaled */}
        <div style={{ height: `${BANNER_HEIGHT}px` }} />

        {/* Mobile clipping container - clips to safe zone width */}
        <div
          className="relative mx-auto"
          style={{
            width: isMobileView ? `${MOBILE_SAFE_ZONE * scale}px` : '100%',
            minHeight: isMobileView ? `${canvasHeightPx * scale}px` : undefined,
            overflow: isMobileView ? 'hidden' : 'visible',
          }}
        >
          {/* Design canvas - fixed pixel dimensions, centered, scaled to fit viewport */}
          {/* On mobile: offset so safe zone center aligns with container */}
          <div
            ref={canvasRef}
            className="relative bg-brand-dark select-none"
            style={{
              width: `${DESIGN_WIDTH}px`,
              minHeight: `${canvasHeightPx}px`,
              transform: isMobileView
                ? `scale(${scale}) translateX(-${mobileOffset}px)`
                : `translateX(-50%) scale(${scale})`,
              transformOrigin: isMobileView ? 'top left' : 'top center',
              left: isMobileView ? '0' : '50%',
            }}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
          >
          {/* Desktop focus zone overlay (admin only) - shows 900px content area */}
          {isAdmin && (
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-full border-x border-dashed border-indigo-500/20 pointer-events-none z-[4]"
              style={{ width: `${DESKTOP_FOCUS_WIDTH}px` }}
              title="Desktop focus zone (900px)"
            >
              <div className="absolute top-2 right-2 text-[10px] text-indigo-400/40 whitespace-nowrap">
                <EditableText id="canvas.label.desktopView" defaultValue="desktop view" category="canvas" />
              </div>
            </div>
          )}

          {/* Mobile safe zone overlay (admin only) */}
          {isAdmin && (
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-full border-x-2 border-dashed border-white/15 pointer-events-none z-[5]"
              style={{ width: `${MOBILE_SAFE_ZONE}px` }}
              title="Mobile safe zone (375px)"
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-white/30 whitespace-nowrap">
                <EditableText id="canvas.label.mobileView" defaultValue="mobile view" category="canvas" />
              </div>
            </div>
          )}

          {/* Canvas boundary guides - shows overflow zones */}
          {/* Visible to signed-in users when editing (has selection or in add text mode) */}
          {user && (selectedBlockIds.length > 0 || isAddTextMode) && (
            <>
              {/* Left edge line (0%) */}
              <div
                className="absolute top-0 h-full w-0.5 bg-amber-500/30 pointer-events-none z-[4]"
                style={{ left: '0%' }}
              />
              {/* Right edge line (100%) */}
              <div
                className="absolute top-0 h-full w-0.5 bg-amber-500/30 pointer-events-none z-[4]"
                style={{ left: '100%' }}
              />
              {/* Left overflow zone (shaded) */}
              <div
                className="absolute top-0 h-full bg-amber-500/5 border-r border-dashed border-amber-500/20 pointer-events-none z-[3]"
                style={{ left: `-${OVERFLOW_LEFT}%`, width: `${OVERFLOW_LEFT}%` }}
                title={`Left overflow zone (${OVERFLOW_LEFT}%)`}
              />
              {/* Right overflow zone (shaded) */}
              <div
                className="absolute top-0 h-full bg-amber-500/5 border-l border-dashed border-amber-500/20 pointer-events-none z-[3]"
                style={{ left: '100%', width: `${OVERFLOW_RIGHT}%` }}
                title={`Right overflow zone (${OVERFLOW_RIGHT}%)`}
              />
            </>
          )}

          {/* Render all blocks */}
          {blocks.map((block) => (
            <CanvasBlock key={block.id} block={block} canvasHeightPercent={canvasHeightPercent} />
          ))}

          {/* Other users' cursors */}
          <CursorPresence />

          {/* Marquee selection rectangle */}
          {marquee && (
            <div
              className="absolute border-2 border-indigo-500 bg-indigo-500/20 pointer-events-none z-50"
              style={{
                left: `${Math.min(marquee.startX, marquee.currentX)}%`,
                top: `${(Math.min(marquee.startY, marquee.currentY) / canvasHeightPercent) * 100}%`,
                width: `${Math.abs(marquee.currentX - marquee.startX)}%`,
                height: `${(Math.abs(marquee.currentY - marquee.startY) / canvasHeightPercent) * 100}%`,
              }}
            />
          )}

          {/* Empty state for admin */}
          {isAdmin && blocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2"><EditableText id="canvas.empty.title" defaultValue="Your canvas is empty" category="canvas" /></p>
                <p className="text-sm"><EditableText id="canvas.empty.subtitle" defaultValue="Tap the + button or right-click to add text" category="canvas" /></p>
              </div>
            </div>
          )}

          {/* Add text mode indicator and cursor preview */}
          {isAddTextMode && (
            <div className="absolute inset-0 pointer-events-none z-40">
              <div className={`absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm shadow-lg ${
                addTextPreview && !addTextPreview.isValid
                  ? 'bg-red-600 text-white'
                  : 'bg-indigo-600 text-white'
              }`}>
                {addTextPreview && !addTextPreview.isValid
                  ? <EditableText id="canvas.addText.overlapping" defaultValue="Can't place here – overlapping" category="canvas" />
                  : <EditableText id="canvas.addText.clickToPlace" defaultValue="Click to place text" category="canvas" />}
              </div>

              {/* Cursor-following preview box - CENTERED on cursor for symmetric approach */}
              {addTextPreview && (
                <div
                  className="absolute border-2 border-dashed rounded transition-colors"
                  style={{
                    left: `${addTextPreview.x}%`,
                    top: `${(addTextPreview.y / canvasHeightPercent) * 100}%`,
                    width: `${previewSize.width}%`,
                    height: `${previewSize.height}%`,  // 0-100 scale (matches measureNewBlockSize output)
                    transform: 'translate(-50%, -50%)',  // Center on cursor
                    borderColor: addTextPreview.isValid ? previewColor : '#ef4444',
                    backgroundColor: addTextPreview.isValid ? `${previewColor}1a` : '#ef44441a',
                  }}
                />
              )}
            </div>
          )}

            {/* Rental property gallery */}
            <PropertyGallery
              onAddPropertyClick={() => setShowPropertyModal(true)}
              canvasHeightPercent={canvasHeightPercent}
            />

            {/* Gallery position slider (desktop, admin only) */}
            {isAdmin && !isMobileView && (
              <GalleryPositionSlider
                currentY={galleryY}
                canvasHeightPercent={canvasHeightPercent}
                onChange={(newY) => {
                  if (user) {
                    // Keep X at default centered position, only update Y
                    updateGalleryPosition(DEFAULT_GALLERY_POSITION.x, newY, user.uid)
                  }
                }}
                visible={true}
              />
            )}
          </div>
        </div>
      </div>

      {/* Property modal - rendered outside canvas to avoid transform issues */}
      {showPropertyModal && (
        <AddPropertyModal
          onClose={() => setShowPropertyModal(false)}
          onSuccess={() => setShowPropertyModal(false)}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-gray-900 border border-white/20 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleAddText}
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <EditableText id="canvas.contextMenu.addText" defaultValue="Add Text" category="canvas" />
          </button>
        </div>
      )}

      {/* Unified panel with editor + chat tabs */}
      {!showPropertyModal && <UnifiedPanel />}

      {/* Intro hint for non-logged-in users */}
      {!user && <IntroHint />}

      {/* Campaign banner at top */}
      <CampaignBanner />
    </>
  )
}
