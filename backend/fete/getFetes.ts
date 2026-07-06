export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT f.id, f.name, f.event_date, f.description, f.status, f.created_at,
           f.location_id,
           u.name AS created_by_name,
           sl.name AS location_name
    FROM fetes f
    LEFT JOIN fete_users u ON f.created_by = u.id
    LEFT JOIN fete_locations sl ON f.location_id = sl.id
    ORDER BY f.event_date DESC
  `)
  return result.data
}
