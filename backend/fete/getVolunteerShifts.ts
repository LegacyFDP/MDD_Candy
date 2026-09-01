type Params = {
  volunteer_id?: number
  fete_id?: number
}

export default async function (req: { params: Params; user: User }) {
  const { volunteer_id, fete_id } = req.params

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
      vs.volunteer_id,
      v.name AS volunteer_name,
      vs.fete_id,
      f.name AS fete_name,
      GROUP_CONCAT(vsr.role, '|') AS roles,
      vs.start_date,
      vs.end_date,
      vs.start_time,
      vs.end_time,
      vs.created_at
    FROM volunteer_shifts vs
    LEFT JOIN fete_volunteers v ON v.id = vs.volunteer_id
    LEFT JOIN fetes f ON f.id = vs.fete_id
    LEFT JOIN volunteer_shift_roles vsr ON vsr.shift_id = vs.id
    WHERE ($1 IS NULL OR vs.volunteer_id = $1)
      AND ($2 IS NULL OR vs.fete_id = $2)
    GROUP BY vs.id
    ORDER BY vs.start_date ASC, vs.start_time ASC
  `, [volunteer_id ?? null, fete_id ?? null])

  return result.data.map(shift => ({
    ...shift,
    roles: shift.roles ? shift.roles.split('|') : [],
  }))
}
