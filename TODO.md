# TODO - Polish & Improvements

Tracking polish work, bugs, and feature ideas for Reno Dev Space.

## Code Cleanup

- [x] ~~**CommunityTab.tsx unused**~~ - Removed. Chat and Members are now separate panel tabs.
- [x] ~~**Italic/underline UI missing**~~ - Fixed: Ctrl+B/I/U shortcuts + B/I/U/S buttons in EditorTab.
- [ ] **Marquee animation unused** - Defined in `tailwind.config.ts` and `TextStyle` type but never rendered in `TextBlockRenderer.tsx`. Either implement or remove.
- [ ] **Background color UI missing** - `TextStyle.backgroundColor` exists but no control in `EditorTab.tsx` to set it.
- [x] ~~**VoteOutlines.tsx disabled**~~ - Removed. SVG outlines replaced by CSS text effects (ring-burst). Commit `cd3e73c`.

## Bugs

- [x] ~~**Content tab Save button**~~ - Fixed: Added comprehensive debug logging to contentStorage.updateContent() and keyboard shortcuts (Ctrl+Enter to save, Escape to cancel). Commit `1662843`.

## UI/UX Polish

- [ ] **Text wrapping in mobile view** - Text blocks should wrap properly when inside the mobile safe zone (375px area).
- [ ] **Vote effect tuning** - Tier thresholds and animation speeds may need adjustment after real-world testing.

## Features

- [ ] **Stripe go-live** - Switch from test mode to live payments (see CLAUDE.md Go-Live Checklist).
- [ ] **Live cursor presence** - Show other users' cursors in real-time with name labels and editing previews. Architecture designed (Firestore `presence` collection, 200ms throttled writes, 30s TTL).

## Performance

- [ ]

## Accessibility

- [ ]

---

*Add items as needed. Check off when complete.*
