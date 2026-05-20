/**
 * Cloudflare Worker bindings + env vars + secrets.
 * Mirrors the wrangler.jsonc configuration.
 */
export interface Env {
  DB: D1Database

  // Plaintext vars
  PUBLIC_SITE_URL: string

  // Secrets (set via `wrangler secret put`)
  RESEND_API_KEY: string
  BETTER_AUTH_SECRET: string
}
