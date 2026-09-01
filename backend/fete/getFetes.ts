export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
        SELECT f.id, f.name, f.event_date, f.description, f.notes, f.status, f.created_at,
          f.archived_at, f.archived_by,
           f.location_id,
           u.name AS created_by_name,
          au.name AS archived_by_name,
           sl.name AS location_name
    FROM fetes f
    LEFT JOIN fete_users u ON f.created_by = u.id
        LEFT JOIN fete_users au ON f.archived_by = au.id
    LEFT JOIN store_locations sl
      ON f.location_id = sl.id
     AND sl.location_type = 'Fetes'
    ORDER BY CASE f.status
      WHEN 'active' THEN 1
      WHEN 'planned' THEN 2
      WHEN 'completed' THEN 3
      ELSE 4
    END,
    f.event_date ASC,
    f.name ASC
  `)
  return result.data
}
