# TODO - Polish & Improvements

Tracking polish work, bugs, and feature ideas for Reno Dev Space.

## Code Cleanup

- [x] ~~**CommunityTab.tsx unused**~~ - Removed. Chat and Members are now separate panel tabs.
- [x] ~~**Italic/underline UI missing**~~ - Fixed: Ctrl+B/I/U shortcuts + B/I/U/S buttons in EditorTab.
- [x] ~~**Marquee animation unused**~~ - Removed from TextStyle and tailwind.config.ts. Was never rendered or controllable. Commit `0a9a0c4`.
- [x] ~~**Background color UI missing**~~ - Added background color picker to EditorTab. Shows 9 options: transparent (checkerboard pattern) + 8 colors. Commit `0a9a0c4`.
- [x] ~~**VoteOutlines.tsx disabled**~~ - Removed. SVG outlines replaced by CSS text effects (ring-burst). Commit `3781fca`.

## Bugs

- [x] ~~**Content tab Save button**~~ - Fixed: Added comprehensive debug logging to contentStorage.updateContent() and keyboard shortcuts (Ctrl+Enter to save, Escape to cancel). Commit `1662843`.

## UI/UX Polish

- [x] ~~**Text wrapping in mobile view**~~ - Fixed: Added max-width constraint (90vw) and word-break styles to blocks. Empty placeholder now wraps. Commit `6a24821`.
- [x] ~~**Vote effect tuning**~~ - Optimized: Sped up all 8 celebration animations 15-20% (0.45-0.7s range), enhanced visual impact (wider spreads, bigger scales), removed unused dash-dance outline animations. Updated CLAUDE.md to reflect actual implementation.

## Features

- [ ] **Stripe go-live** - Switch from test mode to live payments (see CLAUDE.md Go-Live Checklist).
- [ ] **Live cursor presence** - Show other users' cursors in real-time with name labels and editing previews. Architecture designed (Firestore `presence` collection, 200ms throttled writes, 30s TTL).

## Performance

- [ ]

## Accessibility

- [ ]

---

*Add items as needed. Check off when complete.*
