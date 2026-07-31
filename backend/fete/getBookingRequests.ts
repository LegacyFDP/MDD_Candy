export default async function (req: { params: { fete_id?: number; status?: string }; user: User }) {
  if (req.user.role !== 'admin') {
    throw new Error('Admin access required.')
  }

  const { fete_id, status = 'pending' } = req.params

  if (fete_id != null) {
    const result = await retoolDb.query<{
      id: number
      fete_id: number
      fete_name: string
      name: string
      email: string
      status: string
      notes: string
      created_at: string
      reviewed_at: string | null
      reviewed_by_name: string | null
    }>(
      `SELECT r.id, r.fete_id, f.name AS fete_name, r.name, r.email,
              r.status, r.notes, r.created_at, r.reviewed_at,
              u.name AS reviewed_by_name
       FROM volunteer_booking_requests r
       JOIN fetes f ON f.id = r.fete_id
       LEFT JOIN fete_users u ON u.id = r.reviewed_by
       WHERE r.fete_id = $1 AND r.status = $2
       ORDER BY r.created_at ASC`,
      [fete_id, status],
    )
    return result.data
  }

  const result = await retoolDb.query<{
    id: number
    fete_id: number
    fete_name: string
    name: string
    email: string
    status: string
    notes: string
    created_at: string
    reviewed_at: string | null
    reviewed_by_name: string | null
  }>(
    `SELECT r.id, r.fete_id, f.name AS fete_name, r.name, r.email,
            r.status, r.notes, r.created_at, r.reviewed_at,
            u.name AS reviewed_by_name
     FROM volunteer_booking_requests r
     JOIN fetes f ON f.id = r.fete_id
     LEFT JOIN fete_users u ON u.id = r.reviewed_by
     WHERE r.status = $1
     ORDER BY f.event_date ASC, r.created_at ASC`,
    [status],
  )
  return result.data
}
