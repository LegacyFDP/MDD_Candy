export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT a.id, a.name, a.category, a.quantity_total, a.quantity_available,
           a.notes, a.created_at,
           COALESCE(b.quantity_booked, 0) AS quantity_booked,
           sl.id AS location_id, sl.name AS location_name
    FROM assets a
    LEFT JOIN (
      SELECT asset_id, SUM(quantity) AS quantity_booked
      FROM withdrawals
      WHERE status = 'booked'
      GROUP BY asset_id
    ) b ON b.asset_id = a.id
    LEFT JOIN store_locations sl ON a.location_id = sl.id
    ORDER BY a.category ASC, a.name ASC
  `)
  return result.data
}
