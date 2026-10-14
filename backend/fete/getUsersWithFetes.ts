export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query<{
    id: number; name: string; email: string; role: string
  }>(`
    SELECT u.id, u.name, u.email, u.role
    FROM fete_users u
    ORDER BY u.role DESC, u.name ASC
  `)

  const allocationsResult = await retoolDb.query<{
    user_id: number
    fete_id: number
    fete_name: string
    event_date: string
    fete_status: string
    notes: string
  }>(`
    SELECT DISTINCT
      u_fete.user_id,
      f.id AS fete_id,
      f.name AS fete_name,
      f.event_date,
      f.status AS fete_status,
      f.notes
    FROM (
      SELECT created_by AS user_id, id AS fete_id FROM fetes WHERE created_by IS NOT NULL
      UNION
      SELECT withdrawn_by AS user_id, fete_id FROM withdrawals WHERE fete_id IS NOT NULL
    ) u_fete
    JOIN fetes f ON f.id = u_fete.fete_id
    ORDER BY f.event_date DESC, f.name ASC
  `)

  const fetesByUser = new Map<number, Array<{
    fete_id: number
    fete_name: string
    event_date: string
    fete_status: string
    notes: string
  }>>()

  for (const row of allocationsResult.data) {
    const list = fetesByUser.get(row.user_id) ?? []
    list.push({
      fete_id: row.fete_id,
      fete_name: row.fete_name,
      event_date: row.event_date,
      fete_status: row.fete_status,
      notes: row.notes,
    })
    fetesByUser.set(row.user_id, list)
  }

  return result.data.map((row) => ({
    ...row,
    fetes: fetesByUser.get(row.id) ?? [],
  }))
}

