export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT u.id, u.name, u.email, u.role, u.pin,
           f.id          AS fete_id,
           f.name        AS fete_name,
           f.event_date,
           f.status      AS fete_status,
           fv.role       AS volunteer_role,
           fv.notes
    FROM fete_users u
    LEFT JOIN fete_volunteers fv ON fv.user_id = u.id
    LEFT JOIN fetes f ON f.id = fv.fete_id
    ORDER BY u.role DESC, u.name ASC, f.event_date DESC
  `)

  // Group rows by user so each user has an array of fete allocations
  const map = new Map<number, {
    id: number; name: string; email: string; role: string; pin: string
    fetes: { fete_id: number; fete_name: string; event_date: string; fete_status: string; volunteer_role: string; notes: string }[]
  }>()

  for (const row of result.data as {
    id: number; name: string; email: string; role: string; pin: string
    fete_id: number | null; fete_name: string | null; event_date: string | null
    fete_status: string | null; volunteer_role: string | null; notes: string | null
  }[]) {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id, name: row.name, email: row.email,
        role: row.role, pin: row.pin, fetes: []
      })
    }
    if (row.fete_id !== null) {
      map.get(row.id)!.fetes.push({
        fete_id: row.fete_id,
        fete_name: row.fete_name ?? '',
        event_date: row.event_date ?? '',
        fete_status: row.fete_status ?? '',
        volunteer_role: row.volunteer_role ?? '',
        notes: row.notes ?? ''
      })
    }
  }

  return Array.from(map.values())
}
