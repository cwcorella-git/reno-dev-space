/**
 * Outbound email transport (Resend).
 *
 * See docs/migration/EMAIL.md for the full design.
 * Session 1 only sends the verify-email template; later sessions add
 * the 3 campaign templates and the test-email admin route.
 */
import type { Env } from './env'
import verifyEmailTemplate from './templates/verify-email.html'

const FROM_ADDRESS = 'Reno Dev Space <noreply@renodevspace.org>'
const REPLY_TO = 'admin@renodevspace.org'

interface SendEmailOpts {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail(env: Env, opts: SendEmailOpts): Promise<{ id: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      reply_to: REPLY_TO,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend send failed (${res.status}): ${body}`)
  }
  return res.json()
}

export function renderTemplate(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    html
  )
}

export async function sendVerificationEmail(
  env: Env,
  to: string,
  verificationUrl: string
): Promise<{ id: string }> {
  const html = renderTemplate(verifyEmailTemplate, {
    VERIFICATION_LINK: verificationUrl,
  })
  return sendEmail(env, {
    to,
    subject: 'Verify your email — Reno Dev Space',
    html,
  })
}
