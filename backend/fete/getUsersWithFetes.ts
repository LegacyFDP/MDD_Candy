type UserFeteRow = {
  id: number
  name: string
  email: string
  role: string
  pin: string
  fete_id: number | null
  fete_name: string | null
  event_date: string | null
  fete_status: string | null
  notes: string | null
}

export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query<UserFeteRow>(`
    SELECT
      u.id, u.name, u.email, u.role, u.pin,
      f.id AS fete_id,
      f.name AS fete_name,
      f.event_date,
      f.status AS fete_status,
      f.notes
    FROM fete_users u
    LEFT JOIN fetes f ON f.created_by = u.id
    ORDER BY u.role DESC, u.name ASC, f.event_date ASC, f.name ASC
  `)

  const usersById = new Map<number, {
    id: number
    name: string
    email: string
    role: string
    pin: string
    fetes: {
      fete_id: number
      fete_name: string
      event_date: string | null
      fete_status: string
      notes: string
    }[]
  }>()

  for (const row of result.data) {
    let user = usersById.get(row.id)
    if (!user) {
      user = {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        pin: row.pin,
        fetes: [],
      }
      usersById.set(user.id, user)
    }

    if (row.fete_id != null && row.fete_name != null && row.fete_status != null) {
      user.fetes.push({
        fete_id: row.fete_id,
        fete_name: row.fete_name,
        event_date: row.event_date,
        fete_status: row.fete_status,
        notes: row.notes ?? '',
      })
    }
  }

  return Array.from(usersById.values())
}
