export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT f.id, f.name, f.event_date, f.description, f.notes, f.status, f.created_at,
           f.location_id,
           u.name AS created_by_name,
           sl.name AS location_name,
           COALESCE(v.volunteer_count, 0) AS volunteer_count
    FROM fetes f
    LEFT JOIN fete_users u ON f.created_by = u.id
    LEFT JOIN store_locations sl
      ON f.location_id = sl.id
     AND sl.location_type = 'Fetes'
    LEFT JOIN (
      SELECT fv.fete_id, COUNT(*) AS volunteer_count
      FROM fete_volunteers fv
      GROUP BY fv.fete_id
    ) v ON v.fete_id = f.id
    ORDER BY f.event_date DESC
  `)
  return result.data
}
