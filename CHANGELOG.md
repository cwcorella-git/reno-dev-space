# Changelog

All notable changes to the Reno Dev Space project will be documented in this file.

## [Unreleased] - 2026-02-12

### Property Voting System

#### Fixed
- **Critical voting bug**: Test mode early return was blocking actual vote execution
  - Moved test mode check after `voteProperty()` call
  - Upvoting now works correctly (+5 brightness)
  - File: `src/components/property/PropertyVoteControls.tsx`

- **Vote neutralization behavior**:
  - Same-direction clicks now NO-OP (keeps your vote)
  - Opposite-direction clicks NEUTRALIZE (removes your vote, back to zero)
  - Example: Upvoted → vote down → neutral (not downvoted)
  - File: `src/lib/storage/propertyStorage.ts`

#### Improved
- **Vote control positioning**: Moved from right sidebar to floating overlay on bottom-right of property images
  - Compact appearance with backdrop blur (`bg-black/60`)
  - Always visible on property cards
  - File: `src/components/property/PropertyCard.tsx`

- **Property card layout**:
  - Full-width text layout (address, price, details no longer squished)
  - Changed expand icon: magnifying glass → `ArrowsPointingOutIcon` (□)
  - Changed delete icon: trash can → `XMarkIcon` (×)
  - Expand button moved to bottom-left of image

- **Full-view modal**:
  - Desktop: Uses 98% of viewport (was constrained to narrow mobile area)
  - Mobile: Pinch-to-zoom enabled with pan/scroll support
  - Close button: fixed position, larger on desktop (14x14)
  - Image sizing: `max-w-[98vw] max-h-[98vh]` on desktop
  - File: `src/components/property/PropertyCard.tsx`

#### Added
- **Playwright test suite** for voting functionality
  - Tests upvote, downvote, neutralization, no-op behavior
  - File: `tests/property-voting.spec.ts`

### Email Template Editor

#### Fixed
- **Email preview modal overflow**: Content was hidden off-screen
  - Removed height constraints that pushed content below viewport
  - Modal now uses full screen with proper sizing
  - Changed from `max-w-4xl` to `max-w-7xl` (1280px)
  - File: `src/components/panel/EmailsPanel.tsx`

### Content CMS

#### Fixed
- **"Potential Spaces" title**: Hooked up to Content CMS
  - Changed from hardcoded text to `<EditableText>` component
  - Key: `property.gallery.title`
  - Admin can now Ctrl+click to edit
  - File: `src/components/property/PropertyGallery.tsx`

### Architecture Changes

#### Vote System Behavior (Breaking Change)
**Before:**
- Clicking same direction: neutralized vote
- Clicking opposite direction: switched vote (net ±10 swing)

**After:**
- Clicking same direction: NO-OP (no change)
- Clicking opposite direction: NEUTRALIZE (back to zero)
- User has 3 states: neutral, upvoted, downvoted
- Must click opposite to remove vote, then click again to vote opposite direction

### Technical Improvements

- Improved modal z-index management for property full-view (z-200)
- Added `touchAction: 'pan-x pan-y pinch-zoom'` for mobile zoom support
- Fixed invalid Tailwind class `md:max-w-screen` → `md:max-w-[98vw]`
- Better backdrop blur effects on modals

### Files Modified (Session Summary)

**Vote System:**
- `src/lib/storage/propertyStorage.ts` - Neutralization logic
- `src/components/property/PropertyVoteControls.tsx` - Test mode bug fix
- `src/components/property/PropertyCard.tsx` - UI repositioning + full-view modal
- `tests/property-voting.spec.ts` - Comprehensive test suite

**Email Templates:**
- `src/components/panel/EmailsPanel.tsx` - Modal sizing fix

**Content CMS:**
- `src/components/property/PropertyGallery.tsx` - EditableText integration

### Commits Today
1. `392acfa` - Fix property voting bug + UI improvements
2. `bf7a2cb` - Fix voting behavior + improve full-view modal
3. `c1aba8a` - Fix vote neutralization: opposite direction returns to zero
4. `1ac36e1` - Maximize full-view modal + enable pinch-to-zoom on mobile
5. `ad2ec85` - Hook up "Potential Spaces" title to Content CMS
6. `432f038` - Fix email preview modal overflow
7. `afb410a` - Make email preview modal much larger and visible
8. `ebb7397` - Fix property full-view modal to use full screen on desktop

---

## Previous Sessions

See git history for detailed commit messages and prior changes.
