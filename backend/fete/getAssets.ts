export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT a.id, a.name, COALESCE(c.name, 'Other') AS category, a.quantity_total, a.quantity_available,
           a.notes, a.created_at,
           COALESCE(b.quantity_booked, 0) AS quantity_booked,
           sl.id AS location_id, sl.name AS location_name,
           sa.id AS storage_area_id, sa.name AS storage_area_name
    FROM assets a
    LEFT JOIN (
      SELECT asset_id, SUM(quantity) AS quantity_booked
      FROM withdrawals
      WHERE status = 'booked'
      GROUP BY asset_id
    ) b ON b.asset_id = a.id
    LEFT JOIN store_locations sl ON a.location_id = sl.id
    LEFT JOIN storage_areas sa ON a.storage_area_id = sa.id
    LEFT JOIN asset_categories c ON a.category_id = c.id
    ORDER BY category ASC, a.name ASC
  `)
  return result.data
}
