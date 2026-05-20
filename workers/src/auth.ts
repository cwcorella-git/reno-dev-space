/**
 * better-auth setup with D1 backing.
 *
 * Email/password only (no OAuth/phone/etc.). Email verification required
 * before a session is issued for new accounts.
 *
 * See docs/migration/AUTH.md for the full design.
 */
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db/client'
import { users } from './db/schema'
import { sendVerificationEmail } from './email'
import type { Env } from './env'

const COOKIE_DOMAIN = 'renodevspace.org'

/**
 * Factory: returns a configured auth instance bound to the request's env.
 * Can't be module-scoped because the D1 binding only exists at request time.
 */
export function auth(env: Env) {
  const drizzleDb = db(env.DB)

  const options: BetterAuthOptions = {
    database: drizzleAdapter(drizzleDb, {
      provider: 'sqlite',
      // Map better-auth's default table names to our `auth_*` prefixed tables.
      schema: {
        user: 'auth_user',
        session: 'auth_session',
        account: 'auth_account',
        verification: 'auth_verification',
      },
    }),

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.PUBLIC_SITE_URL,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        await sendVerificationEmail(env, user.email, url)
      },
    },

    advanced: {
      cookies: {
        sessionToken: {
          attributes: { domain: COOKIE_DOMAIN, sameSite: 'lax', secure: true },
        },
      },
    },

    databaseHooks: {
      user: {
        create: {
          /**
           * Mirror every new auth identity into the app's `users` profile
           * table. Same `id`. Lets the rest of the app keep referring to
           * `users` for profile data while better-auth owns identity.
           *
           * Future sessions add: initial pledge record, default avatar,
           * etc. Kept minimal here so signup stays cheap.
           */
          after: async (newUser) => {
            await drizzleDb.insert(users).values({
              id: newUser.id,
              email: newUser.email,
              displayName: newUser.name ?? null,
              bio: '',
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          },
        },
      },
    },
  }

  return betterAuth(options)
}

export type Auth = ReturnType<typeof auth>
