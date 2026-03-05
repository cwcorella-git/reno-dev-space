# Documentation

This directory contains detailed technical documentation for the Reno Dev Space project.

For a quick-reference overview of the entire codebase, start with [CLAUDE.md](../CLAUDE.md).

---

## docs/ Contents

| File | Description |
|------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, core patterns, all Firestore schemas |
| [PROPERTIES.md](PROPERTIES.md) | Rental property gallery — components, voting, admin controls |
| [MEASUREMENT.md](MEASUREMENT.md) | Coordinate system, measurement service, collision detection |
| [EMAIL_SYSTEM.md](EMAIL_SYSTEM.md) | Email infrastructure, templates, Cloud Functions |
| [TESTING.md](TESTING.md) | Playwright test suite — 14 spec files, best practices |
| [ADMIN.md](ADMIN.md) | Admin scripts, user management, in-app moderation |
| [BACKUP.md](BACKUP.md) | Backup/restore procedures for Firestore data |
| [SECURITY.md](SECURITY.md) | Firestore rules, auth, permissions, sanitization |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Build process, GitHub Pages, CI/CD, Cloud Functions |
| [SESSION_NOTES.md](SESSION_NOTES.md) | Development session log and decisions |
| [OVERLAP_DETECTION_DEBUG.md](OVERLAP_DETECTION_DEBUG.md) | Technical deep-dive on legacy overlap detection |

---

## Root-Level Documentation

| File | Description |
|------|-------------|
| [CLAUDE.md](../CLAUDE.md) | Claude Code instructions — project quick-reference, key patterns, file structure |
| [README.md](../README.md) | User-facing project overview |
| [CHANGELOG.md](../CHANGELOG.md) | Version history and recent changes |
| [TODO.md](../TODO.md) | Planned features and known issues |
| [STRIPE_GO_LIVE.md](../STRIPE_GO_LIVE.md) | Complete Stripe payment go-live guide |
| [EMAIL_SETUP.md](../EMAIL_SETUP.md) | Email system quick-start and commands |
| [GITHUB_SETUP_GUIDE.md](../GITHUB_SETUP_GUIDE.md) | GitHub Actions and Claude Code integration setup |

---

## Key Concepts

### Voting System

Three-state model for both canvas text blocks and rental properties:

| State | brightness | votersUp | votersDown |
|-------|-----------|----------|------------|
| Neutral | 50 | [] | [] |
| Upvoted | +5 | [uid] | [] |
| Downvoted | -5 | [] | [uid] |

- ±5 brightness per vote; deleted at 0 (canvas blocks) or archived at ≤ 20 (properties)
- **Same-direction vote button is disabled** — clicking it is a no-op
- **Opposite-direction button removes existing vote** and returns to neutral
- Only upvotes on canvas blocks trigger celebration animations

### Content CMS

Two patterns for making text admin-editable:

```tsx
// For visible DOM elements (labels, headings, buttons):
<EditableText id="property.gallery.title" defaultValue="Potential Spaces" category="property" />

// For string attributes (placeholders, aria-labels):
placeholder={getText('auth.placeholder.email', 'you@example.com')}
```

Admin uses **Ctrl+click** on any `<EditableText>` to edit inline. All keys must be registered in `DEFAULT_CONTENT` in `ContentTab.tsx`.

### Coordinate System

All positions stored as **canvas percentages**:
- `x`: 0–100 of DESIGN_WIDTH (1440px)
- `y`: 0–100+ of DESIGN_HEIGHT (900px, unbounded for scroll)
- Collision detection uses the `MeasurementService` singleton for DOM-accurate measurements

See [MEASUREMENT.md](MEASUREMENT.md) for the full coordinate system documentation.

### Property System

Rental properties are separate from canvas text blocks:
- Stored in `rentalProperties` collection
- Gallery positioned on canvas via admin drag (stored in `settings/propertyGallery`)
- Archive threshold: ≤ 20 brightness (grayed, not deleted)

See [PROPERTIES.md](PROPERTIES.md) for full details.

---

## Development Workflow

1. **Read [CLAUDE.md](../CLAUDE.md)** — get oriented with file structure and patterns
2. **Check [TODO.md](../TODO.md)** — see what needs work
3. **Update [CHANGELOG.md](../CHANGELOG.md)** — document your changes
4. **Log in [SESSION_NOTES.md](SESSION_NOTES.md)** — record decisions and learnings
