export const SUPER_ADMIN_EMAIL = 'christopher@corella.com'

export function isAdmin(email: string | null | undefined, adminEmails: Set<string> = new Set()): boolean {
  if (!email) return false
  const lower = email.toLowerCase()
  return lower === SUPER_ADMIN_EMAIL.toLowerCase() || adminEmails.has(lower)
}
