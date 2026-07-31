export const FIXED_ROLES = [
  'Lead Volunteer',
  'Helper',
  'Putting Up',
  'Taking Down',
  'Transport',
  'Stall Holder',
] as const

export type FixedRole = (typeof FIXED_ROLES)[number]

export function normalizeRole(role: string, roleOther?: string): { roleKey: string; roleOther: string } {
  const trimmedRole = (role ?? '').trim()
  const trimmedOther = (roleOther ?? '').trim()

  if (trimmedRole === 'Other') {
    if (!trimmedOther) {
      throw new Error('Provide a custom role when selecting Other')
    }
    return { roleKey: 'Other', roleOther: trimmedOther }
  }

  if (!FIXED_ROLES.includes(trimmedRole as FixedRole)) {
    throw new Error('Role must be one of the supported roles or Other')
  }

  return { roleKey: trimmedRole, roleOther: '' }
}
