export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT a.id, a.name, a.category, a.quantity_total, a.quantity_available,
           a.notes, a.created_at,
           sl.id AS location_id, sl.name AS location_name
    FROM assets a
    LEFT JOIN store_locations sl ON a.location_id = sl.id
    ORDER BY a.category ASC, a.name ASC
  `)
  return result.data
}
