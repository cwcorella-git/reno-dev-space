# TODO - Polish & Improvements

Tracking polish work, bugs, and feature ideas for Reno Dev Space.

## Code Cleanup

- [x] ~~**CommunityTab.tsx unused**~~ - Removed. Chat and Members are now separate panel tabs.
- [x] ~~**Italic/underline UI missing**~~ - Fixed: Ctrl+B/I/U shortcuts + B/I/U/S buttons in EditorTab.
- [ ] **Marquee animation unused** - Defined in `tailwind.config.ts` and `TextStyle` type but never rendered in `TextBlockRenderer.tsx`. Either implement or remove.
- [ ] **Background color UI missing** - `TextStyle.backgroundColor` exists but no control in `EditorTab.tsx` to set it.
- [ ] **VoteOutlines.tsx disabled** - SVG outlines replaced by CSS text effects. File still exists but is commented out in `CanvasBlock.tsx`. Remove if text effects are kept.

## Bugs

- [ ] **Content tab Save button** - Save does not persist changes to Firestore. Debug logging added (commit `0335f56`). Needs investigation.

## UI/UX Polish

- [ ] **Text wrapping in mobile view** - Text blocks should wrap properly when inside the mobile safe zone (375px area).
- [ ] **Vote effect tuning** - Tier thresholds and animation speeds may need adjustment after real-world testing.

## Features

- [ ] **Stripe go-live** - Switch from test mode to live payments (see CLAUDE.md Go-Live Checklist).

## Performance

- [ ]

## Accessibility

- [ ]

---

*Add items as needed. Check off when complete.*
