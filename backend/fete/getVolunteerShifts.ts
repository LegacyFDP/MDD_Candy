type Params = {
  volunteer_id?: number | string
  fete_id?: number | string
}

export default async function (req: { params: Params; user: User }) {
  const volunteerId = (req.params.volunteer_id != null && req.params.volunteer_id !== '' && !isNaN(Number(req.params.volunteer_id)))
    ? Number(req.params.volunteer_id)
    : null
  const feteId = (req.params.fete_id != null && req.params.fete_id !== '' && !isNaN(Number(req.params.fete_id)))
    ? Number(req.params.fete_id)
    : null

  const result = await retoolDb.query<{
    id: number
    volunteer_id: number
    volunteer_name: string
    fete_id: number | null
    fete_name: string | null
    roles: string | null
    start_date: string
    end_date: string
    start_time: string
    end_time: string
    created_at: string
  }>(`
    SELECT
      vs.id,
      vs.person_id AS volunteer_id,
      p.name AS volunteer_name,
      vs.fete_id,
      f.name AS fete_name,
      GROUP_CONCAT(vsr.role, '|' ORDER BY vsr.rowid) AS roles,
      vs.start_date,
      vs.end_date,
      vs.start_time,
      vs.end_time,
      vs.created_at
    FROM volunteer_shifts vs
    LEFT JOIN people p ON p.id = vs.person_id
    LEFT JOIN fetes f ON f.id = vs.fete_id
    LEFT JOIN volunteer_shift_roles vsr ON vsr.shift_id = vs.id
    WHERE ($1 IS NULL OR vs.person_id = $1)
      AND ($2 IS NULL OR vs.fete_id = $2)
    GROUP BY vs.id
    ORDER BY vs.start_date ASC, vs.start_time ASC
  `, [volunteerId, feteId])

  return result.data.map(shift => ({
    ...shift,
    role: (shift.roles ? shift.roles.split('|')[0] : '') || 'Helper',
    roles: shift.roles ? shift.roles.split('|') : [],
  }))
}
