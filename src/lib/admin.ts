const ADMIN_EMAIL = 'christopher@corella.com'

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}
