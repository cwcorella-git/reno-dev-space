/**
 * Canonical, externally-reachable URL for the site.
 *
 * Used for absolute links that leave the app and must resolve from anywhere:
 * email verification links, campaign email CTAs, preview/sample data in the
 * email template editor. Relative paths handle in-app navigation; this is only
 * for links that travel outside the browser session (e.g. into an inbox).
 *
 * Single source of truth — do not re-hardcode the domain elsewhere.
 */

export const SITE_URL = 'https://renodevspace.org'
