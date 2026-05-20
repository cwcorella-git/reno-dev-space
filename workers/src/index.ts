/**
 * Worker entrypoint.
 *
 * Session 1: only /api/auth/* (better-auth handler) + /api/health.
 * Later sessions add canvas/property/chat/stripe/email routes and the
 * WebSocket subscription handler for Durable Objects.
 *
 * See docs/migration/FUNCTIONS.md for the full router design.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth'
import type { Env } from './env'

const app = new Hono<{ Bindings: Env }>()

// CORS: same-origin only for credentialed requests.
// During session 1 we deploy to *.workers.dev so loosen origin to support that;
// at cutover this tightens to https://renodevspace.org only.
app.use(
  '/api/*',
  cors({
    origin: (origin) => origin ?? '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
)

// Mount better-auth at /api/auth/*
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth(c.env).handler(c.req.raw))

// Healthcheck
app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }))

export default app
