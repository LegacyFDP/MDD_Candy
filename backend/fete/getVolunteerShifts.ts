type Params = {
  volunteer_id?: number
  fete_id?: number
}

export default async function (req: { params: Params; user: User }) {
  const { volunteer_id, fete_id } = req.params

  const conditions: string[] = []
  const values: Array<number> = []

  if (typeof volunteer_id === 'number') {
    values.push(volunteer_id)
    conditions.push(`vs.volunteer_id = $${values.length}`)
  }

  if (typeof fete_id === 'number') {
    values.push(fete_id)
    conditions.push(`vs.fete_id = $${values.length}`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await retoolDb.query<{
    id: number
    volunteer_id: number
    volunteer_name: string
    fete_id: number | null
    fete_name: string | null
    role: string
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
      vs.role,
      COALESCE(vs.start_date, date('now')) AS start_date,
      COALESCE(vs.end_date, vs.start_date, date('now')) AS end_date,
      vs.start_time,
      vs.end_time,
      vs.created_at
    FROM volunteer_shifts vs
    LEFT JOIN fete_volunteers v ON v.id = vs.volunteer_id
    LEFT JOIN fetes f ON f.id = vs.fete_id
    ${whereClause}
    ORDER BY COALESCE(vs.start_date, date('now')) ASC, vs.start_time ASC
  `, values)

  return result.data
}

