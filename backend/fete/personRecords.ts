// Shared helpers for the people handlers. No default export, so the server does not expose it as an API.

export const PERSON_ROLES = ['User', 'Admin', 'Store Keeper', 'Volunteer', 'Contact'] as const
export const ACCOUNT_ROLES = ['User', 'Admin', 'Store Keeper'] as const

export const VOLUNTEER_ROLES = [
  'Lead Volunteer',
  'Helper',
  'Putting Up',
  'Taking Down',
  'Transport',
  'Stall Holder',
] as const

/** The single permission level stored on the login account: the most powerful of the person's account roles. */
export function effectiveAccountRole(roles: string[]): 'admin' | 'store keeper' | 'user' {
  if (roles.includes('Admin')) return 'admin'
  if (roles.includes('Store Keeper')) return 'store keeper'
  return 'user'
}

export async function assertAccountRemovable(userId: number) {
  const withdrawals = await retoolDb.query<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM withdrawals WHERE withdrawn_by = $1 OR returned_by = $2',
    [userId, userId],
  )
  if ((withdrawals.data[0]?.cnt ?? 0) > 0) {
    throw new Error('Cannot remove login access — this person has withdrawal records. Reassign or archive those first.')
  }
}

export async function removeAccount(userId: number) {
  await assertAccountRemovable(userId)
  await retoolDb.query('UPDATE fetes SET created_by = NULL WHERE created_by = $1', [userId])
  await retoolDb.query('DELETE FROM fete_users WHERE id = $1', [userId])
}

export async function removeVolunteer(volunteerId: number) {
  await retoolDb.query(
    'DELETE FROM volunteer_shift_roles WHERE shift_id IN (SELECT id FROM volunteer_shifts WHERE volunteer_id = $1)',
    [volunteerId],
  )
  await retoolDb.query('DELETE FROM volunteer_shifts WHERE volunteer_id = $1', [volunteerId])
  await retoolDb.query('DELETE FROM volunteer_roles WHERE volunteer_id = $1', [volunteerId])
  await retoolDb.query('DELETE FROM fete_volunteers WHERE id = $1', [volunteerId])
}

export async function removeContact(contactId: number) {
  await retoolDb.query('DELETE FROM fete_contact_events WHERE contact_id = $1', [contactId])
  await retoolDb.query('DELETE FROM fete_contacts WHERE id = $1', [contactId])
}
