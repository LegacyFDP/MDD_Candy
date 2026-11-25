// Permission levels, lowest to highest. These match the server's checks in
// backend/fete/personRecords.ts; the server is what actually enforces them.
const ROLE_RANK: Record<string, number> = {
  'user': 0,
  'store keeper': 1,
  'admin': 2,
  'superuser': 3,
}

type HasRole = { role: string }

function rank(user: HasRole): number {
  return ROLE_RANK[user.role] ?? -1
}

/** Admin or Superuser. */
export const isAdmin = (user: HasRole) => rank(user) >= ROLE_RANK['admin']!

/** Store Keeper, Admin or Superuser: may move stock in and out. */
export const canManageStock = (user: HasRole) => rank(user) >= ROLE_RANK['store keeper']!

/** Sees archived records, restores them and permanently deletes stores. */
export const isSuperuser = (user: HasRole) => rank(user) >= ROLE_RANK['superuser']!

/** How a role is shown to people. */
export function roleLabel(role: string): string {
  return role === 'superuser' ? 'Superuser' : role
}
