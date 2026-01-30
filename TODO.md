# TODO - Polish & Improvements

Tracking polish work, bugs, and feature ideas for Reno Dev Space.

## Code Cleanup

- [ ] **Marquee animation unused** - Defined in `tailwind.config.ts` and `TextStyle` type but never rendered in `TextBlockRenderer.tsx`. Either implement or remove.
- [ ] **Background color UI missing** - `TextStyle.backgroundColor` exists but no control in `EditorTab.tsx` to set it.
- [ ] **CommunityTab.tsx unused** - Legacy subtab toggle component; Chat and Members are now separate panel tabs. Can be removed.
- [x] ~~**Italic/underline UI missing**~~ - Fixed: Ctrl+B/I/U shortcuts added in `TextBlockRenderer.tsx`, plus B/I/U/S buttons in `EditorTab.tsx`.

## Bugs

- [ ] **Content tab Save button** - Save does not persist changes to Firestore. Debug logging added (commit `0335f56`). Needs investigation.

## UI/UX Polish

- [ ] **Text wrapping in mobile view** - Text blocks should wrap properly when inside the mobile safe zone (375px area).

## Features

- [ ] **Stripe go-live** - Switch from test mode to live payments (see CLAUDE.md Go-Live Checklist).

## Performance

- [ ]

## Accessibility

- [ ]

---

*Add items as needed. Check off when complete.*
