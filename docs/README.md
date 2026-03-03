# Documentation

This directory contains comprehensive documentation for the Reno Dev Space project.

## Documentation Structure

```
docs/
├── README.md              # This file
├── SESSION_NOTES.md       # Development session notes and decisions
├── ARCHITECTURE.md        # System architecture and design patterns
└── TESTING.md             # Testing strategy and test suite documentation
```

## Quick Links

### Project Documentation (Root)
- **[CLAUDE.md](../CLAUDE.md)** - Instructions for Claude Code, project overview, tech stack
- **[README.md](../README.md)** - User-facing project documentation
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history and recent changes
- **[TODO.md](../TODO.md)** - Planned features and known issues

### Setup & Configuration
- **[EMAIL_SETUP.md](../EMAIL_SETUP.md)** - Email template system configuration
- **[STRIPE_GO_LIVE.md](../STRIPE_GO_LIVE.md)** - Stripe payment integration guide

### Development
- **[SESSION_NOTES.md](./SESSION_NOTES.md)** - Detailed session logs
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design (to be created)
- **[TESTING.md](./TESTING.md)** - Test coverage and strategies (to be created)

## Key Concepts

### Voting System
- **Three-state model**: Neutral → Upvoted → Neutral → Downvoted
- **Neutralization**: Click opposite direction to remove vote
- **No-op behavior**: Same direction click does nothing
- **Brightness range**: 0-100 (±5 per vote)

### Content CMS
- **EditableText component**: Wrap UI text for inline editing
- **getText() function**: For string attributes (placeholders, etc.)
- **Ctrl+click**: Admin inline editing shortcut
- **Content panel**: Centralized CMS in admin panel

### Property System
- **Gallery positioning**: Draggable via admin (constrained to mobile safe zone)
- **Vote controls**: Floating overlay on bottom-right of images
- **Full-view modal**: Pinch-to-zoom on mobile, full-screen on desktop
- **Archive threshold**: Properties with brightness ≤ 20 are archived

## Development Workflow

1. **Read CLAUDE.md** - Understand project structure
2. **Check TODO.md** - See what needs work
3. **Update CHANGELOG.md** - Document changes
4. **Log in SESSION_NOTES.md** - Record decisions and learnings

## Contributing

See [CLAUDE.md](../CLAUDE.md) for:
- File structure
- Coding patterns
- Firestore collections
- Environment setup
